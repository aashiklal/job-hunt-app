import "server-only";
import * as resumes from "@/lib/repositories/resumes";
import * as jobs from "@/lib/repositories/jobs";
import * as documents from "@/lib/repositories/documents";
import * as starStories from "@/lib/repositories/star-stories";
import type { DocumentType } from "@/lib/repositories/documents";

/**
 * Getting-started tour.
 *
 * Progress is derived entirely from records the user has already created
 * (no separate counters) so it always reflects reality and needs no
 * bookkeeping of its own. Matches the minimum job description length already
 * enforced by JD analysis in job-ai-generation.ts's handleJDAnalysis.
 */

const JD_MIN_LENGTH = 50;

const OUTREACH_TYPES: readonly DocumentType[] = [
  "linkedin_note",
  "linkedin_dm",
  "followup_email",
  "thankyou_email",
  "linkedin_followup_dm",
  "cold_email",
  "checkin_email",
  "salary_negotiation",
];

export type OnboardingStepId =
  | "add_resume"
  | "add_job"
  | "analyze_jd"
  | "tailor_resume"
  | "write_cover_letter"
  | "prep_interview"
  | "draft_outreach"
  | "polish_story";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  description: string;
  done: boolean;
  /** Where to send the user next. Null when there's no sensible target yet. */
  href: string | null;
};

export type OnboardingProgress = {
  steps: OnboardingStep[];
  /** First not-done step, in order. Null once everything is done. */
  currentStep: OnboardingStep | null;
  complete: boolean;
  currentJobId: string | null;
};

export async function getOnboardingProgress(userId: string): Promise<OnboardingProgress> {
  const [resumeList, jobList, storyList] = await Promise.all([
    resumes.list(userId),
    jobs.list(userId),
    starStories.list(userId),
  ]);

  const hasResume = resumeList.length > 0;

  const qualifyingJobs = jobList
    .filter((j) => (j.jobDescription?.trim().length ?? 0) >= JD_MIN_LENGTH)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const currentJobId = qualifyingJobs[0]?._id ?? null;

  const jobDocs = currentJobId ? await documents.list(userId, currentJobId) : [];
  const hasJDAnalysis = jobDocs.some((d) => d.type === "jd_analysis");
  const hasTailoredResume = jobDocs.some((d) => d.type === "resume");
  const hasCoverLetter = jobDocs.some((d) => d.type === "cover_letter");
  const hasInterviewPrep = jobDocs.some((d) => d.type === "interview_prep");
  const hasOutreach = jobDocs.some((d) => OUTREACH_TYPES.includes(d.type));

  const polishedStory = storyList.find((s) => Boolean(s.polishedOutput));

  const steps: OnboardingStep[] = [
    {
      id: "add_resume",
      label: "Add a base resume",
      description: "Upload or paste your resume so the AI has something to tailor.",
      done: hasResume,
      href: "/resume/new",
    },
    {
      id: "add_job",
      label: "Add a job with a description",
      description: "Paste a job posting so we can analyze it.",
      done: currentJobId !== null,
      href: "/jobs/new",
    },
    {
      id: "analyze_jd",
      label: "Analyze the job description",
      description: "See required skills, keywords, and red flags.",
      done: hasJDAnalysis,
      href: currentJobId ? `/jobs/${currentJobId}#prep` : null,
    },
    {
      id: "tailor_resume",
      label: "Tailor your resume",
      description: "Generate a version of your resume aimed at this job.",
      done: hasTailoredResume,
      href: currentJobId ? `/jobs/${currentJobId}#documents` : null,
    },
    {
      id: "write_cover_letter",
      label: "Write a cover letter",
      description: "Generate a cover letter for this job.",
      done: hasCoverLetter,
      href: currentJobId ? `/jobs/${currentJobId}#documents` : null,
    },
    {
      id: "prep_interview",
      label: "Prep for the interview",
      description: "Get likely questions and hints for this role.",
      done: hasInterviewPrep,
      href: currentJobId ? `/jobs/${currentJobId}#prep` : null,
    },
    {
      id: "draft_outreach",
      label: "Draft an outreach message",
      description: "Write a note, DM, or email tied to this job.",
      done: hasOutreach,
      href: currentJobId ? `/jobs/${currentJobId}#outreach` : null,
    },
    {
      id: "polish_story",
      label: "Polish a STAR story",
      description: "Turn a rough behavioral answer into STAR format.",
      done: Boolean(polishedStory),
      href: polishedStory ? `/star-stories/${polishedStory._id}` : "/star-stories/new",
    },
  ];

  const currentStep = steps.find((s) => !s.done) ?? null;

  return { steps, currentStep, complete: currentStep === null, currentJobId };
}
