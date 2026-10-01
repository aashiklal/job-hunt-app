import "server-only";
import { z } from "zod";
import * as jobs from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import * as documents from "@/lib/repositories/documents";
import * as templates from "@/lib/repositories/templates";
import type { DocumentType } from "@/lib/repositories/documents";
import {
  callMeteredStructured,
  callMeteredText,
  chargeFixtureCredits,
} from "@/lib/ai-execution";
import type { CreditFeature } from "@/lib/credits";
import { jdAnalysisSchema, type JDAnalysis } from "@/lib/job-analysis";
import { isDemoUser, withDemoLatency } from "@/lib/demo";
import {
  demoAnalysis,
  demoOutreach,
  demoPrep,
  demoStructuredDocument,
} from "@/lib/demo-fixtures";
import {
  buildJDAnalysisPrompt,
  buildLinkedInConnectionNotePrompt,
  buildLinkedInRecruiterDMPrompt,
  buildFollowUpApplicationEmailPrompt,
  buildThankYouEmailPrompt,
  buildInterviewPrepPrompt,
  buildLinkedInAppliedFollowupDMPrompt,
  buildColdEmailPrompt,
  buildCheckinEmailPrompt,
  buildSalaryNegotiationEmailPrompt,
} from "@/lib/prompts";
import {
  buildStructuredCoverLetterPrompt,
  buildStructuredResumePrompt,
  fallbackContactFromResume,
  generatedCoverLetterSchema,
  generatedDocumentToMarkdown,
  generatedResumeSchema,
  sortExperienceByDate,
  type GeneratedDocument,
  type GeneratedResume,
} from "@/lib/generated-documents";
import { buildPixelThemeContract } from "@/lib/export/pixel-theme-contract";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;

const interviewPrepSchema = z.object({
  behavioral: z.array(z.object({ question: z.string(), hint: z.string() })),
  technical: z.array(z.object({ question: z.string(), hint: z.string() })),
  roleSpecific: z.array(z.object({ question: z.string(), hint: z.string() })),
  cultureFit: z.array(z.object({ question: z.string(), hint: z.string() })),
  questionsToAskThem: z.array(z.string()),
});

export type InterviewPrep = z.infer<typeof interviewPrepSchema>;

export const jobGenerationRequestSchema = z.object({
  jobId: z.string().min(1),
  type: z.enum([
    "resume",
    "cover_letter",
    "jd_analysis",
    "linkedin_note",
    "linkedin_dm",
    "followup_email",
    "thankyou_email",
    "interview_prep",
    "linkedin_followup_dm",
    "cold_email",
    "checkin_email",
    "salary_negotiation",
  ]),
  resumeId: z.string().min(1).optional(),
  recipientName: z.string().max(200).optional(),
  recipientTitle: z.string().max(300).optional(),
  tone: z.enum(["direct", "warm"]).optional(),
  hasApplied: z.boolean().optional(),
  daysSinceApplied: z.number().int().min(0).optional(),
  interviewerName: z.string().max(200).optional(),
  interviewerTitle: z.string().max(300).optional(),
  interviewTopics: z.string().max(2000).optional(),
  interviewType: z.enum(["phone_screen", "technical", "onsite", "panel"]).optional(),
  seniorityLevel: z.enum(["junior", "mid", "senior", "staff", "unclear"]).optional(),
  focusAreas: z.string().max(500).optional(),
  previousMessageSent: z.boolean().optional(),
  companyContext: z.string().max(2000).optional(),
  lastInteractionDescription: z.string().max(2000).optional(),
  daysSinceLastContact: z.number().int().min(0).optional(),
  offeredSalary: z.string().max(200).optional(),
  targetSalary: z.string().max(200).optional(),
  negotiationReason: z.string().max(1000).optional(),
  otherComponents: z.string().max(500).optional(),
});

export type JobGenerationInput = z.infer<typeof jobGenerationRequestSchema>;

export class JobGenerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "JobGenerationError";
  }
}

type UserForGeneration = {
  _id: { toString(): string };
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  isDemo?: boolean;
};

export type JobGenerationResult =
  | { kind: "jd_analysis"; analysis: JDAnalysis }
  | { kind: "interview_prep"; prep: z.infer<typeof interviewPrepSchema> }
  | { kind: "outreach"; content: string }
  | {
      kind: "structured_document";
      documentId: string;
      content: string;
      structuredContent: GeneratedDocument;
    };

