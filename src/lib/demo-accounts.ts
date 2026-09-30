import "server-only";

import { randomBytes } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";
import * as jobs from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import * as offers from "@/lib/repositories/offers";
import * as starStories from "@/lib/repositories/star-stories";
import { DEMO_SEED_COUNTS, seedDemoData, wipeDemoData } from "@/lib/demo-seed";
import { buildDemoEmail } from "@/lib/demo-constants";
import { isDemoUser } from "@/lib/demo";
import {
  DEMO_EXTRA_ALLOWANCE,
  DemoLimitError,
  type DemoCapacityKind,
} from "@/lib/demo-limits";

/**
 * Per-visitor demo accounts.
 *
 * Every "Try the live demo" click gets its own Clerk user and its own copy of
 * the sample data, deleted after DEMO_TTL. A shared account let each visitor
 * see what the previous one typed, change the shared profile, and exhaust
 * per-user rate limits for everyone; isolating visitors removes all three.
 *
 * Invariants this module keeps:
 * - The Mongo user is written, with its expiry, before any data is seeded, so
 *   a crash mid-creation always leaves a record the sweep can find.
 * - Deletion removes the Clerk user first. That kills every live session, so a
 *   visitor can never be signed in to an account whose data is half gone. If
 *   the Clerk delete fails, the Mongo record is kept so the next sweep retries.
 * - Expiry is enforced on every request (see isDemoExpired and its callers),
 *   so a late or failed sweep never extends a demo's life.
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function demoTtlMs(): number {
  return positiveIntFromEnv("DEMO_TTL_MINUTES", 120) * 60 * 1000;
}

/** Ceiling on concurrently live demo accounts, whatever the traffic source. */
function maxLiveDemos(): number {
  return positiveIntFromEnv("DEMO_MAX_LIVE", 200);
}


// ---------------------------------------------------------------------------
// Clerk port
// ---------------------------------------------------------------------------

/**
 * The Clerk operations this module needs. Injected so tests can exercise the
 * failure paths (a Clerk outage mid-delete, a user already gone) without a
 * network.
 */
export type DemoClerk = {
  createUser(email: string): Promise<{ id: string }>;
  /** Resolves when the user is gone, including when it was already gone. */
  deleteUser(clerkId: string): Promise<void>;
  createSignInTicket(clerkId: string, ttlSeconds: number): Promise<string>;
  /** Demo-flagged Clerk users created before the cutoff. */
  listDemoUsersCreatedBefore(cutoff: Date): Promise<Array<{ id: string }>>;
};

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: unknown }).status === 404
  );
}

