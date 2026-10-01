import "server-only";

import * as jobs from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import * as documents from "@/lib/repositories/documents";
import * as usage from "@/lib/repositories/usage";
import * as usageEvents from "@/lib/repositories/usage-events";
import type { JobSeedInput } from "@/lib/repositories/jobs";
import { demoAnalysis, demoPrep, demoStructuredDocument } from "@/lib/demo-fixtures";
import { DEMO_PERSONA, personaResumeMarkdown } from "@/lib/demo-persona";


const DEMO_SEED_MODEL = "claude-sonnet-4-5 (demo fixture)";

const DAY_MS = 24 * 60 * 60 * 1000;

type SeedKey = "screening" | "assessment" | "interview";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

/**
 * Jobs are spread across every status and backdated over roughly ten weeks so
 * the tracker has real shape: a funnel that narrows, eight weeks of activity to
 * chart, and a few applications old enough to trip the stale threshold (14 days
 * without an update while still in "applied").
 */
const JOB_SEEDS: Array<{
  company: string;
  role: string;
  location: string;
  salary?: string;
  status: JobSeedInput["status"];
  /** Days ago the job was created. */
  created: number;
  /** Days ago it was last touched. Drives the stale-application widget. */
  updated: number;
  /** Days ago it was applied to. Drives the weekly activity chart. */
  applied?: number;
  notes?: string;
  jobDescription?: string;
  /** Marks the jobs that get pre-generated AI documents in seedDocuments(). */
  seedKey?: SeedKey;
}> = [
  // --- Terminal: rejected -------------------------------------------------
  {
    company: "Ledgerline",
    role: "Senior Full Stack Engineer",
    location: "Remote (US)",
    salary: "$180k - $220k",
    status: "rejected",
    created: 68,
    updated: 41,
    applied: 66,
    notes: "Rejected after the system design round. Feedback: wanted deeper distributed systems experience.",
  },
  {
    company: "Paperkite",
    role: "Product Engineer",
    location: "San Francisco, CA",
    salary: "$170k - $200k",
    status: "rejected",
    created: 61,
    updated: 47,
    applied: 60,
    notes: "No response after the take-home. Closed the loop myself.",
  },
  {
    company: "Toolhouse",
    role: "Full Stack Engineer",
    location: "Remote",
    status: "rejected",
    created: 55,
    updated: 38,
    applied: 54,
  },
  // --- Terminal: withdrawn ------------------------------------------------
  {
    company: "Granite Analytics",
    role: "Software Engineer, Platform",
    location: "New York, NY",
    status: "withdrawn",
    created: 58,
    updated: 44,
    applied: 57,
    notes: "Withdrew. Onsite requirement was five days a week.",
  },
  // --- Applied and gone quiet (stale: updated > 14 days ago) --------------
  {
    company: "Cardinal Finance",
    role: "Senior Software Engineer",
    location: "Remote (US)",
    salary: "$190k - $230k",
    status: "applied",
    created: 34,
    updated: 33,
    applied: 33,
  },
  {
    company: "Gridwork",
    role: "Full Stack Engineer, Growth",
    location: "Remote",
    salary: "$165k - $195k",
    status: "applied",
    created: 29,
    updated: 28,
    applied: 28,
  },
  {
    company: "Canvasly",
    role: "Senior Frontend Engineer",
    location: "Remote (US)",
    status: "applied",
    created: 24,
    updated: 23,
    applied: 23,
  },
  {
    company: "Watchpoint",
    role: "Software Engineer, Backend",
    location: "San Francisco, CA",
    salary: "$175k - $205k",
    status: "applied",
    created: 19,
    updated: 18,
    applied: 18,
  },
  // --- Applied recently (not yet stale) -----------------------------------
  {
    company: "Edgeway Networks",
    role: "Systems Engineer",
    location: "Austin, TX",
    salary: "$160k - $195k",
    status: "applied",
    created: 11,
    updated: 10,
    applied: 10,
  },
  {
    company: "Marketfield",
    role: "Senior Developer, Core",
    location: "Remote (Canada/US)",
    status: "applied",
    created: 8,
    updated: 6,
    applied: 7,
  },
  {
    company: "Tracewell",
    role: "Full Stack Engineer",
    location: "New York, NY",
    salary: "$185k - $215k",
    status: "applied",
    created: 5,
    updated: 4,
    applied: 4,
  },
  // --- In flight: screening -----------------------------------------------
  {
    company: "Northstar AI",
    seedKey: "screening",
    role: "Full Stack Engineer, Product",
    location: "San Francisco, CA",
    salary: "$200k - $260k",
    status: "screening",
    created: 16,
    updated: 3,
    applied: 15,
    notes: "Recruiter screen went well. Technical phone screen scheduled for next week.",
    jobDescription:
      "We are looking for a Full Stack Engineer to build product surfaces on top of our models. You will work across a TypeScript and React frontend and a Python backend, own features end to end, and partner closely with research. We value engineers who can move fast without breaking the things that matter.\n\nRequirements:\n- 5+ years building and shipping production web applications\n- Strong TypeScript and React, including modern server-rendering patterns\n- Comfort designing and evolving relational or document data models\n- Experience integrating third-party APIs, including streaming responses\n- A bias toward clear written communication",
  },
  {
    company: "Tidemark",
    role: "Product Engineer",
    location: "Remote (Europe/US)",
    salary: "$170k - $210k",
    status: "screening",
    created: 13,
    updated: 2,
    applied: 12,
    notes: "Founder screen booked. Worth rereading their engineering blog first.",
  },
  // --- In flight: assessment ----------------------------------------------
  {
    company: "Framewise",
    seedKey: "assessment",
    role: "Senior Software Engineer, Framework",
    location: "Remote",
    salary: "$190k - $240k",
    status: "assessment",
    created: 21,
    updated: 2,
    applied: 20,
    notes: "Take-home: build a small streaming UI. Due Friday.",
    jobDescription:
      "Join the team building our open source web framework. You will work on the framework itself, on the rendering and caching layers, and on the developer experience that thousands of teams rely on daily.\n\nRequirements:\n- Deep React expertise, including Server Components\n- Experience with build tooling, bundlers, or compilers\n- Strong systems thinking and a track record of shipping developer-facing work\n- Open source contributions are a plus",
  },
  {
    company: "Quarry Data",
    role: "Full Stack Engineer",
    location: "Remote",
    status: "assessment",
    created: 18,
    updated: 5,
    applied: 17,
  },
  // --- In flight: interview -----------------------------------------------
  {
    company: "Pixelfold",
    seedKey: "interview",
    role: "Senior Product Engineer",
    location: "San Francisco, CA",
    salary: "$195k - $245k",
    status: "interview",
    created: 26,
    updated: 1,
    applied: 25,
    notes: "Onsite loop next Tuesday: system design, two coding rounds, values interview.",
    jobDescription:
      "Pixelfold is looking for a Senior Product Engineer to build collaborative editing features used by millions. You will work on real-time multiplayer surfaces, own complex frontend architecture, and collaborate with design on interactions that feel instant.\n\nRequirements:\n- 6+ years of product engineering experience\n- Expert-level TypeScript and React\n- Experience with real-time collaboration or conflict resolution\n- Strong product intuition and an eye for craft",
  },
  {
    company: "Kiln Cloud",
    role: "Senior Full Stack Engineer",
    location: "Remote (US)",
    salary: "$175k - $210k",
    status: "interview",
    created: 23,
    updated: 4,
    applied: 22,
    notes: "Two rounds down, one to go. Team seems strong.",
  },
  // --- Offers -------------------------------------------------------------
  {
    company: "Orbital DB",
    role: "Senior Software Engineer",
    location: "Remote (US)",
    salary: "$185k base + equity",
    status: "offer",
    created: 38,
    updated: 2,
    applied: 37,
    notes: "Verbal offer received. Written offer due this week. Negotiating base.",
  },
  {
    company: "Skylane",
    role: "Full Stack Engineer",
    location: "Remote",
    salary: "$170k base + equity",
    status: "offer",
    created: 31,
    updated: 6,
    applied: 30,
    notes: "Offer in hand, expires in 10 days.",
  },
  // --- Saved, not yet applied ---------------------------------------------
  {
    company: "Codewright",
    role: "Full Stack Engineer, Developer Tools",
    location: "San Francisco, CA",
    salary: "$180k - $220k",
    status: "saved",
    created: 4,
    updated: 4,
  },
  {
    company: "Inkwell Mail",
    role: "Founding Engineer",
    location: "Remote",
    status: "saved",
    created: 3,
    updated: 3,
  },
  {
    company: "Keystone Auth",
    role: "Senior Full Stack Engineer",
    location: "Remote (US)",
    salary: "$175k - $205k",
    status: "saved",
    created: 2,
    updated: 2,
  },
  {
    company: "Lamplight",
    role: "Software Engineer, Console",
    location: "Remote",
    status: "saved",
    created: 1,
    updated: 1,
  },
];

