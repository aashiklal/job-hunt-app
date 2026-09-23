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
  reserveSpend,
  reconcileSpend,
  releaseSpend,
  QuotaExceededError,
  getCurrentPeriod,
} from "@/lib/usage";

/**
 * The regression test for the spend-limit race.
 *
 * Before the reserve-then-reconcile change, checkBudget() read the current
 * spend and addSpend() wrote it only after the Anthropic call returned. With a
 * multi-second gap between the two, concurrent requests all read the same
 * stale total, all passed the check, and all proceeded: the ceiling only held
 * for serial traffic.
 *
 * These tests fail against that implementation and pass against the atomic
 * one. They run on a real mongod because the fix depends on the database's
 * atomicity, which a mock cannot demonstrate.
 */

const LIMIT_USD = 5;

async function makeUser(opts: { isAdmin?: boolean } = {}) {
  const user = await User.create({
    clerkId: `clerk_${new mongoose.Types.ObjectId().toString()}`,
    email: `user_${Date.now()}_${Math.random()}@example.com`,
    status: "approved",
    isAdmin: opts.isAdmin ?? false,
  });

  await Subscription.create({ userId: user._id, planKey: "test-plan" });
  return user._id.toString();
}

async function spendOf(userId: string): Promise<number> {
  const doc = await Usage.findOne({
    userId,
    period: getCurrentPeriod(),
  }).lean();
  return (doc as { aiSpendUSD?: number } | null)?.aiSpendUSD ?? 0;
}

async function setSpend(userId: string, amount: number) {
  await Usage.findOneAndUpdate(
    { userId, period: getCurrentPeriod() },
    { $set: { aiSpendUSD: amount } },
    { upsert: true }
  );
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
    aiSpendLimitUSD: LIMIT_USD,
    maxResumes: 5,
    active: true,
  });
});

describe("reserveSpend under concurrency", () => {
  it("lets exactly one of many parallel callers through at the threshold", async () => {
    const userId = await makeUser();
    // One cent under the limit: exactly one more call is permissible.
    await setSpend(userId, LIMIT_USD - 0.01);

    const attempts = 20;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        reserveSpend(userId, "aiGeneration", 0.5)
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(attempts - 1);
    for (const failure of refused) {
      expect((failure as PromiseRejectedResult).reason).toBeInstanceOf(
        QuotaExceededError
      );
    }
  });

  it("bounds total spend to one reservation past the limit, not N", async () => {
    const userId = await makeUser();
    await setSpend(userId, LIMIT_USD - 0.01);

    const reservation = 0.5;
    await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        reserveSpend(userId, "aiGeneration", reservation)
      )
    );

    // The old implementation would have let all 20 through, reaching
    // 4.99 + 20 * 0.5 = 14.99 against a limit of 5.
    const spend = await spendOf(userId);
    expect(spend).toBeCloseTo(LIMIT_USD - 0.01 + reservation, 5);
    expect(spend).toBeLessThan(LIMIT_USD + reservation);
  });

  it("admits every caller while they remain under budget", async () => {
    const userId = await makeUser();

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        reserveSpend(userId, "aiGeneration", 0.1)
      )
    );

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await spendOf(userId)).toBeCloseTo(0.5, 5);
  });

  it("creates the period document exactly once under a parallel cold start", async () => {
    const userId = await makeUser();

    // No Usage document exists yet, so every caller races to insert it. The
    // unique index on {userId, period} must make that safe.
    await Promise.allSettled(
      Array.from({ length: 15 }, () =>
        reserveSpend(userId, "aiGeneration", 0.01)
      )
    );

    const count = await Usage.countDocuments({
      userId,
      period: getCurrentPeriod(),
    });
    expect(count).toBe(1);
  });
});

describe("reserveSpend budget rules", () => {
  it("refuses a user already at the limit", async () => {
    const userId = await makeUser();
    await setSpend(userId, LIMIT_USD);

    await expect(
      reserveSpend(userId, "aiGeneration", 0.01)
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("reports the real spend and limit on the thrown error", async () => {
    const userId = await makeUser();
    await setSpend(userId, LIMIT_USD + 1);

    try {
      await reserveSpend(userId, "aiGeneration", 0.01);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(QuotaExceededError);
      expect((err as QuotaExceededError).limit).toBe(LIMIT_USD);
      expect((err as QuotaExceededError).used).toBeCloseTo(LIMIT_USD + 1, 5);
    }
  });

  it("never refuses an admin and never reserves against them", async () => {
    const userId = await makeUser({ isAdmin: true });
    await setSpend(userId, LIMIT_USD * 100);

    const reservation = await reserveSpend(userId, "aiGeneration", 1);

    expect(reservation.limitUSD).toBe(-1);
    expect(reservation.reservedUSD).toBe(0);
    // The admin's spend is untouched by the reservation step.
    expect(await spendOf(userId)).toBeCloseTo(LIMIT_USD * 100, 5);
  });

  it("throws rather than silently allowing a user with no subscription", async () => {
    const user = await User.create({
      clerkId: "clerk_orphan",
      email: "orphan@example.com",
      status: "approved",
    });

    await expect(
      reserveSpend(user._id.toString(), "aiGeneration", 0.01)
    ).rejects.toThrow(/No subscription found/);
  });
});

describe("reconcileSpend and releaseSpend", () => {
  it("corrects an over-reservation downward to the true cost", async () => {
    const userId = await makeUser();
    const { reservedUSD } = await reserveSpend(userId, "aiGeneration", 0.5);
    expect(await spendOf(userId)).toBeCloseTo(0.5, 5);

    await reconcileSpend(userId, reservedUSD, 0.02);

    expect(await spendOf(userId)).toBeCloseTo(0.02, 5);
  });

  it("corrects upward when a call cost more than estimated", async () => {
    const userId = await makeUser();
    const { reservedUSD } = await reserveSpend(userId, "aiGeneration", 0.1);

    await reconcileSpend(userId, reservedUSD, 0.35);

    expect(await spendOf(userId)).toBeCloseTo(0.35, 5);
  });

  it("refunds the whole reservation when a call fails", async () => {
    const userId = await makeUser();
    await setSpend(userId, 1);
    const { reservedUSD } = await reserveSpend(userId, "aiGeneration", 0.5);
    expect(await spendOf(userId)).toBeCloseTo(1.5, 5);

    await releaseSpend(userId, reservedUSD);

    expect(await spendOf(userId)).toBeCloseTo(1, 5);
  });

  it("leaves spend untouched when reconciling an admin's zero reservation", async () => {
    const userId = await makeUser({ isAdmin: true });
    const { reservedUSD } = await reserveSpend(userId, "aiGeneration", 1);

    await releaseSpend(userId, reservedUSD);

    expect(await spendOf(userId)).toBe(0);
  });
});
