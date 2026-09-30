import "server-only";

import * as jobs from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import * as offers from "@/lib/repositories/offers";
import * as starStories from "@/lib/repositories/star-stories";
import * as documents from "@/lib/repositories/documents";
import * as usage from "@/lib/repositories/usage";
import * as usageEvents from "@/lib/repositories/usage-events";
import type { JobSeedInput } from "@/lib/repositories/jobs";
import { demoAnalysis, demoStructuredDocument } from "@/lib/demo-fixtures";


const DEMO_SEED_MODEL = "claude-sonnet-4-5 (demo fixture)";

const DAY_MS = 24 * 60 * 60 * 1000;

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
}> = [
  // --- Terminal: rejected -------------------------------------------------
  {
    company: "Stripe",
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
    company: "Notion",
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
    company: "Retool",
    role: "Full Stack Engineer",
    location: "Remote",
    status: "rejected",
    created: 55,
    updated: 38,
    applied: 54,
  },
  // --- Terminal: withdrawn ------------------------------------------------
  {
    company: "Palantir",
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
    company: "Ramp",
    role: "Senior Software Engineer",
    location: "Remote (US)",
    salary: "$190k - $230k",
    status: "applied",
    created: 34,
    updated: 33,
    applied: 33,
  },
  {
    company: "Airtable",
    role: "Full Stack Engineer, Growth",
    location: "Remote",
    salary: "$165k - $195k",
    status: "applied",
    created: 29,
    updated: 28,
    applied: 28,
  },
  {
    company: "Webflow",
    role: "Senior Frontend Engineer",
    location: "Remote (US)",
    status: "applied",
    created: 24,
    updated: 23,
    applied: 23,
  },
  {
    company: "Sentry",
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
    company: "Cloudflare",
    role: "Systems Engineer",
    location: "Austin, TX",
    salary: "$160k - $195k",
    status: "applied",
    created: 11,
    updated: 10,
    applied: 10,
  },
  {
    company: "Shopify",
    role: "Senior Developer, Core",
    location: "Remote (Canada/US)",
    status: "applied",
    created: 8,
    updated: 6,
    applied: 7,
  },
  {
    company: "Datadog",
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
    company: "Anthropic",
    role: "Full Stack Engineer, Product",
    location: "San Francisco, CA",
    salary: "$200k - $260k",
    status: "screening",
    created: 16,
    updated: 3,
    applied: 15,
    notes: "Recruiter screen went well. Technical phone screen scheduled for next week.",
    jobDescription:
      "We are looking for a Full Stack Engineer to build product surfaces on top of our models. You will work across a TypeScript and React frontend and a Python backend, own features end to end, and partner closely with research. We value engineers who can move fast without breaking the things that matter.\n\nRequirements:\n- 5+ years building and shipping production web applications\n- Strong TypeScript and React, including modern server-rendering patterns\n- Comfort designing and evolving relational or document data models\n- Experience integrating with LLM APIs, including streaming responses\n- A bias toward clear written communication",
  },
  {
    company: "Linear",
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
    company: "Vercel",
    role: "Senior Software Engineer, Next.js",
    location: "Remote",
    salary: "$190k - $240k",
    status: "assessment",
    created: 21,
    updated: 2,
    applied: 20,
    notes: "Take-home: build a small streaming UI. Due Friday.",
    jobDescription:
      "Join the team building Next.js. You will work on the framework itself, on the rendering and caching layers, and on the developer experience that millions of engineers rely on daily.\n\nRequirements:\n- Deep React expertise, including Server Components\n- Experience with build tooling, bundlers, or compilers\n- Strong systems thinking and a track record of shipping developer-facing work\n- Open source contributions are a plus",
  },
  {
    company: "Supabase",
    role: "Full Stack Engineer",
    location: "Remote",
    status: "assessment",
    created: 18,
    updated: 5,
    applied: 17,
  },
  // --- In flight: interview -----------------------------------------------
  {
    company: "Figma",
    role: "Senior Product Engineer",
    location: "San Francisco, CA",
    salary: "$195k - $245k",
    status: "interview",
    created: 26,
    updated: 1,
    applied: 25,
    notes: "Onsite loop next Tuesday: system design, two coding rounds, values interview.",
    jobDescription:
      "Figma is looking for a Senior Product Engineer to build collaborative editing features used by millions. You will work on real-time multiplayer surfaces, own complex frontend architecture, and collaborate with design on interactions that feel instant.\n\nRequirements:\n- 6+ years of product engineering experience\n- Expert-level TypeScript and React\n- Experience with real-time collaboration or conflict resolution\n- Strong product intuition and an eye for craft",
  },
  {
    company: "Render",
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
    company: "PlanetScale",
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
    company: "Fly.io",
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
    company: "Replit",
    role: "Full Stack Engineer, Agents",
    location: "San Francisco, CA",
    salary: "$180k - $220k",
    status: "saved",
    created: 4,
    updated: 4,
  },
  {
    company: "Resend",
    role: "Founding Engineer",
    location: "Remote",
    status: "saved",
    created: 3,
    updated: 3,
  },
  {
    company: "Clerk",
    role: "Senior Full Stack Engineer",
    location: "Remote (US)",
    salary: "$175k - $205k",
    status: "saved",
    created: 2,
    updated: 2,
  },
  {
    company: "Neon",
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
    content: `# Alex Morgan
alex.morgan@example.com | San Francisco, CA | github.com/example | linkedin.com/in/example

## Summary
Full stack engineer with 7 years building and operating production web applications.
Depth in TypeScript, React and Node, with a track record of owning features from data
model through to interface. Comfortable working close to the product and to the database.

## Experience

### Senior Software Engineer, Meridian Labs
2021 - Present | San Francisco, CA
- Led the migration of a 200k-line React application to server-side rendering, cutting
  median time to interactive from 4.1s to 1.3s.
- Designed the billing and metering subsystem handling roughly 40k priced events per day,
  including the idempotency and reconciliation logic behind it.
- Introduced the team's testing strategy, taking a codebase from no automated coverage to
  a deterministic suite running on every pull request.
- Mentored four engineers, two of whom were promoted within eighteen months.

### Software Engineer, Northwind Systems
2018 - 2021 | Remote
- Built the customer-facing analytics dashboard used by roughly 8,000 accounts.
- Replaced a nightly batch pipeline with an incremental one, reducing data latency from
  18 hours to under 5 minutes.
- Owned on-call for the ingestion service and drove a reduction in paging volume of 60%.

### Junior Developer, Cobalt Interactive
2017 - 2018 | Portland, OR
- Shipped features across a Rails monolith and a React frontend.

## Skills
TypeScript, JavaScript, React, Next.js, Node.js, Python, PostgreSQL, MongoDB, Redis,
Docker, AWS, CI/CD, system design, technical writing

## Education
BSc Computer Science, University of Oregon, 2017`,
  },
  {
    title: "Backend-leaning variant",
    isDefault: false,
    content: `# Alex Morgan
alex.morgan@example.com | San Francisco, CA

## Summary
Backend-focused engineer with 7 years of experience in distributed systems, data
modelling and API design. Equally comfortable owning a service end to end or going deep
on a performance problem.

## Experience

### Senior Software Engineer, Meridian Labs
2021 - Present
- Designed and operated the metering and billing subsystem, including the concurrency
  controls that make spend limits hold under parallel load.
- Reduced p99 API latency from 850ms to 190ms by restructuring the hot query path and
  introducing targeted indexes.
- Owned the service's observability: structured logging, tracing and alerting.

### Software Engineer, Northwind Systems
2018 - 2021
- Replaced a nightly batch pipeline with an incremental streaming one.
- Built and operated the ingestion service handling roughly 12M events per day.

## Skills
Node.js, TypeScript, Python, PostgreSQL, MongoDB, Redis, Kafka, Docker, Kubernetes, AWS,
distributed systems, observability

## Education
BSc Computer Science, University of Oregon, 2017`,
  },
];