const RESUME_SEEDS = [
  {
    title: "Full Stack Engineer (primary)",
    isDefault: true,
    content: personaResumeMarkdown("primary"),
  },
  {
    title: "Backend-leaning variant",
    isDefault: false,
    content: personaResumeMarkdown("backend"),
  },
];

/**
 * How many records the sample data creates per collection. The per-demo
 * creation caps in src/lib/demo-accounts.ts are measured on top of these.
 */
export const DEMO_SEED_COUNTS = {
  jobs: JOB_SEEDS.length,
  resumes: RESUME_SEEDS.length,
} as const;

/** Removes every piece of demo content. Does not touch the user record itself. */
export async function wipeDemoData(userId: string): Promise<void> {
  await Promise.all([
    documents.deleteAllForUser(userId),
    jobs.deleteAllForUser(userId),
    resumes.deleteAllForUser(userId),
    // Demo generations are served from fixtures and should never cost
    // anything, but any spend that does slip through belongs to the demo and
    // must go with it, so a deleted demo leaves no usage records behind.
    usage.deleteAllForUser(userId),
    usageEvents.deleteAllForUser(userId),
  ]);
}

export type SeedSummary = {
  jobs: number;
  resumes: number;
  documents: number;
};

/**
 * Restores the demo account to its known-good state. Safe to run repeatedly:
 * it wipes first, so a visitor who spent the afternoon deleting things gets
 * everything back on the next run.
 */
