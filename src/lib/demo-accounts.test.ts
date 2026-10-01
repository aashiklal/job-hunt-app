import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { startTestMongo, stopTestMongo, clearTestMongo, syncIndexes } from "@/test/mongo";
import User from "@/lib/models/User";
import Job from "@/lib/models/Job";
import Resume from "@/lib/models/Resume";
import Doc from "@/lib/models/Document";
import Subscription from "@/lib/models/Subscription";
import { DEMO_EMAIL, isDemoEmail } from "@/lib/demo-constants";

/**
 * The demo lifecycle runs on a real database because its guarantees are about
 * what is left behind: after a failed creation or a sweep, no user, no
 * subscription and no seeded record may survive. A mock cannot show that.
 *
 * Clerk is replaced by an in-memory fake so the failure paths (an outage while
 * deleting, a user already gone) can be driven deterministically.
 */

const seedControl = vi.hoisted(() => ({ failNext: false }));

vi.mock("@/lib/demo-seed", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demo-seed")>();
  return {
    ...actual,
    seedDemoData: async (userId: string) => {
      if (seedControl.failNext) {
        seedControl.failNext = false;
        // Fail part-way, after some data exists, like a real mid-seed crash.
        await actual.wipeDemoData(userId);
        await Job.create({ userId, company: "Partial", role: "Partial" });
        throw new Error("simulated seed failure");
      }
      return actual.seedDemoData(userId);
    },
  };
});

const {
  assertDemoCapacity,
  createDemoAccount,
  destroyDemoAccount,
  sweepExpiredDemoAccounts,
  sweepOrphanClerkDemoUsers,
  DemoCapacityError,
} = await import("@/lib/demo-accounts");
const { DemoLimitError, DEMO_EXTRA_ALLOWANCE, DEMO_CREDITS } = await import("@/lib/demo-limits");
const { DEMO_SEED_COUNTS } = await import("@/lib/demo-seed");
type DemoClerk = import("@/lib/demo-accounts").DemoClerk;

class FakeClerk implements DemoClerk {
  users = new Map<string, { email: string; createdAt: Date }>();
  failDeleteWith: number | null = null;
  failCreateTicket = false;
  private next = 0;

  async createUser(email: string) {
    const id = `user_fake_${++this.next}`;
    this.users.set(id, { email, createdAt: new Date() });
    return { id };
  }

  async deleteUser(clerkId: string) {
    if (this.failDeleteWith !== null) {
      throw Object.assign(new Error("clerk outage"), { status: this.failDeleteWith });
    }
    this.users.delete(clerkId);
  }

  async createSignInTicket(clerkId: string) {
    if (this.failCreateTicket) throw new Error("ticket failure");
    if (!this.users.has(clerkId)) throw new Error("no such user");
    return `ticket_for_${clerkId}`;
  }

  async listDemoUsersCreatedBefore(cutoff: Date) {
    return [...this.users.entries()]
      .filter(([, u]) => u.createdAt < cutoff && isDemoEmail(u.email))
      .map(([id]) => ({ id }));
  }
}

async function recordsFor(userId: string) {
  const [jobs, resumes, docs, subs] = await Promise.all([
    Job.countDocuments({ userId }),
    Resume.countDocuments({ userId }),
    Doc.countDocuments({ userId }),
    Subscription.countDocuments({ userId }),
  ]);
  return { jobs, resumes, docs, subs };
}

const EMPTY = { jobs: 0, resumes: 0, docs: 0, subs: 0 };
const HOUR = 60 * 60 * 1000;

beforeAll(async () => {
  await startTestMongo();
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await syncIndexes(User, Subscription, Doc);
  seedControl.failNext = false;
  delete process.env.DEMO_MAX_LIVE;
  delete process.env.DEMO_TTL_MINUTES;
});

