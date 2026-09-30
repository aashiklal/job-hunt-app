import { describe, it, expect } from "vitest";
import {
  accountMargin,
  countsTowardMargin,
  isPaying,
  marginHeadline,
  summarise,
} from "@/lib/margin";

/**
 * This maths decides what the admin dashboard claims about revenue, so the
 * cases that matter most are the ones where it could overstate: counting a
 * trial as income, counting a comped account, or dividing by an unset price.
 */

describe("billing status", () => {
  it("counts only an active subscription as paying", () => {
    expect(isPaying("active")).toBe(true);
    for (const s of ["trialing", "past_due", "canceled", "comped"] as const) {
      expect(isPaying(s), `${s} must not count as revenue`).toBe(false);
    }
  });

  it("measures accounts that could pay, and ignores those that cannot", () => {
    expect(countsTowardMargin("active")).toBe(true);
    expect(countsTowardMargin("trialing")).toBe(true);
    expect(countsTowardMargin("past_due")).toBe(true);
    // Neither says anything about whether the pricing works.
    expect(countsTowardMargin("canceled")).toBe(false);
    expect(countsTowardMargin("comped")).toBe(false);
  });
});

describe("accountMargin", () => {
  it("computes margin for a paying account", () => {
    const m = accountMargin({ priceUSD: 12, costUSD: 3, status: "active" });
    expect(m.marginUSD).toBe(9);
    expect(m.marginRatio).toBeCloseTo(0.75, 6);
    expect(m.costRatio).toBeCloseTo(0.25, 6);
    expect(m.isLoss).toBe(false);
    expect(m.isEarned).toBe(true);
  });

  it("models a trial at its plan price but does not call it earned", () => {
    const m = accountMargin({ priceUSD: 12, costUSD: 3, status: "trialing" });
    expect(m.priceUSD).toBe(12);
    expect(m.marginUSD).toBe(9);
    // The distinction the whole design rests on.
    expect(m.isEarned).toBe(false);
  });

  it("treats a comped account as charging nothing, whatever its plan says", () => {
    const m = accountMargin({ priceUSD: 12, costUSD: 0.5, status: "comped" });
    expect(m.priceUSD).toBe(0);
    expect(m.marginUSD).toBe(-0.5);
    expect(m.isEarned).toBe(false);
  });

  it("flags an account costing more than it pays", () => {
    const m = accountMargin({ priceUSD: 12, costUSD: 15, status: "active" });
    expect(m.isLoss).toBe(true);
    expect(m.marginUSD).toBe(-3);
    expect(m.costRatio).toBeCloseTo(1.25, 6);
    // A loss is not also "at risk"; it is past that.
    expect(m.isAtRisk).toBe(false);
  });

  it("flags an account whose margin has thinned before it inverts", () => {
    const m = accountMargin({ priceUSD: 12, costUSD: 9, status: "active" });
    expect(m.isLoss).toBe(false);
    expect(m.isAtRisk).toBe(true);
  });

  it("leaves a comfortable account unflagged", () => {
    const m = accountMargin({ priceUSD: 12, costUSD: 2, status: "active" });
    expect(m.isAtRisk).toBe(false);
    expect(m.isLoss).toBe(false);
  });

  it("does not divide by an unset price", () => {
    // Every plan starts unpriced, so this is the default state, not an edge case.
    const m = accountMargin({ priceUSD: 0, costUSD: 1.5, status: "trialing" });
    expect(m.marginRatio).toBeNull();
    expect(m.costRatio).toBeNull();
    expect(m.isLoss).toBe(false);
    expect(m.isAtRisk).toBe(false);
    expect(Number.isFinite(m.marginUSD)).toBe(true);
  });

  it("handles an account that has cost nothing", () => {
    const m = accountMargin({ priceUSD: 12, costUSD: 0, status: "active" });
    expect(m.marginRatio).toBe(1);
    expect(m.costRatio).toBe(0);
  });
});

describe("summarise", () => {
  const paying = accountMargin({ priceUSD: 12, costUSD: 2, status: "active" });
  const trial = accountMargin({ priceUSD: 12, costUSD: 3, status: "trialing" });
  const losing = accountMargin({ priceUSD: 12, costUSD: 20, status: "active" });

  it("separates money collected from money the pricing predicts", () => {
    const t = summarise([paying, trial]);
    expect(t.earnedRevenueUSD).toBe(12);
    expect(t.modelledRevenueUSD).toBe(24);
    expect(t.payingCount).toBe(1);
  });

  it("reports zero earned when nobody is paying yet", () => {
    // Today's real state. The headline must not imply income that does not exist.
    const t = summarise([trial, trial]);
    expect(t.earnedRevenueUSD).toBe(0);
    expect(t.modelledRevenueUSD).toBe(24);
  });

  it("counts losing and at-risk accounts separately", () => {
    const atRisk = accountMargin({ priceUSD: 12, costUSD: 9, status: "active" });
    const t = summarise([paying, atRisk, losing]);
    expect(t.accountsLosing).toBe(1);
    expect(t.accountsAtRisk).toBe(1);
    expect(t.accountsCounted).toBe(3);
  });

  it("totals cost and modelled margin", () => {
    const t = summarise([paying, trial]);
    expect(t.costUSD).toBeCloseTo(5, 6);
    expect(t.modelledMarginUSD).toBeCloseTo(19, 6);
  });

  it("handles no accounts without producing NaN", () => {
    const t = summarise([]);
    expect(t.modelledMarginUSD).toBe(0);
    expect(t.accountsCounted).toBe(0);
  });
});

describe("marginHeadline", () => {
  const ok = accountMargin({ priceUSD: 12, costUSD: 2, status: "active" });
  const atRisk = accountMargin({ priceUSD: 12, costUSD: 9, status: "active" });
  const losing = accountMargin({ priceUSD: 12, costUSD: 20, status: "active" });

  it("confirms health plainly when nothing is wrong", () => {
    expect(marginHeadline(summarise([ok, ok]))).toBe("All 2 accounts profitable");
  });

  it("leads with losses over risks, since a loss is the worse news", () => {
    expect(marginHeadline(summarise([losing, atRisk]))).toBe(
      "1 account costs more than it pays"
    );
  });

  it("reports thinning margin when nothing is losing yet", () => {
    expect(marginHeadline(summarise([ok, atRisk]))).toBe(
      "1 account is approaching its price"
    );
  });

  it("uses singular wording for one account", () => {
    expect(marginHeadline(summarise([ok]))).toBe("All 1 account profitable");
  });

  it("says something sensible with no accounts", () => {
    expect(marginHeadline(summarise([]))).toBe("No accounts to measure yet");
  });
});