export async function seedDemoData(userId: string): Promise<SeedSummary> {
  await wipeDemoData(userId);

  const createdJobs = await jobs.createSeededMany(
    userId,
    JOB_SEEDS.map((seed) => ({
      company: seed.company,
      role: seed.role,
      location: seed.location,
      salary: seed.salary,
      status: seed.status,
      notes: seed.notes,
      jobDescription: seed.jobDescription,
      appliedAt: seed.applied !== undefined ? daysAgo(seed.applied) : null,
      createdAt: daysAgo(seed.created),
      updatedAt: daysAgo(seed.updated),
    }))
  );

  const createdResumes = [];
  for (const seed of RESUME_SEEDS) {
    createdResumes.push(await resumes.create(userId, seed));
  }

  // insertMany keeps input order, so createdJobs[i] is JOB_SEEDS[i].
  const seededByKey = new Map<SeedKey, { _id: string; company: string; role: string }>();
  JOB_SEEDS.forEach((seed, i) => {
    if (seed.seedKey && createdJobs[i]) seededByKey.set(seed.seedKey, createdJobs[i]);
  });

  const documentCount = await seedDocuments(userId, seededByKey);

  return {
    jobs: createdJobs.length,
    resumes: createdResumes.length,
    documents: documentCount,
  };
}

/**
 * Pre-generates AI output for the jobs that carry a job description, so the
 * generation panels are populated the moment a visitor opens them rather than
 * showing an empty state.
 */
async function seedDocuments(
  userId: string,
  seeded: Map<SeedKey, { _id: string; company: string; role: string }>
): Promise<number> {
  let count = 0;

  const screening = seeded.get("screening");
  const interview = seeded.get("interview");
  const assessment = seeded.get("assessment");

  if (screening) {
    // Built through the same fixture path the Generate button uses, so the
    // document carries structuredContent. Writing only markdown here meant the
    // seeded cover letter could not be exported to LaTeX at all: that branch
    // re-validates structuredContent and returns 422 without it.
    await demoStructuredDocument(userId, screening, "cover_letter");
    await demoStructuredDocument(userId, screening, "resume");
    count += 2;

  }

  // JD analyses are stored as JSON, not markdown, matching what a real
  // analysis saves, so the job page can show them.
  for (const job of [screening, interview, assessment].filter((j) => j !== undefined)) {
    await documents.upsert(userId, {
      jobId: job._id,
      type: "jd_analysis",
      content: JSON.stringify(demoAnalysis(job)),
      structuredContent: demoAnalysis(job) as unknown as Record<string, unknown>,
      aiModel: DEMO_SEED_MODEL,
      inputTokens: 1820,
      outputTokens: 744,
    });
    count += 1;
  }

  if (interview) {
    // Stored as JSON, like a real generation: the job page JSON.parses it.
    // Seeding markdown here left the panel empty.
    const prep = demoPrep(interview);
    await documents.upsert(userId, {
      jobId: interview._id,
      type: "interview_prep",
      content: JSON.stringify(prep),
      structuredContent: prep as unknown as Record<string, unknown>,
      aiModel: DEMO_SEED_MODEL,
      inputTokens: 1960,
      outputTokens: 880,
    });
    count += 1;
  }

  if (assessment) {
    await documents.upsert(userId, {
      jobId: assessment._id,
      type: "followup_email",
      content: DEMO_FOLLOWUP_EMAIL,
      aiModel: DEMO_SEED_MODEL,
      inputTokens: 940,
      outputTokens: 210,
    });
    count += 1;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Pre-generated AI content
// ---------------------------------------------------------------------------

const DEMO_FOLLOWUP_EMAIL = `Subject: Following up on the take-home

Hi Sam,

I submitted the take-home on Friday, so I wanted to check in briefly and confirm it
arrived.

One note that may be useful context: I spent most of the time on the streaming layer
rather than the styling, on the assumption that the interesting part of the brief was
rendering partial state well. If the intent was the opposite I am happy to talk through
how I would approach it differently.

Still very interested in the role, and glad to go into any of the decisions in more
detail.

Best,
${DEMO_PERSONA.firstName}`;
