import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import anthropic from "@/lib/anthropic";
import { callStructured } from "@/lib/ai";
import * as users from "@/lib/repositories/users";
import * as jobs from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import * as documents from "@/lib/repositories/documents";
import type { DocumentType } from "@/lib/repositories/documents";
import * as templates from "@/lib/repositories/templates";
import type { TemplateType } from "@/lib/repositories/templates";
import {
  checkBudget,
  addSpend,
  calculateCost,
  QuotaExceededError,
} from "@/lib/usage";
import {
  buildResumeTailorPrompt,
  buildCoverLetterPrompt,
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
  buildResumeExtractionPrompt,
  buildCoverLetterExtractionPrompt,
} from "@/lib/prompts";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;

const jdAnalysisSchema = z.record(z.string(), z.unknown());

const requestSchema = z.object({
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
  // Outreach fields
  recipientName: z.string().max(200).optional(),
  recipientTitle: z.string().max(300).optional(),
  tone: z.enum(["direct", "warm"]).optional(),
  hasApplied: z.boolean().optional(),
  daysSinceApplied: z.number().int().min(0).optional(),
  // Thank-you email fields
  interviewerName: z.string().max(200).optional(),
  interviewerTitle: z.string().max(300).optional(),
  interviewTopics: z.string().max(2000).optional(),
  interviewType: z.enum(["phone_screen", "technical", "onsite", "panel"]).optional(),
  // Interview prep fields
  seniorityLevel: z.enum(["junior", "mid", "senior", "staff", "unclear"]).optional(),
  focusAreas: z.string().max(500).optional(),
  // Phase 2 outreach fields
  previousMessageSent: z.boolean().optional(),
  companyContext: z.string().max(2000).optional(),
  lastInteractionDescription: z.string().max(2000).optional(),
  daysSinceLastContact: z.number().int().min(0).optional(),
  offeredSalary: z.string().max(200).optional(),
  targetSalary: z.string().max(200).optional(),
  negotiationReason: z.string().max(1000).optional(),
  otherComponents: z.string().max(500).optional(),
});

// ─── Interview prep schema (module scope to avoid TS hoisting issues) ────────

