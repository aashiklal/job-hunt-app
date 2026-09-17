import { describe, expect, it } from "vitest";
import { calculateCost, getCurrentPeriod, QuotaExceededError, resolveSpend } from "@/lib/usage";

describe("calculateCost", () => {
  it("prices a known model from the pricing table", () => {
    // 1M input tokens at $3 + 1M output tokens at $15
    expect(calculateCost("claude-sonnet-4-5", 1_000_000, 1_000_000)).toBeCloseTo(18, 6);
  });

  it("scales linearly with token counts", () => {
    // 1000 input tokens at $0.80/M + 2000 output tokens at $4.00/M
    expect(calculateCost("claude-haiku-4-5-20251001", 1000, 2000)).toBeCloseTo(0.0088, 8);
  });

  it("falls back to Sonnet pricing for unknown models", () => {
    const unknown = calculateCost("claude-future-9", 500_000, 100_000);
    const sonnet = calculateCost("claude-sonnet-4-5", 500_000, 100_000);
    expect(unknown).toBe(sonnet);
  });

  it("returns zero for zero tokens", () => {
    expect(calculateCost("claude-sonnet-4-5", 0, 0)).toBe(0);
  });
});

describe("getCurrentPeriod", () => {
  it("returns a YYYY-MM string for the current UTC month", () => {
    const now = new Date();
    const expected = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    expect(getCurrentPeriod()).toBe(expected);
    expect(getCurrentPeriod()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("resolveSpend", () => {
  it("uses the current-period figure for monthly plans, ignoring lifetime spend", () => {
    expect(resolveSpend("monthly", 1.5, 99)).toBe(1.5);
  });

  it("uses the lifetime figure for lifetime plans, ignoring current-period spend", () => {
    expect(resolveSpend("lifetime", 99, 0.32)).toBe(0.32);
  });
});

describe("QuotaExceededError", () => {
  it("carries the quota details and a readable monthly message by default", () => {
    const periodEndsAt = new Date("2026-10-01T00:00:00.000Z");
    const err = new QuotaExceededError({ kind: "aiGeneration", used: 5.1234, limit: 5, periodEndsAt });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("QuotaExceededError");
    expect(err.used).toBe(5.1234);
    expect(err.limit).toBe(5);
    expect(err.budgetScope).toBe("monthly");
    expect(err.message).toContain("$5.1234 of $5.00");
    expect(err.message).toContain("2026-10-01");
  });

  it("reads as a one-time credit with no reset date for lifetime plans", () => {
    const periodEndsAt = new Date("2026-10-01T00:00:00.000Z");
    const err = new QuotaExceededError({
      kind: "aiGeneration",
      used: 0.5,
      limit: 0.5,
      periodEndsAt,
      budgetScope: "lifetime",
    });
    expect(err.budgetScope).toBe("lifetime");
    expect(err.message).toContain("Lifetime AI credit used up");
    expect(err.message).not.toContain("Resets");
  });
});
