import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repositories/resumes", () => ({ list: vi.fn() }));
vi.mock("@/lib/repositories/jobs", () => ({ list: vi.fn() }));
vi.mock("@/lib/repositories/documents", () => ({ list: vi.fn() }));
vi.mock("@/lib/repositories/star-stories", () => ({ list: vi.fn() }));

import * as resumes from "@/lib/repositories/resumes";
import * as jobs from "@/lib/repositories/jobs";
import * as documents from "@/lib/repositories/documents";
import * as starStories from "@/lib/repositories/star-stories";
import { getOnboardingProgress } from "@/lib/onboarding";

const USER_ID = "64f000000000000000000001";

function job(overrides: Partial<{ _id: string; jobDescription: string; updatedAt: string }> = {}) {
  return {
    _id: "job-1",
    company: "Acme",
    role: "Engineer",
    jobDescription: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as never;
}

function doc(type: string) {
  return { type } as never;
}

beforeEach(() => {
  vi.mocked(resumes.list).mockResolvedValue([]);
  vi.mocked(jobs.list).mockResolvedValue([]);
  vi.mocked(documents.list).mockResolvedValue([]);
  vi.mocked(starStories.list).mockResolvedValue([]);
});

describe("getOnboardingProgress", () => {
  it("starts at add_resume for a brand new account", async () => {
    const progress = await getOnboardingProgress(USER_ID);
    expect(progress.complete).toBe(false);
    expect(progress.currentStep?.id).toBe("add_resume");
    expect(progress.currentJobId).toBeNull();
    expect(progress.steps.every((s) => !s.done)).toBe(true);
  });

  it("moves to add_job once a resume exists", async () => {
    vi.mocked(resumes.list).mockResolvedValue([{ _id: "r1" } as never]);
    const progress = await getOnboardingProgress(USER_ID);
    expect(progress.currentStep?.id).toBe("add_job");
  });

  it("does not count a job whose description is under the 50 character threshold", async () => {
    vi.mocked(resumes.list).mockResolvedValue([{ _id: "r1" } as never]);
    vi.mocked(jobs.list).mockResolvedValue([job({ jobDescription: "too short" })]);
    const progress = await getOnboardingProgress(USER_ID);
    expect(progress.currentStep?.id).toBe("add_job");
    expect(progress.currentJobId).toBeNull();
  });

  it("advances to analyze_jd once a job clears the description threshold", async () => {
    vi.mocked(resumes.list).mockResolvedValue([{ _id: "r1" } as never]);
    vi.mocked(jobs.list).mockResolvedValue([job({ jobDescription: "x".repeat(50) })]);
    const progress = await getOnboardingProgress(USER_ID);
    expect(progress.currentJobId).toBe("job-1");
    expect(progress.currentStep?.id).toBe("analyze_jd");
  });

  it("picks the most recently updated qualifying job when several exist", async () => {
    vi.mocked(resumes.list).mockResolvedValue([{ _id: "r1" } as never]);
    vi.mocked(jobs.list).mockResolvedValue([
      job({ _id: "older", jobDescription: "x".repeat(50), updatedAt: "2026-01-01T00:00:00.000Z" }),
      job({ _id: "newer", jobDescription: "x".repeat(50), updatedAt: "2026-02-01T00:00:00.000Z" }),
    ]);
    const progress = await getOnboardingProgress(USER_ID);
    expect(progress.currentJobId).toBe("newer");
  });

  it("flips each document-backed step as the matching document type appears", async () => {
    vi.mocked(resumes.list).mockResolvedValue([{ _id: "r1" } as never]);
    vi.mocked(jobs.list).mockResolvedValue([job({ jobDescription: "x".repeat(50) })]);
    vi.mocked(documents.list).mockResolvedValue([
      doc("jd_analysis"),
      doc("resume"),
      doc("cover_letter"),
      doc("interview_prep"),
      doc("cold_email"),
    ]);
    const progress = await getOnboardingProgress(USER_ID);
    const byId = Object.fromEntries(progress.steps.map((s) => [s.id, s.done]));
    expect(byId.analyze_jd).toBe(true);
    expect(byId.tailor_resume).toBe(true);
    expect(byId.write_cover_letter).toBe(true);
    expect(byId.prep_interview).toBe(true);
    expect(byId.draft_outreach).toBe(true);
    expect(byId.polish_story).toBe(false);
    expect(progress.currentStep?.id).toBe("polish_story");
  });

  it("is complete once every step is done", async () => {
    vi.mocked(resumes.list).mockResolvedValue([{ _id: "r1" } as never]);
    vi.mocked(jobs.list).mockResolvedValue([job({ jobDescription: "x".repeat(50) })]);
    vi.mocked(documents.list).mockResolvedValue([
      doc("jd_analysis"),
      doc("resume"),
      doc("cover_letter"),
      doc("interview_prep"),
      doc("linkedin_note"),
    ]);
    vi.mocked(starStories.list).mockResolvedValue([
      { _id: "s1", polishedOutput: "STAR version" } as never,
    ]);

    const progress = await getOnboardingProgress(USER_ID);
    expect(progress.complete).toBe(true);
    expect(progress.currentStep).toBeNull();
  });
});