const interviewPrepSchema = z.object({
  behavioral: z.array(z.object({ question: z.string(), hint: z.string() })),
  technical: z.array(z.object({ question: z.string(), hint: z.string() })),
  roleSpecific: z.array(z.object({ question: z.string(), hint: z.string() })),
  cultureFit: z.array(z.object({ question: z.string(), hint: z.string() })),
  questionsToAskThem: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  // 1. Auth check
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  const { jobId, type, resumeId } = parseResult.data;

  // 3. Look up the user (Mongo, not Clerk)
  const user = await users.getByClerkId(clerkUserId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userIdStr = (user._id as { toString(): string }).toString();

  // 4. Look up the job (with userId scoping)
  const job = await jobs.getById(userIdStr, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // 5. Look up the resume (only for resume + cover_letter; jd_analysis does not need one)
  let resume: Awaited<ReturnType<typeof resumes.getById>> = null;
  if (type === "resume" || type === "cover_letter") {
    if (resumeId) {
      resume = await resumes.getById(userIdStr, resumeId);
      if (!resume) {
        return NextResponse.json(
          { error: "Selected resume not found" },
          { status: 404 }
        );
      }
    } else {
      resume = await resumes.getDefault(userIdStr);
      if (!resume) {
        return NextResponse.json(
          {
            error: "NO_RESUME",
            message: "Save a base resume first to use this feature.",
          },
          { status: 400 }
        );
      }
    }
  }

  // 6. Check budget before calling Anthropic.
  try {
    await checkBudget(userIdStr, "aiGeneration");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: err.message,
          limit: err.limit,
          used: err.used,
          periodEndsAt: err.periodEndsAt.toISOString(),
        },
        { status: 429 }
      );
    }
    console.error("[generate] budget check failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // 7. Branch on type. Cost is recorded inside each handler after tokens are known.
  try {
    if (type === "jd_analysis") {
      return await handleJDAnalysis({ userIdStr, jobId, job });
    } else if (type === "interview_prep") {
      return await handleInterviewPrep({
        userIdStr,
        jobId,
        job,
        seniorityLevel: parseResult.data.seniorityLevel ?? "unclear",
        focusAreas: parseResult.data.focusAreas,
        resumeList: await resumes.list(userIdStr),
      });
    } else if (
      type === "linkedin_note" ||
      type === "linkedin_dm" ||
      type === "followup_email" ||
      type === "thankyou_email" ||
      type === "linkedin_followup_dm" ||
      type === "cold_email" ||
      type === "checkin_email" ||
      type === "salary_negotiation"
    ) {
      return await handleOutreach({
        userIdStr,
        jobId,
        type,
        job,
        user: user as { firstName?: string | null; lastName?: string | null; email: string },
        params: parseResult.data,
        resumeList: await resumes.list(userIdStr),
      });
    } else {
      // Resume tailor or cover letter — both stream
      const candidateName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.email.split("@")[0];
      return await handleStreamingGeneration({
        userIdStr,
        jobId,
        type,
        job,
        resume: resume!, // safe: we returned above if type needs resume and resume was null
        candidateName,
      });
    }
  } catch (err) {
    console.error("[generate] generation failed:", err);
    return NextResponse.json(
      { error: "Generation failed." },
      { status: 500 }
    );
  }
}

// ─── JD analysis: non-streaming, structured JSON ──────────────────────

async function handleJDAnalysis(args: {
  userIdStr: string;
  jobId: string;
  job: { jobDescription?: string | null };
}) {
  const { userIdStr, jobId, job } = args;

  if (!job.jobDescription || job.jobDescription.trim().length < 50) {
    return NextResponse.json(
      {
        error: "NO_JOB_DESCRIPTION",
        message:
          "Save a job description on this job before running JD analysis.",
      },
      { status: 400 }
    );
  }

  const { system, userMessage } = buildJDAnalysisPrompt({
    jobDescription: job.jobDescription,
  });

  let parsed: Record<string, unknown>;
  let inputTokens: number;
  let outputTokens: number;

  try {
    const result = await callStructured(
      { system, userMessage, model: MODEL, maxTokens: MAX_TOKENS },
      jdAnalysisSchema
    );
    parsed = result.data;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
  } catch (err) {
    console.error("[generate] JD analysis parse failed:", err);
    return NextResponse.json(
      { error: "Failed to parse AI response as JSON. Please try again." },
      { status: 502 }
    );
  }

  const cost = calculateCost(MODEL, inputTokens, outputTokens);
  await addSpend(userIdStr, "aiGeneration", cost).catch((err) => console.error("[addSpend failed]", err));

  await documents.upsert(userIdStr, {
    jobId,
    type: "jd_analysis" as DocumentType,
    content: JSON.stringify(parsed),
    aiModel: MODEL,
    inputTokens,
    outputTokens,
  });

  return NextResponse.json({ analysis: parsed });
}

// ─── Non-streaming outreach: LinkedIn note/DM, follow-up email, thank-you email ──

async function handleOutreach(args: {
  userIdStr: string;
  jobId: string;
  type: "linkedin_note" | "linkedin_dm" | "followup_email" | "thankyou_email" | "linkedin_followup_dm" | "cold_email" | "checkin_email" | "salary_negotiation";
  job: {
    company: string;
    role: string;
    jobDescription?: string | null;
    appliedAt?: string | null;
    status: string;
  };
  user: { firstName?: string | null; lastName?: string | null; email: string };
  params: {
    recipientName?: string;
    recipientTitle?: string;
    tone?: "direct" | "warm";
    hasApplied?: boolean;
    daysSinceApplied?: number;
    interviewerName?: string;
    interviewerTitle?: string;
    interviewTopics?: string;
    interviewType?: "phone_screen" | "technical" | "onsite" | "panel";
    previousMessageSent?: boolean;
    companyContext?: string;
    lastInteractionDescription?: string;
    daysSinceLastContact?: number;
    offeredSalary?: string;
    targetSalary?: string;
    negotiationReason?: string;
    otherComponents?: string;
  };
  resumeList: Array<{ content: string; isDefault: boolean }>;
}) {
  const { userIdStr, jobId, type, job, user, params, resumeList } = args;

  const senderName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email.split("@")[0];

  const defaultResume = resumeList.find((r) => r.isDefault) ?? resumeList[0];
  const baseResume = defaultResume?.content ?? "";

  let system: string;
  let userMessage: string;

  if (type === "linkedin_note") {
    if (!params.recipientName || !params.recipientTitle) {
      return NextResponse.json(
        { error: "recipientName and recipientTitle are required for LinkedIn note" },
        { status: 400 }
      );
    }
    ({ system, userMessage } = buildLinkedInConnectionNotePrompt({
      senderName,
      recipientName: params.recipientName,
      recipientTitle: params.recipientTitle,
      job: { company: job.company, role: job.role },
      baseResume,
    }));
  } else if (type === "linkedin_dm") {
    if (!params.recipientName || !params.recipientTitle) {
      return NextResponse.json(
        { error: "recipientName and recipientTitle are required for LinkedIn DM" },
        { status: 400 }
      );
    }
    ({ system, userMessage } = buildLinkedInRecruiterDMPrompt({
      senderName,
      recipientName: params.recipientName,
      recipientTitle: params.recipientTitle,
      job: { company: job.company, role: job.role, jobDescription: job.jobDescription },
      baseResume,
      tone: params.tone ?? "direct",
      hasApplied: params.hasApplied ?? false,
    }));
  } else if (type === "followup_email") {
    if (params.daysSinceApplied === undefined) {
      return NextResponse.json(
        { error: "daysSinceApplied is required for follow-up email" },
        { status: 400 }
      );
    }
    ({ system, userMessage } = buildFollowUpApplicationEmailPrompt({
      senderName,
      recipientName: params.recipientName,
      job: { company: job.company, role: job.role, appliedAt: job.appliedAt },
      daysSinceApplied: params.daysSinceApplied,
    }));
  } else if (type === "thankyou_email") {
    if (!params.interviewerName || !params.interviewTopics || !params.interviewType) {
      return NextResponse.json(
        { error: "interviewerName, interviewTopics, and interviewType are required for thank-you email" },
        { status: 400 }
      );
    }
    ({ system, userMessage } = buildThankYouEmailPrompt({
      senderName,
      interviewerName: params.interviewerName,
      interviewerTitle: params.interviewerTitle,
      job: { company: job.company, role: job.role },
      interviewTopics: params.interviewTopics,
      interviewType: params.interviewType,
    }));
  } else if (type === "linkedin_followup_dm") {
    if (!params.recipientName) {
      return NextResponse.json(
        { error: "recipientName is required for LinkedIn follow-up DM" },
        { status: 400 }
      );
    }
    ({ system, userMessage } = buildLinkedInAppliedFollowupDMPrompt({
      senderName,
      recipientName: params.recipientName,
      job: { company: job.company, role: job.role },
      daysSinceApplied: params.daysSinceApplied ?? 0,
      previousMessageSent: params.previousMessageSent ?? false,
    }));
  } else if (type === "cold_email") {
    ({ system, userMessage } = buildColdEmailPrompt({
      senderName,
      recipientName: params.recipientName,
      recipientTitle: params.recipientTitle,
      job: { company: job.company, role: job.role, companyContext: params.companyContext },
    }));
  } else if (type === "checkin_email") {
    if (!params.lastInteractionDescription) {
      return NextResponse.json(
        { error: "lastInteractionDescription is required for check-in email" },
        { status: 400 }
      );
    }
    ({ system, userMessage } = buildCheckinEmailPrompt({
      senderName,
      recipientName: params.recipientName,
      job: { company: job.company, role: job.role },
      lastInteractionDescription: params.lastInteractionDescription,
      daysSinceLastContact: params.daysSinceLastContact ?? 0,
    }));
  } else {
    // salary_negotiation
    if (!params.recipientName || !params.offeredSalary || !params.targetSalary || !params.negotiationReason) {
      return NextResponse.json(
        { error: "recipientName, offeredSalary, targetSalary, and negotiationReason are required for salary negotiation" },
        { status: 400 }
      );
    }
    ({ system, userMessage } = buildSalaryNegotiationEmailPrompt({
      senderName,
      recipientName: params.recipientName,
      job: { company: job.company, role: job.role },
      offeredSalary: params.offeredSalary,
      targetSalary: params.targetSalary,
      negotiationReason: params.negotiationReason,
      otherComponents: params.otherComponents,
    }));
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  const cost = calculateCost(MODEL, response.usage.input_tokens, response.usage.output_tokens);
  await addSpend(userIdStr, "aiGeneration", cost).catch((err) =>
    console.error("[addSpend failed]", err)
  );

  await documents.upsert(userIdStr, {
    jobId,
    type: type as DocumentType,
    content,
    aiModel: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return NextResponse.json({ content });
}

// ─── Interview prep: structured JSON, retry once ────────────────────────────

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
}) {
  const { userIdStr, jobId, job, seniorityLevel, focusAreas, resumeList } = args;

  const defaultResume = resumeList.find((r) => r.isDefault) ?? resumeList[0];
  const baseResume = defaultResume?.content ?? "";

  const { system, userMessage } = buildInterviewPrepPrompt({
    job: { company: job.company, role: job.role, jobDescription: job.jobDescription },
    baseResume,
    seniorityLevel,
    focusAreas,
  });

  let parsed: z.infer<typeof interviewPrepSchema>;
  let inputTokens: number;
  let outputTokens: number;

  try {
    const result = await callStructured(
      { system, userMessage, model: MODEL, maxTokens: MAX_TOKENS },
      interviewPrepSchema
    );
    parsed = result.data as z.infer<typeof interviewPrepSchema>;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
  } catch (err) {
    console.error("[generate] interview prep parse failed:", err);
    return NextResponse.json(
      { error: "Failed to parse AI response as JSON. Please try again." },
      { status: 502 }
    );
  }

  const cost = calculateCost(MODEL, inputTokens, outputTokens);
  await addSpend(userIdStr, "aiGeneration", cost).catch((err) =>
    console.error("[addSpend failed]", err)
  );

  await documents.upsert(userIdStr, {
    jobId,
    type: "interview_prep" as DocumentType,
    content: JSON.stringify(parsed),
    aiModel: MODEL,
    inputTokens,
    outputTokens,
  });

  return NextResponse.json({ prep: parsed });
}

// ─── Streaming generation: resume tailor + cover letter ─────────────

async function handleStreamingGeneration(args: {
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
}) {
  const { userIdStr, jobId, type, job, resume, candidateName } = args;
  const resumeIdStr = resume._id;

  // Build the prompt
  const built =
    type === "resume"
      ? buildResumeTailorPrompt({
          baseResume: resume.content,
          job: {
            company: job.company,
            role: job.role,
            location: job.location,
            jobDescription: job.jobDescription,
          },
        })
      : buildCoverLetterPrompt({
          baseResume: resume.content,
          job: {
            company: job.company,
            role: job.role,
            location: job.location,
            jobDescription: job.jobDescription,
          },
        });

  // Open the Anthropic stream
  const anthropicStream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: built.system,
    messages: [{ role: "user", content: built.userMessage }],
  });

  // Build a ReadableStream that pipes text deltas to the client
  const encoder = new TextEncoder();
  let fullText = "";
  let streamErrored = false;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Listen for text deltas
        anthropicStream.on("text", (textDelta: string) => {
          fullText += textDelta;
          controller.enqueue(encoder.encode(textDelta));
        });

        // Wait for completion
        const finalMessage = await anthropicStream.finalMessage();
        const finalInputTokens = finalMessage.usage.input_tokens;
        const finalOutputTokens = finalMessage.usage.output_tokens;

        // Record actual cost now that we have token counts
        const cost = calculateCost(MODEL, finalInputTokens, finalOutputTokens);
        await addSpend(userIdStr, "aiGeneration", cost).catch((err) => console.error("[addSpend failed]", err));

        // Save the document AFTER streaming completes
        const savedDoc = await documents.upsert(userIdStr, {
          jobId,
          type,
          content: fullText,
          aiModel: MODEL,
          inputTokens: finalInputTokens,
          outputTokens: finalOutputTokens,
          resumeIdUsed: resumeIdStr,
        });

        // Fire-and-forget: extract structured template data while user reads the preview.
        // When the user clicks Download the cache will already be ready — zero AI latency.
        precomputeTemplateData(
          savedDoc._id,
          fullText,
          userIdStr,
          type,
          { company: job.company, role: job.role },
          candidateName
        ).catch((err) =>
          console.error("[generate] template data pre-compute failed:", err)
        );

        controller.close();
      } catch (err) {
        streamErrored = true;
        console.error("[generate] streaming error:", err);
        // Cost is only recorded after finalMessage() resolves; if we errored
        // before that, no cost was recorded — nothing to refund.
        controller.error(err);
      }
    },
    cancel() {
      // Client disconnected mid-stream. Cost is recorded only after
      // finalMessage() resolves (inside start()), so if we cancel before
      // that, no cost is charged. No action needed here.
      void streamErrored; // suppress unused-variable lint
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ─── Template data pre-computation ───────────────────────────────────────────

async function precomputeTemplateData(
  docId: string,
  content: string,
  userId: string,
  type: "resume" | "cover_letter",
  job: { company: string; role: string },
  candidateName: string
): Promise<void> {
  const adminTemplate = await templates.get(type as TemplateType);
  if (!adminTemplate) return;

  const HAIKU_MODEL = "claude-haiku-4-5-20251001";

  const { system, userMessage } =
    type === "resume"
      ? buildResumeExtractionPrompt({ markdown: content })
      : buildCoverLetterExtractionPrompt({
          markdown: content,
          company: job.company,
          role: job.role,
          candidateName,
        });

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const cost = calculateCost(HAIKU_MODEL, response.usage.input_tokens, response.usage.output_tokens);
  await addSpend(userId, "aiGeneration", cost).catch((err) =>
    console.error("[addSpend failed]", err)
  );

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  const jsonMatch = /\{[\s\S]*\}/.exec(raw);
  if (!jsonMatch) return;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return;
  }

  await documents.setTemplateData(
    docId,
    (adminTemplate._id as { toString(): string }).toString(),
    data
  );
}
