import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestMongo, stopTestMongo, clearTestMongo } from "@/test/mongo";
import User from "@/lib/models/User";
import { claimByEmail } from "@/lib/repositories/users";

/**
 * claimByEmail exists so an admin pre-provisioned by scripts/bootstrap-admin.ts
 * is linked to their Clerk account on first sign-in. It must never relink a
 * real account: that would hand its jobs, resumes and admin rights to whoever
 * next registers the same address in Clerk.
 */

beforeAll(async () => {
  await startTestMongo();
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
});

describe("claimByEmail", () => {
  it("links a bootstrap placeholder to the new Clerk account", async () => {
    await User.create({
      clerkId: "pending_1700000000000",
      email: "owner@example.com",
      status: "approved",
      isAdmin: true,
    });

    const claimed = await claimByEmail("owner@example.com", "user_new", {});

    expect(claimed?.clerkId).toBe("user_new");
    expect(claimed?.isAdmin).toBe(true);
  });

  it("refuses to relink an account that already belongs to a Clerk user", async () => {
    await User.create({
      clerkId: "user_original",
      email: "owner@example.com",
      status: "approved",
      isAdmin: true,
    });

    const claimed = await claimByEmail("owner@example.com", "user_attacker", {});

    expect(claimed).toBeNull();
    const stored = await User.findOne({ email: "owner@example.com" }).lean();
    expect(stored?.clerkId).toBe("user_original");
  });
});
