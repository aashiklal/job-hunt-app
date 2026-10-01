import { describe, it, expect, afterEach, vi } from "vitest";
import { calculateCost, getCurrentPeriod } from "@/lib/usage";

/**
 * Pure-logic tests. No database: everything here is arithmetic or date
 * handling, and the money maths is worth pinning precisely because a silent
 * factor-of-1000 error in the pricing table would be invisible in the UI.
 */

describe("calculateCost", () => {
  it("prices Sonnet input and output at the published per-million rates", () => {
    // 1M input at $3.00 + 1M output at $15.00
    expect(calculateCost("claude-sonnet-4-5", 1_000_000, 1_000_000)).toBeCloseTo(
      18,
      10
    );
  });

  it("prices Haiku well below Sonnet for identical usage", () => {
    const haiku = calculateCost("claude-haiku-4-5", 500_000, 500_000);
    const sonnet = calculateCost("claude-sonnet-4-5", 500_000, 500_000);
    expect(haiku).toBeLessThan(sonnet);
    // 0.5M * $1.00 + 0.5M * $5.00
    expect(haiku).toBeCloseTo(3.0, 10);
  });

  it("prices Opus above Sonnet for identical usage", () => {
    expect(calculateCost("claude-opus-4-5", 100_000, 100_000)).toBeGreaterThan(
      calculateCost("claude-sonnet-4-5", 100_000, 100_000)
    );
  });

  it("weights output tokens more heavily than input tokens", () => {
    const outputHeavy = calculateCost("claude-sonnet-4-5", 0, 1000);
    const inputHeavy = calculateCost("claude-sonnet-4-5", 1000, 0);
    expect(outputHeavy).toBeGreaterThan(inputHeavy);
  });

  it("falls back to Sonnet pricing for an unrecognised model", () => {
    expect(calculateCost("some-future-model", 1000, 1000)).toBe(
      calculateCost("claude-sonnet-4-5", 1000, 1000)
    );
  });

  it("returns zero for zero usage", () => {
    expect(calculateCost("claude-sonnet-4-5", 0, 0)).toBe(0);
  });

  it("scales linearly with token count", () => {
    const single = calculateCost("claude-sonnet-4-5", 1000, 1000);
    const double = calculateCost("claude-sonnet-4-5", 2000, 2000);
    expect(double).toBeCloseTo(single * 2, 12);
  });
});

describe("getCurrentPeriod", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function periodAt(iso: string): string {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    return getCurrentPeriod();
  }

  it("formats as zero-padded YYYY-MM", () => {
    expect(periodAt("2026-03-15T12:00:00Z")).toBe("2026-03");
  });

  it("pads single-digit months", () => {
    expect(periodAt("2026-01-01T00:00:00Z")).toBe("2026-01");
  });

  it("handles December without rolling the year", () => {
    expect(periodAt("2026-12-31T23:59:59Z")).toBe("2026-12");
  });

  it("uses UTC, not local time, at a month boundary", () => {
    // 23:30 UTC on the 31st is already the next month in some local zones.
    // The period must follow UTC so a user's billing window does not shift
    // with their timezone.
    expect(periodAt("2026-06-30T23:30:00Z")).toBe("2026-06");
    expect(periodAt("2026-07-01T00:30:00Z")).toBe("2026-07");
  });

  it("rolls the year at the January boundary", () => {
    expect(periodAt("2026-12-31T23:59:59.999Z")).toBe("2026-12");
    expect(periodAt("2027-01-01T00:00:00.000Z")).toBe("2027-01");
  });
});