describe("createDemoAccount", () => {
  it("creates an approved, flagged, expiring account with the sample data", async () => {
    const clerk = new FakeClerk();
    const now = new Date();

    const created = await createDemoAccount(clerk, now);

    expect(created.ticket).toMatch(/^ticket_for_user_fake_/);
    const user = await User.findById(created.userId);
    expect(user?.status).toBe("approved");
    expect(user?.isDemo).toBe(true);
    expect(user?.isAdmin).toBe(false);
    expect(isDemoEmail(user?.email)).toBe(true);
    expect(user?.demoExpiresAt?.getTime()).toBe(now.getTime() + 2 * HOUR);

    const counts = await recordsFor(created.userId);
    expect(counts.jobs).toBe(DEMO_SEED_COUNTS.jobs);
    expect(counts.resumes).toBe(DEMO_SEED_COUNTS.resumes);
    expect(counts.subs).toBe(1);
    expect((await Subscription.findOne({ userId: created.userId }))?.status).toBe("comped");
    // Its own small allowance, so a visitor can watch credits fall and run out.
    expect(
      (await Subscription.findOne({ userId: created.userId }))?.customLimits?.monthlyCredits
    ).toBe(DEMO_CREDITS);
  });

  it("gives every visitor a separate account", async () => {
    const clerk = new FakeClerk();
    const a = await createDemoAccount(clerk);
    const b = await createDemoAccount(clerk);
    expect(a.userId).not.toBe(b.userId);
    expect(clerk.users.size).toBe(2);
  });

  it("leaves nothing behind when seeding fails part-way", async () => {
    const clerk = new FakeClerk();
    seedControl.failNext = true;

    await expect(createDemoAccount(clerk)).rejects.toThrow("simulated seed failure");

    expect(clerk.users.size).toBe(0);
    expect(await User.countDocuments({})).toBe(0);
    expect(await Job.countDocuments({})).toBe(0);
    expect(await Subscription.countDocuments({})).toBe(0);
  });

  it("leaves nothing behind when the ticket cannot be minted", async () => {
    const clerk = new FakeClerk();
    clerk.failCreateTicket = true;

    await expect(createDemoAccount(clerk)).rejects.toThrow("ticket failure");

    expect(clerk.users.size).toBe(0);
    expect(await User.countDocuments({})).toBe(0);
    expect(await Job.countDocuments({})).toBe(0);
  });

  it("keeps the expiring record for the sweep if cleanup itself fails", async () => {
    const clerk = new FakeClerk();
    seedControl.failNext = true;
    clerk.failDeleteWith = 500;

    await expect(createDemoAccount(clerk)).rejects.toThrow("simulated seed failure");

    const leftover = await User.findOne({ isDemo: true });
    expect(leftover?.demoExpiresAt).toBeInstanceOf(Date);

    clerk.failDeleteWith = null;
    const later = new Date(Date.now() + 3 * HOUR);
    const result = await sweepExpiredDemoAccounts(clerk, { limit: 10, now: later });
    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(clerk.users.size).toBe(0);
    expect(await User.countDocuments({})).toBe(0);
    expect(await Job.countDocuments({})).toBe(0);
  });

  it("refuses once the live-demo cap is reached", async () => {
    process.env.DEMO_MAX_LIVE = "2";
    const clerk = new FakeClerk();
    await createDemoAccount(clerk);
    await createDemoAccount(clerk);

    await expect(createDemoAccount(clerk)).rejects.toBeInstanceOf(DemoCapacityError);
    expect(clerk.users.size).toBe(2);
  });

  it("does not count expired demos against the cap", async () => {
    process.env.DEMO_MAX_LIVE = "1";
    const clerk = new FakeClerk();
    await createDemoAccount(clerk, new Date(Date.now() - 3 * HOUR));

    await expect(createDemoAccount(clerk)).resolves.toHaveProperty("ticket");
  });
});

