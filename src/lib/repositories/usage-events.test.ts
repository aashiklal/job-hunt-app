import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  syncIndexes,
} from "@/test/mongo";
import UsageEvent from "@/lib/models/UsageEvent";
import * as usageEvents from "@/lib/repositories/usage-events";

/**
 * These aggregations drive the admin's cost reporting, so they run against a
 * real mongod. Mongo's own $dateToString bucketing is the thing under test;
 * a mock would only confirm the mock.
 */

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY);
}

async function seed(rows: Array<{
  userId: mongoose.Types.ObjectId;
  feature?: string;
  costUSD: number;
  credits: number;
  daysBack: number;
}>) {
  await UsageEvent.insertMany(
    rows.map((r) => ({
      userId: r.userId,
      feature: r.feature ?? "cover_letter",
      aiModel: "claude-sonnet-4-5",
      inputTokens: 1000,
      outputTokens: 500,
      costUSD: r.costUSD,
      credits: r.credits,
      createdAt: daysAgo(r.daysBack),
    })),
    { timestamps: false }
  );
}

beforeAll(async () => {
  await startTestMongo();
  await syncIndexes(UsageEvent);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
});

describe("bulkTotals", () => {
  it("returns a row for every requested user, including those with no spend", async () => {
    // A missing key renders as a blank cell, which reads as "unknown" when the
    // truth is "nothing". Every requested id must come back.
    const spender = new mongoose.Types.ObjectId();
    const quiet = new mongoose.Types.ObjectId();
    await seed([{ userId: spender, costUSD: 0.05, credits: 3, daysBack: 1 }]);

    const totals = await usageEvents.bulkTotals([
      spender.toString(),
      quiet.toString(),
    ]);

    expect(totals[spender.toString()].costUSD).toBeCloseTo(0.05, 6);
    expect(totals[quiet.toString()]).toEqual({
      costUSD: 0,
      credits: 0,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });

  it("sums many events per user", async () => {
    const userId = new mongoose.Types.ObjectId();
    await seed([
      { userId, costUSD: 0.02, credits: 3, daysBack: 1 },
      { userId, costUSD: 0.03, credits: 3, daysBack: 2 },
      { userId, costUSD: 0.04, credits: 6, daysBack: 3 },
    ]);

    const totals = await usageEvents.bulkTotals([userId.toString()]);
    expect(totals[userId.toString()].costUSD).toBeCloseTo(0.09, 6);
    expect(totals[userId.toString()].credits).toBe(12);
    expect(totals[userId.toString()].calls).toBe(3);
  });

  it("honours the since cutoff", async () => {
    const userId = new mongoose.Types.ObjectId();
    await seed([
      { userId, costUSD: 0.02, credits: 3, daysBack: 5 },
      { userId, costUSD: 0.5, credits: 60, daysBack: 90 },
    ]);

    const recent = await usageEvents.bulkTotals([userId.toString()], {
      since: daysAgo(30),
    });
    expect(recent[userId.toString()].costUSD).toBeCloseTo(0.02, 6);

    const all = await usageEvents.bulkTotals([userId.toString()]);
    expect(all[userId.toString()].costUSD).toBeCloseTo(0.52, 6);
  });

  it("returns an empty object for no ids rather than querying", async () => {
    expect(await usageEvents.bulkTotals([])).toEqual({});
  });

  it("does not mix one user's spend into another's", async () => {
    const a = new mongoose.Types.ObjectId();
    const b = new mongoose.Types.ObjectId();
    await seed([
      { userId: a, costUSD: 0.1, credits: 6, daysBack: 1 },
      { userId: b, costUSD: 0.9, credits: 60, daysBack: 1 },
    ]);

    const totals = await usageEvents.bulkTotals([a.toString(), b.toString()]);
    expect(totals[a.toString()].costUSD).toBeCloseTo(0.1, 6);
    expect(totals[b.toString()].costUSD).toBeCloseTo(0.9, 6);
  });
});

describe("per-user reporting", () => {
  it("scopes totals to one user", async () => {
    const mine = new mongoose.Types.ObjectId();
    const theirs = new mongoose.Types.ObjectId();
    await seed([
      { userId: mine, costUSD: 0.2, credits: 12, daysBack: 1 },
      { userId: theirs, costUSD: 5, credits: 300, daysBack: 1 },
    ]);

    const totals = await usageEvents.totals({ userId: mine.toString() });
    expect(totals.costUSD).toBeCloseTo(0.2, 6);
    expect(totals.calls).toBe(1);
  });

  it("buckets one user's spend by day", async () => {
    const userId = new mongoose.Types.ObjectId();
    await seed([
      { userId, costUSD: 0.01, credits: 3, daysBack: 1 },
      { userId, costUSD: 0.02, credits: 3, daysBack: 1 },
      { userId, costUSD: 0.03, credits: 3, daysBack: 2 },
    ]);

    const series = await usageEvents.series({
      bucket: "day",
      userId: userId.toString(),
      since: daysAgo(30),
    });

    expect(series).toHaveLength(2);
    // Oldest first, so the two same-day events are the later, larger bucket.
    expect(series[0].costUSD).toBeCloseTo(0.03, 6);
    expect(series[1].costUSD).toBeCloseTo(0.03, 6);
    expect(series[1].calls).toBe(2);
  });

  it("splits one user's spend by feature, heaviest first", async () => {
    const userId = new mongoose.Types.ObjectId();
    await seed([
      { userId, feature: "resume", costUSD: 0.036, credits: 6, daysBack: 1 },
      { userId, feature: "resume", costUSD: 0.036, credits: 6, daysBack: 2 },
      { userId, feature: "outreach", costUSD: 0.007, credits: 1, daysBack: 1 },
    ]);

    const byFeature = await usageEvents.byFeature({ userId: userId.toString() });

    expect(byFeature[0].feature).toBe("resume");
    expect(byFeature[0].calls).toBe(2);
    expect(byFeature[0].costUSD).toBeCloseTo(0.072, 6);
    expect(byFeature[1].feature).toBe("outreach");
  });

  it("returns empty results for a user with no events", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    expect((await usageEvents.totals({ userId })).calls).toBe(0);
    expect(await usageEvents.series({ bucket: "day", userId })).toEqual([]);
    expect(await usageEvents.byFeature({ userId })).toEqual([]);
  });
});
