import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  syncIndexes,
} from "@/test/mongo";
import RateLimit from "@/lib/models/RateLimit";
import { consume } from "@/lib/rate-limit";

/**
 * Rate limiting runs on a real database for the same reason the quota tests
 * do: the counter's correctness rests on an atomic upsert-and-increment under
 * a unique index, which only a real server enforces.
 */

beforeAll(async () => {
  await startTestMongo();
  await syncIndexes(RateLimit);
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await syncIndexes(RateLimit);
});

afterEach(() => {
  vi.useRealTimers();
});

function newUserId() {
  return new mongoose.Types.ObjectId().toString();
}

describe("consume", () => {
  it("allows requests up to the limit and refuses the one after", async () => {
    const userId = newUserId();

    // The generate policy allows 10 per minute.
    for (let i = 0; i < 10; i++) {
      const result = await consume(userId, "generate");
      expect(result.allowed).toBe(true);
    }

    const refused = await consume(userId, "generate");
    expect(refused.allowed).toBe(false);
  });

  it("reports a positive Retry-After when it refuses", async () => {
    const userId = newUserId();
    for (let i = 0; i < 10; i++) await consume(userId, "generate");

    const refused = await consume(userId, "generate");
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) {
      expect(refused.retryAfterSeconds).toBeGreaterThan(0);
      expect(refused.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it("counts down the remaining allowance", async () => {
    const userId = newUserId();

    const first = await consume(userId, "generate");
    const second = await consume(userId, "generate");

    expect(first.allowed && first.remaining).toBe(9);
    expect(second.allowed && second.remaining).toBe(8);
  });

  it("keeps separate budgets per route", async () => {
    const userId = newUserId();

    for (let i = 0; i < 10; i++) await consume(userId, "generate");
    expect((await consume(userId, "generate")).allowed).toBe(false);

    // A different route has its own counter and is unaffected.
    expect((await consume(userId, "skills-gap")).allowed).toBe(true);
  });

  it("keeps separate budgets per user", async () => {
    const userA = newUserId();
    const userB = newUserId();

    for (let i = 0; i < 10; i++) await consume(userA, "generate");
    expect((await consume(userA, "generate")).allowed).toBe(false);

    expect((await consume(userB, "generate")).allowed).toBe(true);
  });

  it("does not miscount under parallel requests", async () => {
    const userId = newUserId();

    // Twenty simultaneous requests against a limit of ten. A read-then-write
    // counter would let far more than ten through.
    const results = await Promise.all(
      Array.from({ length: 20 }, () => consume(userId, "generate"))
    );

    const allowed = results.filter((r) => r.allowed);
    expect(allowed).toHaveLength(10);
  });

  it("creates exactly one counter document per user, route and window", async () => {
    const userId = newUserId();
    await Promise.all(
      Array.from({ length: 15 }, () => consume(userId, "generate"))
    );

    const count = await RateLimit.countDocuments({ userId, route: "generate" });
    expect(count).toBe(1);
  });

  it("starts a fresh allowance in the next window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T10:00:05Z"));

    const userId = newUserId();
    for (let i = 0; i < 10; i++) await consume(userId, "generate");
    expect((await consume(userId, "generate")).allowed).toBe(false);

    // Cross into the next fixed minute window.
    vi.setSystemTime(new Date("2026-06-01T10:01:05Z"));
    expect((await consume(userId, "generate")).allowed).toBe(true);
  });

  it("applies the looser policy to the cheaper parse route", async () => {
    const userId = newUserId();

    // jobs-parse allows 20 per minute, twice the generate budget.
    for (let i = 0; i < 20; i++) {
      expect((await consume(userId, "jobs-parse")).allowed).toBe(true);
    }
    expect((await consume(userId, "jobs-parse")).allowed).toBe(false);
  });
});