describe("sweepExpiredDemoAccounts", () => {
  it("deletes expired demos completely and leaves live ones alone", async () => {
    const clerk = new FakeClerk();
    const expired = await createDemoAccount(clerk, new Date(Date.now() - 3 * HOUR));
    const live = await createDemoAccount(clerk);

    const result = await sweepExpiredDemoAccounts(clerk, { limit: 10 });

    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(await User.findById(expired.userId)).toBeNull();
    expect(await recordsFor(expired.userId)).toEqual(EMPTY);
    expect(await User.findById(live.userId)).not.toBeNull();
    expect((await recordsFor(live.userId)).jobs).toBe(DEMO_SEED_COUNTS.jobs);
    expect(clerk.users.size).toBe(1);
  });

  it("never touches real users", async () => {
    const clerk = new FakeClerk();
    const real = await User.create({
      clerkId: "user_real",
      email: "real@example.com",
      status: "approved",
      isAdmin: false,
    });
    await Job.create({ userId: real._id, company: "Acme", role: "Engineer" });

    await sweepExpiredDemoAccounts(clerk, { limit: 10, now: new Date(Date.now() + 100 * HOUR) });

    expect(await User.findById(real._id)).not.toBeNull();
    expect(await Job.countDocuments({ userId: real._id })).toBe(1);
  });

  it("removes the legacy shared demo account", async () => {
    const clerk = new FakeClerk();
    const { id: clerkId } = await clerk.createUser(DEMO_EMAIL);
    const legacy = await User.create({
      clerkId,
      email: DEMO_EMAIL,
      status: "approved",
      isAdmin: false,
      isDemo: true,
    });
    await Job.create({ userId: legacy._id, company: "Old", role: "Shared" });

    const result = await sweepExpiredDemoAccounts(clerk, { limit: 10 });

    expect(result.deleted).toBe(1);
    expect(await User.countDocuments({})).toBe(0);
    expect(await Job.countDocuments({})).toBe(0);
    expect(clerk.users.size).toBe(0);
  });

  it("treats a Clerk user that is already gone as deleted", async () => {
    const clerk = new FakeClerk();
    const expired = await createDemoAccount(clerk, new Date(Date.now() - 3 * HOUR));
    clerk.users.clear();

    const result = await sweepExpiredDemoAccounts(clerk, { limit: 10 });

    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(await User.findById(expired.userId)).toBeNull();
  });

  it("keeps the record and its data when Clerk cannot delete, so a later sweep retries", async () => {
    const clerk = new FakeClerk();
    const expired = await createDemoAccount(clerk, new Date(Date.now() - 3 * HOUR));
    clerk.failDeleteWith = 500;

    const first = await sweepExpiredDemoAccounts(clerk, { limit: 10 });
    expect(first).toEqual({ deleted: 0, failed: 1 });
    expect(await User.findById(expired.userId)).not.toBeNull();

    clerk.failDeleteWith = null;
    const second = await sweepExpiredDemoAccounts(clerk, { limit: 10 });
    expect(second).toEqual({ deleted: 1, failed: 0 });
    expect(await recordsFor(expired.userId)).toEqual(EMPTY);
  });

  it("respects the batch limit", async () => {
    const clerk = new FakeClerk();
    const past = new Date(Date.now() - 3 * HOUR);
    await createDemoAccount(clerk, past);
    await createDemoAccount(clerk, past);
    await createDemoAccount(clerk, past);

    const result = await sweepExpiredDemoAccounts(clerk, { limit: 2 });
    expect(result.deleted).toBe(2);
    expect(await User.countDocuments({ isDemo: true })).toBe(1);
  });
});

