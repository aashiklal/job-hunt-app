import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  syncIndexes,
} from "@/test/mongo";
import User from "@/lib/models/User";
import Plan from "@/lib/models/Plan";
import Subscription from "@/lib/models/Subscription";
import Usage from "@/lib/models/Usage";
import {
  reserveCredits,
  releaseCredits,
  getCreditBalance,
  CreditsExceededError,
  getCurrentPeriod,
} from "@/lib/usage";
import {
  CREDIT_COSTS,
  creditCost,
  describeCredits,
  featureForGenerationType,
} from "@/lib/credits";

const CREDIT_LIMIT = 100;

async function makeUser(opts: { isAdmin?: boolean } = {}) {
  const user = await User.create({
    clerkId: `clerk_${new mongoose.Types.ObjectId().toString()}`,
    email: `u_${Date.now()}_${Math.random()}@example.com`,
    status: "approved",
    isAdmin: opts.isAdmin ?? false,
  });
  await Subscription.create({ userId: user._id, planKey: "test-plan" });
  return user._id.toString();
}

async function creditsUsed(userId: string): Promise<number> {
  const doc = await Usage.findOne({ userId, period: getCurrentPeriod() }).lean();
  return (doc as { creditsUsed?: number } | null)?.creditsUsed ?? 0;
}

beforeAll(async () => {
  await startTestMongo();
  await syncIndexes(Usage, User, Subscription, Plan);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await syncIndexes(Usage);
  await Plan.create({
    key: "test-plan",
    name: "Test",
    aiSpendLimitUSD: 5,
    monthlyCredits: CREDIT_LIMIT,
    maxResumes: 5,
    maxJobs: -1,
    active: true,
  });
});

describe("credit pricing", () => {
  it("prices every feature above zero", () => {
    for (const [feature, cost] of Object.entries(CREDIT_COSTS)) {
      expect(cost, `${feature} must cost at least 1 credit`).toBeGreaterThan(0);
    }
  });

  it("charges more for a resume than for an outreach message", () => {
    // A resume costs roughly five times an outreach email in real spend. If
    // this inverts, the weights no longer protect margin.
    expect(creditCost("resume")).toBeGreaterThan(creditCost("outreach"));
  });

  it("orders weights the same way real cost orders them", () => {
    expect(creditCost("resume")).toBeGreaterThan(creditCost("cover_letter"));
    expect(creditCost("cover_letter")).toBeGreaterThan(creditCost("star_polish"));
    expect(creditCost("interview_prep")).toBeGreaterThan(creditCost("outreach"));
  });

  it("maps every outreach variant onto the outreach price", () => {
    for (const type of [
      "linkedin_note",
      "linkedin_dm",
      "followup_email",
      "thankyou_email",
      "cold_email",
      "checkin_email",
      "salary_negotiation",
      "linkedin_followup_dm",
    ]) {
      expect(featureForGenerationType(type)).toBe("outreach");
    }
  });

  it("maps the document types onto their own prices", () => {
    expect(featureForGenerationType("resume")).toBe("resume");
    expect(featureForGenerationType("cover_letter")).toBe("cover_letter");
    expect(featureForGenerationType("jd_analysis")).toBe("jd_analysis");
    expect(featureForGenerationType("interview_prep")).toBe("interview_prep");
  });
});

describe("describeCredits", () => {
  it("translates a balance into something actionable", () => {
    expect(describeCredits(60)).toMatch(/resume|letter/i);
  });

  it("says plainly when there is nothing left", () => {
    expect(describeCredits(0)).toMatch(/no credits/i);
    expect(describeCredits(-5)).toMatch(/no credits/i);
  });

  it("degrades gracefully on a tiny balance", () => {
    expect(describeCredits(1)).toBeTruthy();
    expect(describeCredits(1)).not.toMatch(/NaN|undefined/);
  });

  it("uses singular wording for exactly one", () => {
    const one = describeCredits(CREDIT_COSTS.resume);
    expect(one).toContain("1 tailored resume");
    expect(one).not.toContain("1 tailored resumes");
  });
});

