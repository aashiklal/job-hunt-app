import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Types } from "mongoose";
import { startTestMongo, stopTestMongo } from "@/test/mongo";
import Job from "@/lib/models/Job";
import Resume from "@/lib/models/Resume";
import Doc from "@/lib/models/Document";
import { jobGenerationRequestSchema } from "@/lib/job-ai-generation";
import {
  demoAnalysis,
  demoOutreach,
  demoParsedJob,
  demoPrep,
  demoSkillsGap,
} from "@/lib/demo-fixtures";
import { seedDemoData } from "@/lib/demo-seed";

/**
 * Demo content is shown to anonymous visitors, so it must describe a fictional
 * person. An earlier persona retold this app's own history (the metering
 * race, the "Job Hunt" project) and read as the developer's real resume, and
 * the sample jobs pinned invented rejections on real employers. These checks
 * keep both from creeping back.
 */
const FORBIDDEN = [
  "job hunt",
  "metered",
  "metering",
  "concurrency",
  "check-then-act",
  "spend limit",
  "alex morgan",
  "meridian labs",
  "stripe",
  "anthropic",
  "figma",
  "vercel",
];

function findForbidden(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN.filter((term) => lower.includes(term));
}

const JOB = { _id: "job1", company: "Example Co", role: "Product Engineer" };

describe("demo fixtures", () => {
  it("has a fixture for every generation type", () => {
    const structured = new Set(["resume", "cover_letter", "jd_analysis", "interview_prep"]);
    for (const type of jobGenerationRequestSchema.shape.type.options) {
      if (structured.has(type)) continue;
      expect(demoOutreach(type, JOB), type).not.toContain("No demo fixture");
    }
  });

  it("contains nothing personal or tied to real companies", () => {
    const text = JSON.stringify([
      jobGenerationRequestSchema.shape.type.options.map((t) => demoOutreach(t, JOB)),
      demoAnalysis(JOB),
      demoPrep(JOB),
      demoSkillsGap(),
      demoParsedJob(),
    ]);
    expect(findForbidden(text)).toEqual([]);
  });
});

describe("demo seed", () => {
  const userId = new Types.ObjectId().toString();

  beforeAll(async () => {
    await startTestMongo();
    await seedDemoData(userId);
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("contains nothing personal or tied to real companies", async () => {
    const [jobs, resumes, docs] = await Promise.all([
      Job.find({ userId }).lean(),
      Resume.find({ userId }).lean(),
      Doc.find({ userId }).lean(),
    ]);
    expect(jobs.length).toBeGreaterThan(0);
    expect(docs.length).toBeGreaterThan(0);
    // Model labels mention the Claude model name; only the content matters.
    const text = JSON.stringify([
      jobs,
      resumes,
      docs.map((d) => [d.content, d.structuredContent]),
    ]);
    expect(findForbidden(text)).toEqual([]);
  });

  it("stores interview prep as JSON the job page can parse", async () => {
    const prep = await Doc.findOne({ userId, type: "interview_prep" }).lean();
    expect(prep).not.toBeNull();
    const parsed = JSON.parse(prep!.content);
    expect(parsed.behavioral.length).toBeGreaterThan(0);
  });
});