describe("sweepOrphanClerkDemoUsers", () => {
  it("deletes old demo Clerk users with no record and spares everything else", async () => {
    const clerk = new FakeClerk();
    const withRecord = await createDemoAccount(clerk);
    const { id: orphan } = await clerk.createUser("demo+0123456789abcdef01234567@jobhunt.app");
    const { id: realClerk } = await clerk.createUser("real@example.com");

    const later = new Date(Date.now() + 3 * HOUR);
    const result = await sweepOrphanClerkDemoUsers(clerk, later);

    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(clerk.users.has(orphan)).toBe(false);
    expect(clerk.users.has(realClerk)).toBe(true);
    const user = await User.findById(withRecord.userId);
    expect(clerk.users.has(user!.clerkId)).toBe(true);
  });

  it("does not touch a demo Clerk user younger than the TTL (creation may be in flight)", async () => {
    const clerk = new FakeClerk();
    await clerk.createUser("demo+0123456789abcdef01234567@jobhunt.app");

    const result = await sweepOrphanClerkDemoUsers(clerk, new Date());
    expect(result.deleted).toBe(0);
    expect(clerk.users.size).toBe(1);
  });
});

describe("destroyDemoAccount", () => {
  it("deletes the Clerk user before any data", async () => {
    const clerk = new FakeClerk();
    const created = await createDemoAccount(clerk);
    const user = await User.findById(created.userId);
    clerk.failDeleteWith = 500;

    await expect(
      destroyDemoAccount({ clerkId: user!.clerkId, userId: created.userId }, clerk)
    ).rejects.toThrow("clerk outage");

    // Clerk refused, so nothing may have been deleted locally.
    expect(await User.findById(created.userId)).not.toBeNull();
    expect((await recordsFor(created.userId)).jobs).toBe(DEMO_SEED_COUNTS.jobs);
  });
});

describe("assertDemoCapacity", () => {
  it("allows a demo to add up to its allowance and refuses the next", async () => {
    const clerk = new FakeClerk();
    const created = await createDemoAccount(clerk);
    const user = (await User.findById(created.userId))!;

    for (let i = 0; i < DEMO_EXTRA_ALLOWANCE.jobs; i++) {
      await assertDemoCapacity(user, "jobs");
      await Job.create({ userId: user._id, company: `Extra ${i}`, role: "Role" });
    }

    await expect(assertDemoCapacity(user, "jobs")).rejects.toBeInstanceOf(DemoLimitError);
  });

  it("counts trashed jobs, so deleting cannot be used to keep adding", async () => {
    const clerk = new FakeClerk();
    const created = await createDemoAccount(clerk);
    const user = (await User.findById(created.userId))!;

    for (let i = 0; i < DEMO_EXTRA_ALLOWANCE.jobs; i++) {
      await Job.create({
        userId: user._id,
        company: `Trashed ${i}`,
        role: "Role",
        deletedAt: new Date(),
      });
    }

    await expect(assertDemoCapacity(user, "jobs")).rejects.toBeInstanceOf(DemoLimitError);
  });

  it("never limits real users", async () => {
    const real = await User.create({
      clerkId: "user_real",
      email: "real@example.com",
      status: "approved",
      isAdmin: false,
    });
    for (let i = 0; i < DEMO_SEED_COUNTS.jobs + DEMO_EXTRA_ALLOWANCE.jobs + 1; i++) {
      await Job.create({ userId: real._id, company: `Co ${i}`, role: "Role" });
    }

    await expect(assertDemoCapacity(real, "jobs")).resolves.toBeUndefined();
  });

  it("caps resumes separately from jobs", async () => {
    const clerk = new FakeClerk();
    const created = await createDemoAccount(clerk);
    const user = (await User.findById(created.userId))!;
    // Clone a seeded resume so the fixture always satisfies the Resume schema.
    const template = await Resume.findOne({ userId: created.userId }).lean();
    for (let i = 0; i < DEMO_EXTRA_ALLOWANCE.resumes; i++) {
      await Resume.create({ ...template, _id: undefined, isDefault: false, title: `Extra ${i}` });
    }
    await expect(assertDemoCapacity(user, "resumes")).rejects.toBeInstanceOf(DemoLimitError);
    await expect(assertDemoCapacity(user, "jobs")).resolves.toBeUndefined();
  });
});
