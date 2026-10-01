import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { z } from "zod";
import { startTestMongo, stopTestMongo, clearTestMongo, syncIndexes } from "@/test/mongo";
import User from "@/lib/models/User";
import Plan from "@/lib/models/Plan";
import Subscription from "@/lib/models/Subscription";
import Usage from "@/lib/models/Usage";
import UsageEvent from "@/lib/models/UsageEvent";

/**
 * Credits are the only limit a user can hit (docs/adr/0006). A user with
 * credits left must never be refused because of what they have spent in
 * dollars, and the real cost of every call must still be recorded, because
 * the admin margin view is built from it.
 *
 * Real database, stubbed model: the guarantees are about what gets charged
 * and recorded, not about Anthropic.
 */

const model = vi.hoisted(() => ({ fail: false }));

vi.mock("@/lib/ai", () => ({
  callStructured: async () => {
    if (model.fail) throw new Error("anthropic down");
    return { data: { ok: true }, inputTokens: 3000, outputTokens: 1000 };
  },
}));

vi.mock("@/lib/anthropic", () => ({ default: {} }));

const { callMeteredStructured } = await import("@/lib/ai-execution");
const { CreditsExceededError, getCurrentPeriod, calculateCost } = await import("@/lib/usage");

const CREDIT_LIMIT = 20;

async function makeUser() {
  const user = await User.create({
    clerkId: `clerk_${new mongoose.Types.ObjectId().toString()}`,
    email: `u_${Date.now()}_${Math.random()}@example.com`,
    status: "approved",
    isAdmin: false,
  });
  await Subscription.create({ userId: user._id, planKey: "test-plan" });
  return user._id.toString();
}

async function usageOf(userId: string) {
  const doc = await Usage.findOne({ userId, period: getCurrentPeriod() }).lean();
  return {
    credits: (doc as { creditsUsed?: number } | null)?.creditsUsed ?? 0,
    spend: (doc as { aiSpendUSD?: number } | null)?.aiSpendUSD ?? 0,
  };
}

function call(userId: string) {
  return callMeteredStructured({
    userId,
    model: "claude-sonnet-4-5",
    feature: "resume",
    system: "",
    userMessage: "",
    maxTokens: 4096,
    schema: z.object({ ok: z.boolean() }),
  });
}

beforeAll(async () => {
  await startTestMongo();
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await syncIndexes(Usage, User, Subscription, Plan);
  model.fail = false;
  await Plan.create({
    key: "test-plan",
    name: "Test",
    monthlyCredits: CREDIT_LIMIT,
    maxResumes: 5,
  });
});

describe("callMeteredStructured", () => {
  it("never refuses a user with credits left, whatever they have spent in dollars", async () => {
    const userId = await makeUser();
    await Usage.create({
      userId,
      period: getCurrentPeriod(),
      aiSpendUSD: 1000,
      creditsUsed: 0,
    });

    await expect(call(userId)).resolves.toMatchObject({ data: { ok: true } });
  });

  it("charges the feature's credits and records the real cost", async () => {
    const userId = await makeUser();

    await call(userId);

    const usage = await usageOf(userId);
    expect(usage.credits).toBe(6);
    expect(usage.spend).toBeCloseTo(calculateCost("claude-sonnet-4-5", 3000, 1000), 8);

    const events = await UsageEvent.find({ userId }).lean();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ feature: "resume", credits: 6 });
  });

  it("refuses only once the credits are used up", async () => {
    const userId = await makeUser();

    await call(userId); // 6
    await call(userId); // 12
    await call(userId); // 18

    await expect(call(userId)).rejects.toBeInstanceOf(CreditsExceededError);
    expect((await usageOf(userId)).credits).toBe(18);
  });

  it("refunds the credits and records nothing when the model call fails", async () => {
    const userId = await makeUser();
    model.fail = true;

    await expect(call(userId)).rejects.toThrow("anthropic down");

    expect(await usageOf(userId)).toEqual({ credits: 0, spend: 0 });
    expect(await UsageEvent.countDocuments({ userId })).toBe(0);
  });
});