const OFFER_SEEDS = [
  {
    company: "PlanetScale",
    role: "Senior Software Engineer",
    baseSalary: 185000,
    currency: "USD",
    equity: "0.08% over 4 years, 1 year cliff",
    bonus: "10% annual target",
    leaveDays: 20,
    location: "Remote (US)",
    remotePolicy: "fully_remote" as const,
    roleLevel: "Senior (L5)",
    notes: "Strong infra team. Equity is the largest of the three but the company is earlier stage.",
  },
  {
    company: "Fly.io",
    role: "Full Stack Engineer",
    baseSalary: 170000,
    currency: "USD",
    equity: "0.05% over 4 years",
    bonus: "None",
    leaveDays: 25,
    location: "Remote",
    remotePolicy: "fully_remote" as const,
    roleLevel: "Senior",
    notes: "Lowest base but the most generous leave and the most autonomy.",
  },
  {
    company: "Datadog",
    role: "Full Stack Engineer",
    baseSalary: 195000,
    currency: "USD",
    equity: "RSUs, roughly $60k over 4 years",
    bonus: "15% annual target",
    leaveDays: 15,
    location: "New York, NY",
    remotePolicy: "hybrid" as const,
    roleLevel: "Senior (P3)",
    notes: "Highest total compensation, but three days a week onsite in NYC and the least leave.",
  },
];