function senderName(user: { firstName?: string | null; lastName?: string | null; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email.split("@")[0];
}

function isOutreachType(
  type: JobGenerationInput["type"]
): type is Exclude<
  JobGenerationInput["type"],
  "resume" | "cover_letter" | "jd_analysis" | "interview_prep"
> {
  return (
    type === "linkedin_note" ||
    type === "linkedin_dm" ||
    type === "followup_email" ||
    type === "thankyou_email" ||
    type === "linkedin_followup_dm" ||
    type === "cold_email" ||
    type === "checkin_email" ||
    type === "salary_negotiation"
  );
}

/** The credit price each generation type is charged under. */
function creditFeatureFor(type: JobGenerationInput["type"]): CreditFeature {
  if (type === "jd_analysis" || type === "interview_prep") return type;
  if (type === "resume" || type === "cover_letter") return type;
  return "outreach";
}

async function demoGeneration(
  userIdStr: string,
  job: { _id: string; company: string; role: string; location?: string | null },
  type: JobGenerationInput["type"]
): Promise<JobGenerationResult> {
  if (type === "jd_analysis") {
    return { kind: "jd_analysis", analysis: demoAnalysis(job) };
  }
  if (type === "interview_prep") {
    return { kind: "interview_prep", prep: demoPrep(job) };
  }
  if (isOutreachType(type)) {
    return { kind: "outreach", content: demoOutreach(type, job) };
  }
  const result = await demoStructuredDocument(userIdStr, job, type);
  return {
    kind: "structured_document",
    documentId: result.documentId,
    content: result.content,
    structuredContent: result.structuredContent,
  };
}

export async function generateForJob(
  user: UserForGeneration,
  input: JobGenerationInput
): Promise<JobGenerationResult> {
  const userIdStr = user._id.toString();
  const job = await jobs.getById(userIdStr, input.jobId);
  if (!job) {
    throw new JobGenerationError("Job not found", "Job not found", 404);
  }

  // Demo accounts never reach Anthropic. Fixtures are interpolated with this
  // job so the output still reads as tailored, and they cost the same credits
  // as the live feature so the balance behaves like the real app.
  if (isDemoUser(user)) {
    const result = await chargeFixtureCredits(
      userIdStr,
      creditFeatureFor(input.type),
      () => demoGeneration(userIdStr, job, input.type)
    );
    return withDemoLatency(result);
  }

  if (input.type === "jd_analysis") {
    return handleJDAnalysis({ userIdStr, jobId: input.jobId, job });
  }
  if (input.type === "interview_prep") {
    return handleInterviewPrep({
      userIdStr,
      jobId: input.jobId,
      job,
      seniorityLevel: input.seniorityLevel ?? "unclear",
      focusAreas: input.focusAreas,
      resumeList: await resumes.list(userIdStr),
    });
  }
  if (isOutreachType(input.type)) {
    return handleOutreach({
      userIdStr,
      jobId: input.jobId,
      type: input.type,
      job,
      user,
      params: input,
      resumeList: await resumes.list(userIdStr),
    });
  }

  const resume = input.resumeId
    ? await resumes.getById(userIdStr, input.resumeId)
    : await resumes.getDefault(userIdStr);
  if (!resume) {
    throw new JobGenerationError(
      input.resumeId ? "Selected resume not found" : "NO_RESUME",
      input.resumeId
        ? "Selected resume not found"
        : "Save a base resume first to use this feature.",
      input.resumeId ? 404 : 400
    );
  }

  return handleStructuredGeneration({
    userIdStr,
    jobId: input.jobId,
    type: input.type,
    job,
    resume,
    candidateName: senderName(user),
  });
}

async function handleJDAnalysis(args: {
  userIdStr: string;
  jobId: string;
  job: { jobDescription?: string | null };
}): Promise<JobGenerationResult> {
  const { userIdStr, jobId, job } = args;
  if (!job.jobDescription || job.jobDescription.trim().length < 50) {
    throw new JobGenerationError(
      "NO_JOB_DESCRIPTION",
      "Save a job description on this job before running JD analysis.",
      400
    );
  }

  const { system, userMessage } = buildJDAnalysisPrompt({
    jobDescription: job.jobDescription,
  });
  const result = await callMeteredStructured({
    userId: userIdStr,
    system,
    userMessage,
    model: MODEL,
    maxTokens: MAX_TOKENS,
    schema: jdAnalysisSchema,
    feature: "jd_analysis",
  });

  await documents.upsert(userIdStr, {
    jobId,
    type: "jd_analysis" as DocumentType,
    content: JSON.stringify(result.data),
    aiModel: MODEL,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return { kind: "jd_analysis", analysis: result.data };
}

async function handleOutreach(args: {
  userIdStr: string;
  jobId: string;
  type: Exclude<
    JobGenerationInput["type"],
    "resume" | "cover_letter" | "jd_analysis" | "interview_prep"
  >;
  job: {
    company: string;
    role: string;
    jobDescription?: string | null;
    appliedAt?: string | null;
  };
  user: { firstName?: string | null; lastName?: string | null; email: string };
  params: JobGenerationInput;
  resumeList: Array<{ content: string; isDefault: boolean }>;
}): Promise<JobGenerationResult> {
  const { userIdStr, jobId, type, job, user, params, resumeList } = args;
  const defaultResume = resumeList.find((r) => r.isDefault) ?? resumeList[0];
  const baseResume = defaultResume?.content ?? "";
  const name = senderName(user);

  let system: string;
  let userMessage: string;

  if (type === "linkedin_note") {
    if (!params.recipientName || !params.recipientTitle) {
      throw new JobGenerationError(
        "recipientName and recipientTitle are required for LinkedIn note",
        "recipientName and recipientTitle are required for LinkedIn note",
        400
      );
    }
    ({ system, userMessage } = buildLinkedInConnectionNotePrompt({
      senderName: name,
      recipientName: params.recipientName,
      recipientTitle: params.recipientTitle,
      job: { company: job.company, role: job.role },
      baseResume,
    }));
  } else if (type === "linkedin_dm") {
    if (!params.recipientName || !params.recipientTitle) {
      throw new JobGenerationError(
        "recipientName and recipientTitle are required for LinkedIn DM",
        "recipientName and recipientTitle are required for LinkedIn DM",
        400
      );
    }
    ({ system, userMessage } = buildLinkedInRecruiterDMPrompt({
      senderName: name,
      recipientName: params.recipientName,
      recipientTitle: params.recipientTitle,
      job: { company: job.company, role: job.role, jobDescription: job.jobDescription },
      baseResume,
      tone: params.tone ?? "direct",
      hasApplied: params.hasApplied ?? false,
    }));
  } else if (type === "followup_email") {
    if (params.daysSinceApplied === undefined) {
      throw new JobGenerationError(
        "daysSinceApplied is required for follow-up email",
        "daysSinceApplied is required for follow-up email",
        400
      );
    }
    ({ system, userMessage } = buildFollowUpApplicationEmailPrompt({
      senderName: name,
      recipientName: params.recipientName,
      job: { company: job.company, role: job.role, appliedAt: job.appliedAt },
      daysSinceApplied: params.daysSinceApplied,
    }));
  } else if (type === "thankyou_email") {
    if (!params.interviewerName || !params.interviewTopics || !params.interviewType) {
      throw new JobGenerationError(
        "interviewerName, interviewTopics, and interviewType are required for thank-you email",
        "interviewerName, interviewTopics, and interviewType are required for thank-you email",
        400
      );
    }
    ({ system, userMessage } = buildThankYouEmailPrompt({
      senderName: name,
      interviewerName: params.interviewerName,
      interviewerTitle: params.interviewerTitle,
      job: { company: job.company, role: job.role },
      interviewTopics: params.interviewTopics,
      interviewType: params.interviewType,
    }));
  } else if (type === "linkedin_followup_dm") {
    if (!params.recipientName) {
      throw new JobGenerationError(
        "recipientName is required for LinkedIn follow-up DM",
        "recipientName is required for LinkedIn follow-up DM",
        400
      );
    }
    ({ system, userMessage } = buildLinkedInAppliedFollowupDMPrompt({
      senderName: name,
      recipientName: params.recipientName,
      job: { company: job.company, role: job.role },
      daysSinceApplied: params.daysSinceApplied ?? 0,
      previousMessageSent: params.previousMessageSent ?? false,
    }));
  } else if (type === "cold_email") {
    ({ system, userMessage } = buildColdEmailPrompt({
      senderName: name,
      recipientName: params.recipientName,
      recipientTitle: params.recipientTitle,
      job: { company: job.company, role: job.role, companyContext: params.companyContext },
    }));
  } else if (type === "checkin_email") {
    if (!params.lastInteractionDescription) {
      throw new JobGenerationError(
        "lastInteractionDescription is required for check-in email",
        "lastInteractionDescription is required for check-in email",
        400
      );
    }
    ({ system, userMessage } = buildCheckinEmailPrompt({
      senderName: name,
      recipientName: params.recipientName,
      job: { company: job.company, role: job.role },
      lastInteractionDescription: params.lastInteractionDescription,
      daysSinceLastContact: params.daysSinceLastContact ?? 0,
    }));
  } else {
    if (!params.recipientName || !params.offeredSalary || !params.targetSalary || !params.negotiationReason) {
      throw new JobGenerationError(
        "recipientName, offeredSalary, targetSalary, and negotiationReason are required for salary negotiation",
        "recipientName, offeredSalary, targetSalary, and negotiationReason are required for salary negotiation",
        400
      );
    }
    ({ system, userMessage } = buildSalaryNegotiationEmailPrompt({
      senderName: name,
      recipientName: params.recipientName,
      job: { company: job.company, role: job.role },
      offeredSalary: params.offeredSalary,
      targetSalary: params.targetSalary,
      negotiationReason: params.negotiationReason,
      otherComponents: params.otherComponents,
    }));
  }

  const result = await callMeteredText({
    userId: userIdStr,
    model: MODEL,
    maxTokens: 1024,
    system,
    userMessage,
    feature: "outreach",
  });

  await documents.upsert(userIdStr, {
    jobId,
    type: type as DocumentType,
    content: result.content,
    aiModel: MODEL,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return { kind: "outreach", content: result.content };
}

async function handleInterviewPrep(args: {
  userIdStr: string;
  jobId: string;
  job: {
    company: string;
    role: string;
    jobDescription?: string | null;
  };
  seniorityLevel: "junior" | "mid" | "senior" | "staff" | "unclear";
  focusAreas?: string;
  resumeList: Array<{ content: string; isDefault: boolean }>;
}): Promise<JobGenerationResult> {
  const { userIdStr, jobId, job, seniorityLevel, focusAreas, resumeList } = args;
  const defaultResume = resumeList.find((r) => r.isDefault) ?? resumeList[0];
  const baseResume = defaultResume?.content ?? "";
  const { system, userMessage } = buildInterviewPrepPrompt({
    job: { company: job.company, role: job.role, jobDescription: job.jobDescription },
    baseResume,
    seniorityLevel,
    focusAreas,
  });

  const result = await callMeteredStructured({
    userId: userIdStr,
    system,
    userMessage,
    model: MODEL,
    maxTokens: MAX_TOKENS,
    schema: interviewPrepSchema,
    feature: "interview_prep",
  });

  await documents.upsert(userIdStr, {
    jobId,
    type: "interview_prep" as DocumentType,
    content: JSON.stringify(result.data),
    aiModel: MODEL,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return { kind: "interview_prep", prep: result.data };
}

async function handleStructuredGeneration(args: {
  userIdStr: string;
  jobId: string;
  type: "resume" | "cover_letter";
  job: {
    company: string;
    role: string;
    location?: string | null;
    jobDescription?: string | null;
  };
  resume: { _id: string; content: string };
  candidateName: string;
}): Promise<JobGenerationResult> {
  const { userIdStr, jobId, type, job, resume, candidateName } = args;
  const adminTemplate = await templates.get(type);
  const themeContract = adminTemplate
    ? buildPixelThemeContract({
        docType: type,
        themeAnalysis: adminTemplate.themeAnalysis ?? null,
        pixelThemeMap: adminTemplate.pixelThemeMap ?? null,
        styleRoleMap: adminTemplate.styleRoleMap ?? null,
      })
    : null;

  const built =
    type === "resume"
      ? buildStructuredResumePrompt({
          baseResume: resume.content,
          job: {
            company: job.company,
            role: job.role,
            location: job.location,
            jobDescription: job.jobDescription,
          },
          themeCapacity: themeContract?.capacity ?? null,
        })
      : buildStructuredCoverLetterPrompt({
          baseResume: resume.content,
          job: {
            company: job.company,
            role: job.role,
            location: job.location,
            jobDescription: job.jobDescription,
          },
          userName: candidateName,
          themeCapacity: themeContract?.capacity ?? null,
        });

  const result =
    type === "resume"
      ? await callMeteredStructured({
          userId: userIdStr,
          system: built.system,
          userMessage: built.userMessage,
          model: MODEL,
          maxTokens: MAX_TOKENS,
          schema: generatedResumeSchema,
          feature: "resume",
        })
      : await callMeteredStructured({
          userId: userIdStr,
          system: built.system,
          userMessage: built.userMessage,
          model: MODEL,
          maxTokens: MAX_TOKENS,
          schema: generatedCoverLetterSchema,
          feature: "cover_letter",
        });

  const structuredContent =
    type === "cover_letter"
      ? (() => {
          const fallbackContact = fallbackContactFromResume(resume.content);
          return {
            ...result.data,
            name: result.data.name || candidateName,
            contact: {
              location: result.data.contact.location ?? fallbackContact.location,
              phone: result.data.contact.phone ?? fallbackContact.phone,
              email: result.data.contact.email ?? fallbackContact.email,
              linkedin: result.data.contact.linkedin ?? fallbackContact.linkedin,
              github: result.data.contact.github ?? fallbackContact.github,
              website: result.data.contact.website ?? fallbackContact.website,
              workRights: result.data.contact.workRights ?? fallbackContact.workRights,
            },
          };
        })()
      : sortExperienceByDate(result.data as GeneratedResume);

  const content = generatedDocumentToMarkdown(structuredContent);
  const savedDoc = await documents.upsert(userIdStr, {
    jobId,
    type,
    content,
    structuredContent: structuredContent as unknown as Record<string, unknown>,
    aiModel: MODEL,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    resumeIdUsed: resume._id,
  });

  return {
    kind: "structured_document",
    documentId: savedDoc._id,
    content,
    structuredContent,
  };
}