export function createDefaultDemoClerk(): DemoClerk {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is not set.");
  }
  const clerk = createClerkClient({ secretKey });

  return {
    async createUser(email) {
      const user = await clerk.users.createUser({
        emailAddress: [email],
        firstName: "Demo",
        lastName: "Visitor",
        skipPasswordRequirement: true,
        skipLegalChecks: true,
        publicMetadata: { demo: true },
      });
      return { id: user.id };
    },

    async deleteUser(clerkId) {
      try {
        await clerk.users.deleteUser(clerkId);
      } catch (err) {
        if (isNotFound(err)) return;
        throw err;
      }
    },

    async createSignInTicket(clerkId, ttlSeconds) {
      const token = await clerk.signInTokens.createSignInToken({
        userId: clerkId,
        expiresInSeconds: ttlSeconds,
      });
      return token.token;
    },

    async listDemoUsersCreatedBefore(cutoff) {
      const found: Array<{ id: string }> = [];
      const pageSize = 100;
      for (let offset = 0; offset < 5000; offset += pageSize) {
        const page = await clerk.users.getUserList({
          query: "demo+",
          createdAtBefore: cutoff.getTime(),
          limit: pageSize,
          offset,
        });
        for (const user of page.data) {
          if (user.publicMetadata?.demo === true) found.push({ id: user.id });
        }
        if (page.data.length < pageSize) break;
      }
      return found;
    },
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** No capacity for another live demo right now. Maps to 503. */
export class DemoCapacityError extends Error {
  constructor() {
    super("Too many demos are running right now.");
    this.name = "DemoCapacityError";
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

const TICKET_TTL_SECONDS = 60;

function idOf(user: { _id: unknown }): string {
  return (user._id as { toString(): string }).toString();
}

/**
 * Deletes a demo account completely. Clerk first, then data, subscription and
 * user record. Throws if Clerk refuses, leaving the Mongo record in place for
 * the next sweep.
 */
export async function destroyDemoAccount(
  account: { clerkId: string | null; userId: string | null },
  clerk: DemoClerk
): Promise<void> {
  if (account.clerkId) {
    await clerk.deleteUser(account.clerkId);
  }
  if (account.userId) {
    await wipeDemoData(account.userId);
    await subscriptions.deleteForUser(account.userId);
    await users.deleteById(account.userId);
  }
}

export type CreatedDemo = { ticket: string; userId: string; expiresAt: Date };

/**
 * Creates a private demo account, seeds it, and returns a one-minute sign-in
 * ticket. On any failure it removes whatever it had created and rethrows.
 */
export async function createDemoAccount(
  clerk: DemoClerk,
  now: Date = new Date()
): Promise<CreatedDemo> {
  if ((await users.countLiveDemos(now)) >= maxLiveDemos()) {
    throw new DemoCapacityError();
  }

  const email = buildDemoEmail(randomBytes(12).toString("hex"));
  const expiresAt = new Date(now.getTime() + demoTtlMs());

  let clerkId: string | null = null;
  let userId: string | null = null;

  try {
    clerkId = (await clerk.createUser(email)).id;

    const user = await users.createDemo({ clerkId, email, expiresAt });
    userId = idOf(user);

    const subscription = await subscriptions.ensureForUser(userId);
    if (!subscription) {
      throw new Error("Could not create a subscription for the demo account.");
    }
    await subscriptions.setBillingStatus(userId, "comped");

    await seedDemoData(userId);

    const ticket = await clerk.createSignInTicket(clerkId, TICKET_TTL_SECONDS);
    return { ticket, userId, expiresAt };
  } catch (err) {
    try {
      await destroyDemoAccount({ clerkId, userId }, clerk);
    } catch (cleanupErr) {
      // The sweep will finish the job: the Mongo record, if any, is still
      // there with its expiry, and orphaned Clerk users are swept too.
      console.error("[demo] cleanup after failed creation also failed:", cleanupErr);
    }
    throw err;
  }
}

export type SweepResult = { deleted: number; failed: number };

/**
 * Deletes expired and legacy demo accounts, oldest first. A failure on one
 * account is logged and skipped so it cannot block the rest.
 */
export async function sweepExpiredDemoAccounts(
  clerk: DemoClerk,
  opts: { limit: number; now?: Date }
): Promise<SweepResult> {
  const due = await users.listDemosToSweep(opts.now ?? new Date(), opts.limit);
  const result: SweepResult = { deleted: 0, failed: 0 };

  for (const user of due) {
    try {
      await destroyDemoAccount({ clerkId: user.clerkId, userId: idOf(user) }, clerk);
      result.deleted += 1;
    } catch (err) {
      result.failed += 1;
      console.error(`[demo] sweep could not delete ${idOf(user)}:`, err);
    }
  }

  return result;
}

/**
 * Deletes demo-flagged Clerk users with no Mongo record, left behind if
 * creation died between the Clerk call and the Mongo insert. Only users older
 * than the TTL are considered, so a creation still in flight is never touched.
 */
export async function sweepOrphanClerkDemoUsers(
  clerk: DemoClerk,
  now: Date = new Date()
): Promise<SweepResult> {
  const cutoff = new Date(now.getTime() - demoTtlMs());
  const candidates = await clerk.listDemoUsersCreatedBefore(cutoff);
  const result: SweepResult = { deleted: 0, failed: 0 };

  for (const candidate of candidates) {
    try {
      if (await users.getByClerkId(candidate.id)) continue;
      await clerk.deleteUser(candidate.id);
      result.deleted += 1;
    } catch (err) {
      result.failed += 1;
      console.error(`[demo] orphan sweep could not delete ${candidate.id}:`, err);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Creation caps
// ---------------------------------------------------------------------------

const COUNTERS: Record<DemoCapacityKind, (userId: string) => Promise<number>> = {
  jobs: jobs.countForUserIncludingTrash,
  resumes: resumes.countForUser,
  offers: offers.countForUser,
  starStories: starStories.countForUser,
};

/**
 * Refuses a create when a demo account is at its cap. No-op for real users.
 * Called at the top of each create action.
 */
export async function assertDemoCapacity(
  user: { _id: unknown; isDemo?: boolean; email?: string },
  kind: DemoCapacityKind
): Promise<void> {
  if (!isDemoUser(user)) return;
  const limit = DEMO_SEED_COUNTS[kind] + DEMO_EXTRA_ALLOWANCE[kind];
  const current = await COUNTERS[kind](idOf(user));
  if (current >= limit) {
    throw new DemoLimitError(kind);
  }
}