const STAR_STORY_SEEDS = [
  {
    title: "Migrating a 200k-line app to server rendering",
    tags: ["technical leadership", "performance", "migration"],
    roughDraft:
      "Our main app was a client-rendered React SPA and it had got slow. Time to interactive was over 4 seconds on the median and customers were complaining. I proposed moving to server-side rendering. Had to convince the team because it was a big change and people were worried about the risk. We did it incrementally, route by route, behind a flag. Took about five months. Ended up at 1.3 seconds median TTI. Also cut our bundle by about 40%.",
    polished: `**Situation**
Our primary customer-facing application was a client-rendered React SPA of roughly 200,000 lines. Median time to interactive had degraded to 4.1 seconds, and slow initial load had become the most common theme in customer support tickets and a recurring objection in sales calls.

**Task**
I proposed moving the application to server-side rendering. As the senior engineer on the team I owned both the technical design and the job of getting a sceptical team to agree to a migration of that size.

**Action**
Rather than ask for a rewrite, I built a proof of concept on a single high-traffic route and presented measured numbers instead of projections. I then designed an incremental path: an adapter layer letting server-rendered and client-rendered routes coexist, so we could migrate route by route behind a feature flag and roll back independently at any point. I sequenced the work highest-traffic-first so the benefit compounded early, wrote the migration guide the rest of the team worked from, and reviewed every migration pull request to keep the patterns consistent.

**Result**
We completed the migration across five months with no customer-visible incidents. Median time to interactive fell from 4.1 seconds to 1.3 seconds and the client bundle shrank by 40%. Load-related support tickets dropped by roughly two thirds the quarter after completion. The adapter layer was reused by two other teams for their own migrations.`,
  },
  {
    title: "Finding a concurrency bug in the billing path",
    tags: ["debugging", "correctness", "ownership"],
    roughDraft:
      "We had spend limits on our metered API. Noticed some accounts going over their limit. Turned out the check and the charge were separate operations with a gap between them, so parallel requests all read the same number and all passed. Fixed it with an atomic conditional update. Wrote a test that fired a bunch of parallel requests to prove it.",
    polished: `**Situation**
Our metered API enforced a per-account spend limit. During a routine reconciliation I noticed a handful of accounts had exceeded their ceiling by a meaningful margin, which should have been impossible.

**Task**
I took ownership of finding the cause and making the limit actually hold, since the discrepancy was being absorbed as cost.

**Action**
Reading the code, I found the enforcement was a check-then-act sequence: the service read the account's current spend, compared it to the limit, then made the expensive downstream call, and only recorded the charge after that call returned. The gap between the read and the write was several seconds wide, so concurrent requests all read the same stale total and all passed the check. I reproduced it deterministically with a test that fired twenty parallel requests against an account one unit below its limit and asserted only one should succeed. It failed exactly as predicted. I replaced the sequence with a single atomic conditional update that increments a reservation only when the account is under its limit, and reconciles to the true cost once the downstream call returns, refunding the reservation on failure.

**Result**
Overruns went to zero. The reproduction test went into the suite and now guards the invariant on every change. I wrote the failure mode up internally, which surfaced the same pattern in two other services where it had not yet caused visible damage.`,
  },
  {
    title: "Disagreeing with a technical decision",
    tags: ["conflict", "communication", "judgement"],
    roughDraft:
      "Team wanted to add a message queue for a feature I thought was simpler than that. I disagreed but I was the newer person on the team. Asked to prototype the simple version first. It worked fine and we shipped it in a week instead of a month. Tried not to make it a fight about being right.",
    polished: `**Situation**
Shortly after joining, the team was planning a notifications feature and the proposed design introduced a message queue and a new worker service. Based on the actual volume, roughly a few thousand events a day, I thought the added operational surface was not justified.

**Task**
I wanted to argue for a simpler design without being the new person telling an established team they were wrong.

**Action**
I asked questions before asserting anything, and learned the design was partly anticipating a scale target nobody had validated. Rather than debate in the abstract I asked for two days to prototype the simpler approach using the database we already ran. I brought back working code, load-test numbers at ten times our current volume, and an honest account of where it would break and what signal would tell us we had reached that point. I framed it as buying an option rather than as a rebuttal, and said plainly that I would support the queue if the numbers did not hold up.

**Result**
The team chose the simpler design. It shipped in a week rather than the estimated month and has run without incident since, still comfortably inside the limits we identified. The written trigger conditions became the team's habit for deferred complexity. What I took from it is that a prototype and a number move a conversation in a way that an opinion does not.`,
  },
  {
    title: "Taking a codebase from zero tests to a real suite",
    tags: ["quality", "influence", "process"],
    roughDraft:
      "Codebase had no automated tests when I joined. Every release was manual QA and things kept regressing. I didn't try to mandate coverage, just started writing tests for the bugs we actually hit. Made failures visible. Eventually got CI in. Regression rate dropped a lot.",
    polished: `**Situation**
The codebase I inherited had no automated tests. Every release depended on a manual QA pass, and the same categories of regression kept recurring, roughly one significant one per release.

**Task**
I wanted the team testing routinely, but a coverage mandate imposed by one engineer tends to produce resentment and low-value tests rather than confidence.

**Action**
I started narrow. For every production bug we hit, I wrote the regression test before the fix, so each test was visibly tied to real pain rather than to an abstract standard. I made the value legible by noting in each pull request which past incident the test would have caught. Once a handful of engineers were doing this unprompted, I set up CI to run the suite on every pull request, and separately built out the parts that were hardest to test by hand: the money paths and the permission checks. I deliberately did not set a coverage target.

**Result**
Within two quarters the suite ran on every pull request and regressions per release fell from roughly one to under one every five. Manual QA shifted from re-checking known paths to genuine exploratory testing. The practice outlasted me on that team, which I take as the better signal.`,
  },
  {
    title: "Cutting data latency from 18 hours to 5 minutes",
    tags: ["architecture", "data", "impact"],
    roughDraft:
      "Analytics dashboard ran off a nightly batch job so customers were always looking at yesterday. Rebuilt it as an incremental pipeline. Tricky part was backfill and making sure we didn't double count. Got it to about 5 minutes end to end.",
    polished: `**Situation**
Our customer-facing analytics dashboard was populated by a nightly batch job, so roughly 8,000 accounts were always looking at data up to 18 hours stale. It was the single most requested improvement in customer feedback.

**Task**
I owned the redesign, with the constraint that we could not have a period of incorrect numbers during the transition. Customers made decisions on these figures.

**Action**
I replaced the batch job with an incremental pipeline processing events as they arrived. The genuinely hard part was correctness rather than throughput: making the processing idempotent so retries could not double-count, and designing a backfill that could run against historical data concurrently with live traffic without the two interfering. I ran both pipelines in parallel for three weeks with an automated reconciliation job comparing their outputs, and only cut over once they had agreed to the cent for a full week.

**Result**
End-to-end latency went from 18 hours to under 5 minutes. The reconciliation job found two genuine bugs during the parallel period that would otherwise have reached customers. Data freshness moved from the top of the feedback list to absent from it. I kept the reconciliation job running for a further quarter as a cheap correctness alarm.`,
  },
];

