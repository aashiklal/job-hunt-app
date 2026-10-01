import { describe, it, expect } from "vitest";
import { calculateCost, getCycle } from "@/lib/usage";

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

describe("getCycle", () => {
  const at = (iso: string) => new Date(iso);
  const cycle = (anchor: string, now: string) => {
    const c = getCycle(at(anchor), at(now));
    return {
      period: c.period,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
    };
  };

  it("runs from the anchor day to the same day next month", () => {
    expect(cycle("2026-01-14T09:30:00Z", "2026-03-20T12:00:00Z")).toEqual({
      period: "2026-03-14",
      startsAt: "2026-03-14T00:00:00.000Z",
      endsAt: "2026-04-14T00:00:00.000Z",
    });
  });

  it("is still in the previous cycle the day before the anchor day", () => {
    expect(cycle("2026-01-14T09:30:00Z", "2026-03-13T23:59:59.999Z").period).toBe(
      "2026-02-14"
    );
  });

  it("turns over at 00:00 UTC on the anchor day", () => {
    expect(cycle("2026-01-14T09:30:00Z", "2026-03-14T00:00:00.000Z").period).toBe(
      "2026-03-14"
    );
  });

  it("starts the first cycle on the anchor day itself", () => {
    expect(cycle("2026-10-01T15:00:00Z", "2026-10-01T15:00:01Z")).toEqual({
      period: "2026-10-01",
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: "2026-11-01T00:00:00.000Z",
    });
  });

  it("clamps an anchor on the 31st to the end of February, then returns to the 31st", () => {
    expect(cycle("2026-01-31T10:00:00Z", "2026-02-15T00:00:00Z")).toEqual({
      period: "2026-01-31",
      startsAt: "2026-01-31T00:00:00.000Z",
      endsAt: "2026-02-28T00:00:00.000Z",
    });
    expect(cycle("2026-01-31T10:00:00Z", "2026-03-01T00:00:00Z")).toEqual({
      period: "2026-02-28",
      startsAt: "2026-02-28T00:00:00.000Z",
      endsAt: "2026-03-31T00:00:00.000Z",
    });
  });

  it("uses February 29 in a leap year", () => {
    expect(cycle("2027-12-31T10:00:00Z", "2028-02-29T12:00:00Z").period).toBe(
      "2028-02-29"
    );
  });

  it("clamps the 31st to the 30th in 30-day months", () => {
    expect(cycle("2026-01-31T10:00:00Z", "2026-04-30T12:00:00Z")).toEqual({
      period: "2026-04-30",
      startsAt: "2026-04-30T00:00:00.000Z",
      endsAt: "2026-05-31T00:00:00.000Z",
    });
  });

  it("rolls the year in both directions", () => {
    expect(cycle("2026-03-20T00:00:00Z", "2027-01-05T00:00:00Z")).toEqual({
      period: "2026-12-20",
      startsAt: "2026-12-20T00:00:00.000Z",
      endsAt: "2027-01-20T00:00:00.000Z",
    });
  });

  it("uses the anchor's UTC day, not the local one", () => {
    // 23:30 UTC on the 14th is already the 15th in some zones; the cycle must
    // still follow the UTC day so it does not shift with the server's zone.
    expect(cycle("2026-01-14T23:30:00Z", "2026-02-14T00:30:00Z").period).toBe(
      "2026-02-14"
    );
  });
});
