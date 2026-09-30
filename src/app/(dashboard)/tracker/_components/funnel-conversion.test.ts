import { describe, it, expect } from "vitest";
import type { JobStatus } from "@/lib/repositories/jobs";
import { conversionRates, reachedCounts } from "./funnel-conversion";

function counts(partial: Partial<Record<JobStatus, number>>): Record<JobStatus, number> {
  return {
    saved: 0,
    applied: 0,
    screening: 0,
    interview: 0,
    assessment: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
    ...partial,
  };
}

// The seeded demo: more jobs sit in applied than in saved, which is what made
// the old stage-to-stage drop-off read -167%.
const DEMO = counts({
  saved: 3,
  applied: 8,
  screening: 2,
  interview: 2,
  assessment: 2,
  offer: 2,
  rejected: 3,
  withdrawn: 1,
});

describe("reachedCounts", () => {
  it("counts every job at or past a stage, with rejected jobs as applied", () => {
    expect(reachedCounts(DEMO)).toEqual({
      saved: 22,
      applied: 19,
      screening: 8,
      interview: 6,
      assessment: 4,
      offer: 2,
    });
  });

  it("leaves withdrawn jobs out", () => {
    expect(reachedCounts(counts({ withdrawn: 5 })).saved).toBe(0);
  });
});

describe("conversionRates", () => {
  it("gives the share of each stage that moved on to the next", () => {
    expect(conversionRates(DEMO)).toEqual([null, 86, 42, 75, 67, 50]);
  });

  it("is null for the first stage and for stages nobody reached", () => {
    expect(conversionRates(counts({}))).toEqual([null, null, null, null, null, null]);
  });

  it("is 100% all the way when the only job is an offer", () => {
    expect(conversionRates(counts({ offer: 1 }))).toEqual([null, 100, 100, 100, 100, 100]);
  });

  it("never falls outside 0-100 whatever the snapshot", () => {
    const statuses: JobStatus[] = [
      "saved", "applied", "screening", "interview", "assessment", "offer", "rejected", "withdrawn",
    ];
    for (let seed = 0; seed < 200; seed++) {
      const snapshot = counts(
        Object.fromEntries(statuses.map((s, i) => [s, (seed * (i + 7) * 31) % 13]))
      );
      for (const rate of conversionRates(snapshot)) {
        if (rate === null) continue;
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(100);
      }
    }
  });
});