/**
 * How many records the sample data creates per collection. The per-demo
 * creation caps in src/lib/demo-accounts.ts are measured on top of these.
 */
export const DEMO_SEED_COUNTS = {
  jobs: JOB_SEEDS.length,
  resumes: RESUME_SEEDS.length,
  offers: OFFER_SEEDS.length,
  starStories: STAR_STORY_SEEDS.length,
} as const;

/** Removes every piece of demo content. Does not touch the user record itself. */
export async function wipeDemoData(userId: string): Promise<void> {
  await Promise.all([
    documents.deleteAllForUser(userId),
    jobs.deleteAllForUser(userId),
    resumes.deleteAllForUser(userId),
    offers.deleteAllForUser(userId),
    starStories.deleteAllForUser(userId),
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
  offers: number;
  starStories: number;
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

  for (const seed of OFFER_SEEDS) {
    await offers.create(userId, seed);
  }

  for (const seed of STAR_STORY_SEEDS) {
    const story = await starStories.create(userId, {
      title: seed.title,
      tags: seed.tags,
      roughDraft: seed.roughDraft,
    });
    if (seed.polished) {
      await starStories.savePolished(userId, story._id, seed.polished);
    }
  }

  const documentCount = await seedDocuments(userId, createdJobs);

  return {
    jobs: createdJobs.length,
    resumes: createdResumes.length,
    offers: OFFER_SEEDS.length,
    starStories: STAR_STORY_SEEDS.length,
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
  createdJobs: Array<{ _id: string; company: string; role: string }>
): Promise<number> {
  const byCompany = new Map(createdJobs.map((job) => [job.company, job]));
  let count = 0;

  const anthropic = byCompany.get("Anthropic");
  const figma = byCompany.get("Figma");
  const vercel = byCompany.get("Vercel");

  if (anthropic) {
    // Built through the same fixture path the Generate button uses, so the
    // document carries structuredContent. Writing only markdown here meant the
    // seeded cover letter could not be exported to LaTeX at all: that branch
    // re-validates structuredContent and returns 422 without it.
    await demoStructuredDocument(userId, anthropic, "cover_letter");
    await demoStructuredDocument(userId, anthropic, "resume");
    count += 2;

  }

  // JD analyses are stored as JSON, not markdown: /api/skills-gap reads them
  // back with JSON.parse and needs at least two before it will run. Seeding
  // one, as markdown, left the skills-gap feature permanently unreachable in
  // the demo.
  for (const job of [anthropic, figma, vercel].filter((j) => j !== undefined)) {
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

  if (figma) {
    await documents.upsert(userId, {
      jobId: figma._id,
      type: "interview_prep",
      content: DEMO_INTERVIEW_PREP,
      aiModel: DEMO_SEED_MODEL,
      inputTokens: 1960,
      outputTokens: 880,
    });
    count += 1;
  }

  if (vercel) {
    await documents.upsert(userId, {
      jobId: vercel._id,
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



const DEMO_INTERVIEW_PREP = `## Loop structure

Four rounds: system design, two coding, values. Figma interviews heavily for craft, so
expect the coding rounds to reward readable, well-factored code over raw speed.

## System design: likely prompt

Given the product, expect a real-time collaborative editing question. The most probable
framing is "design multiplayer cursors and presence for a document editor."

**Structure to follow**

1. Clarify scale first: concurrent editors per document, acceptable latency, offline
   support. Do not skip this; they are watching for it.
2. Separate presence (ephemeral, lossy, high frequency) from document state (durable,
   ordered, must converge). Conflating them is the common failure.
3. For presence: WebSocket fan-out, last-write-wins, no persistence, aggressive
   throttling on the client.
4. For document state: discuss CRDTs versus operational transformation. Know the
   trade-off: CRDTs are simpler to reason about distributed but carry metadata overhead;
   OT is more compact but needs a central server to order operations.
5. Cover reconnection and how a client catches up after a network partition.

**Where candidates lose points:** jumping to CRDT versus OT before establishing
requirements, and ignoring the reconnection path entirely.

## Coding rounds

Expect frontend-weighted problems with real interaction, not algorithm puzzles. Likely
shapes: implement a debounced multi-select with keyboard navigation, or build a small
undo/redo stack.

Practise talking while writing. Name the trade-off as you make it. Figma weights
communication during coding more than most.

For undo/redo specifically, know the command-pattern approach and be ready to discuss how
it interacts with collaborative editing, since undo in a multiplayer context should undo
your own action rather than the last global one. Raising that unprompted lands well.

## Values interview

Figma asks about craft and about disagreement. Two of your stories fit directly:

- **Disagreeing with a technical decision** maps to their collaboration signal. Your
  framing of prototyping rather than debating is the strongest part; keep it.
- **The SSR migration** covers craft and long-horizon thinking.

Prepare one story about a time your work was visibly not good enough and what you did.
They ask some version of this and a polished non-answer is worse than a real one.

## Questions to ask

- How do you balance shipping against the craft bar when they conflict?
- What does the relationship between design and engineering look like day to day?
- What is the most painful part of the current codebase?`;

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
Alex`;