describe("reserveCredits", () => {
  it("charges the full cost up front", async () => {
    const userId = await makeUser();
    const res = await reserveCredits(userId, 6);

    expect(res.creditsCharged).toBe(6);
    expect(res.remaining).toBe(CREDIT_LIMIT - 6);
    expect(await creditsUsed(userId)).toBe(6);
  });

  it("refuses when the allowance cannot cover the whole call", async () => {
    const userId = await makeUser();
    await reserveCredits(userId, CREDIT_LIMIT - 2);

    // Two credits left, but a resume costs six. It must be refused outright
    // rather than partially charged.
    await expect(reserveCredits(userId, 6)).rejects.toBeInstanceOf(
      CreditsExceededError
    );
    expect(await creditsUsed(userId)).toBe(CREDIT_LIMIT - 2);
  });

  it("allows a call that exactly exhausts the allowance", async () => {
    const userId = await makeUser();
    const res = await reserveCredits(userId, CREDIT_LIMIT);

    expect(res.remaining).toBe(0);
    expect(await creditsUsed(userId)).toBe(CREDIT_LIMIT);
  });

  it("never overshoots the allowance under parallel calls", async () => {
    const userId = await makeUser();

    // 30 concurrent requests at 6 credits each against a 100 credit allowance.
    // At most 16 can fit.
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, () => reserveCredits(userId, 6))
    );

    const granted = results.filter((r) => r.status === "fulfilled").length;
    expect(granted).toBe(Math.floor(CREDIT_LIMIT / 6));
    expect(await creditsUsed(userId)).toBeLessThanOrEqual(CREDIT_LIMIT);
  });

  it("creates one usage document under a parallel cold start", async () => {
    const userId = await makeUser();
    await Promise.allSettled(
      Array.from({ length: 12 }, () => reserveCredits(userId, 1))
    );
    expect(
      await Usage.countDocuments({ userId, period: getCurrentPeriod() })
    ).toBe(1);
  });

  it("does not charge or refuse an admin", async () => {
    const userId = await makeUser({ isAdmin: true });
    const res = await reserveCredits(userId, 999);

    expect(res.limit).toBe(-1);
    expect(res.creditsCharged).toBe(0);
    expect(await creditsUsed(userId)).toBe(0);
  });
});

describe("releaseCredits", () => {
  it("refunds a failed call in full", async () => {
    const userId = await makeUser();
    await reserveCredits(userId, 6);
    await releaseCredits(userId, 6);
    expect(await creditsUsed(userId)).toBe(0);
  });

  it("ignores a zero refund from an admin reservation", async () => {
    const userId = await makeUser({ isAdmin: true });
    await releaseCredits(userId, 0);
    expect(await creditsUsed(userId)).toBe(0);
  });
});

describe("unconfigured plans", () => {
  it("never lets a plan with no credit allowance become the most generous", async () => {
    // The free plan predates credits and has no monthlyCredits field. A fixed
    // generous fallback would silently hand free users the paid allowance.
    await Plan.create({
      key: "legacy-free",
      name: "Legacy free",
      aiSpendLimitUSD: 0.5,
      maxResumes: 2,
      maxJobs: -1,
      active: true,
    });
    await Plan.updateOne({ key: "legacy-free" }, { $unset: { monthlyCredits: 1 } });

    const user = await User.create({
      clerkId: "clerk_legacy",
      email: "legacy@example.com",
      status: "approved",
    });
    await Subscription.create({ userId: user._id, planKey: "legacy-free" });
    const userId = user._id.toString();

    const balance = await getCreditBalance(userId);

    // Derived from the plan's own $0.50 ceiling, not from the paid allowance.
    expect(balance.limit).toBeGreaterThan(0);
    expect(balance.limit).toBeLessThan(CREDIT_LIMIT);
  });
});

describe("getCreditBalance", () => {
  it("reports used, limit and remaining together", async () => {
    const userId = await makeUser();
    await reserveCredits(userId, 30);

    const balance = await getCreditBalance(userId);
    expect(balance.used).toBe(30);
    expect(balance.limit).toBe(CREDIT_LIMIT);
    expect(balance.remaining).toBe(CREDIT_LIMIT - 30);
  });

  it("reports unlimited for an admin", async () => {
    const userId = await makeUser({ isAdmin: true });
    const balance = await getCreditBalance(userId);
    expect(balance.limit).toBe(-1);
    expect(balance.remaining).toBe(-1);
  });

  it("returns zeroes rather than throwing for a user with no subscription", async () => {
    const orphan = await User.create({
      clerkId: "clerk_orphan_credits",
      email: "orphan-credits@example.com",
      status: "approved",
    });

    const balance = await getCreditBalance(orphan._id.toString());
    expect(balance.limit).toBe(0);
    expect(balance.remaining).toBe(0);
  });
});
