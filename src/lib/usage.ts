import mongoose from "mongoose";
import connectDB from "@/lib/db/connect";
import Plan, { IPlan } from "@/lib/models/Plan";
import Subscription from "@/lib/models/Subscription";
import Usage from "@/lib/models/Usage";
import UsageEvent from "@/lib/models/UsageEvent";
import User from "@/lib/models/User";

// ---------------------------------------------------------------------------
// Pricing table. Update if Anthropic changes rates.
// ---------------------------------------------------------------------------

// USD per million tokens, Anthropic first-party rates (checked 2026-10-01).
// Haiku 4.5 was $0.80/$4 and Opus $15/$75 here, which overstated Opus and
// understated Haiku, skewing the LaTeX export and template-analysis margins.
const MODEL_PRICING: Record<string, { inputPerMToken: number; outputPerMToken: number }> = {
  "claude-sonnet-4-5":            { inputPerMToken: 3.00,  outputPerMToken: 15.00 },
  "claude-sonnet-4-6":            { inputPerMToken: 3.00,  outputPerMToken: 15.00 },
  "claude-haiku-4-5":             { inputPerMToken: 1.00,  outputPerMToken: 5.00  },
  "claude-haiku-4-5-20251001":    { inputPerMToken: 1.00,  outputPerMToken: 5.00  },
  "claude-opus-4-5":              { inputPerMToken: 5.00,  outputPerMToken: 25.00 },
  "claude-opus-4-6":              { inputPerMToken: 5.00,  outputPerMToken: 25.00 },
};

/**
 * Calculates the USD cost for an Anthropic API call from token counts.
 * Falls back to Sonnet pricing for unknown models.
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet-4-5"];
  return (inputTokens / 1_000_000) * pricing.inputPerMToken
       + (outputTokens / 1_000_000) * pricing.outputPerMToken;
}

// ---------------------------------------------------------------------------
// Periods
//
// Each user has their own billing month, anchored to the day they were
// approved (docs/adr/0008). A user approved on the 14th resets on the 14th of
// every month. An anchor past the end of a short month is clamped to its last
// day (an anchor on the 31st resets Feb 28, then Mar 31), so cycles never
// drift. Boundaries fall at 00:00 UTC.
// ---------------------------------------------------------------------------

export type CreditCycle = {
  /** The cycle's key on Usage: its start date as "YYYY-MM-DD". */
  period: string;
  startsAt: Date;
  endsAt: Date;
};

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** The anchor day in the month containing (year, month), clamped. */
function cycleBoundary(anchorDay: number, year: number, month: number): Date {
  const normalised = new Date(Date.UTC(year, month, 1));
  const y = normalised.getUTCFullYear();
  const m = normalised.getUTCMonth();
  return new Date(Date.UTC(y, m, Math.min(anchorDay, daysInUtcMonth(y, m))));
}

/** The billing cycle containing `now` for a user anchored at `anchor`. */
export function getCycle(anchor: Date, now: Date = new Date()): CreditCycle {
  const anchorDay = anchor.getUTCDate();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  let startsAt = cycleBoundary(anchorDay, year, month);
  let startMonth = month;
  if (startsAt.getTime() > now.getTime()) {
    startMonth = month - 1;
    startsAt = cycleBoundary(anchorDay, year, startMonth);
  }
  const endsAt = cycleBoundary(anchorDay, year, startMonth + 1);

  return { period: startsAt.toISOString().slice(0, 10), startsAt, endsAt };
}

/** First millisecond of the current UTC calendar month, for platform totals. */
export function startOfUtcMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * The date a user's cycle is anchored to: their subscription's creation, which
 * happens on approval. Falls back to the account's creation (admins can have
 * no subscription), then to now.
 */
function cycleAnchor(
  subscription: { createdAt?: Date } | null | undefined,
  user: { createdAt?: Date } | null | undefined
): Date {
  return subscription?.createdAt ?? user?.createdAt ?? new Date();
}

// ---------------------------------------------------------------------------
// Credits
//
// Credits are the only limit a user can hit (docs/adr/0007). Each feature has
// a fixed price, charged in full before the call by one atomic conditional
// update, so the allowance holds under concurrent requests and is never
// overshot. Real USD cost is recorded after each call for the admin margin
// view, but it never refuses anyone.
// ---------------------------------------------------------------------------

export class CreditsExceededError extends Error {
  public readonly used: number;
  public readonly limit: number;
  public readonly periodEndsAt: Date;

  constructor(args: { used: number; limit: number; periodEndsAt: Date }) {
    super(
      `Out of credits (${args.used} of ${args.limit} used this cycle). Resets ${args.periodEndsAt.toISOString()}.`
    );
    this.name = "CreditsExceededError";
    this.used = args.used;
    this.limit = args.limit;
    this.periodEndsAt = args.periodEndsAt;
  }
}

/**
 * The user's credit allowance for their current billing month, and that
 * cycle. The allowance is an admin's per-user override if set, otherwise
 * their plan's. -1 is unlimited; admins are always unlimited.
 *
 * A plan saved without an allowance gives 0 rather than a guessed number, so
 * a configuration mistake refuses loudly instead of silently handing out the
 * paid allowance.
 *
 * Anyone not currently approved also gets 0. The routes check status first;
 * this is the backstop, because rejecting a user leaves their subscription in
 * place and a subscription alone would otherwise keep their credits live.
 */
async function resolveCreditContext(
  userId: mongoose.Types.ObjectId | string
): Promise<{ limit: number; cycle: CreditCycle }> {
  const [userDoc, subscription] = await Promise.all([
    User.findById(userId).lean(),
    Subscription.findOne({ userId }).lean(),
  ]);
  const cycle = getCycle(cycleAnchor(subscription, userDoc));

  if (!userDoc || userDoc.status !== "approved") return { limit: 0, cycle };
  if (userDoc.isAdmin) return { limit: -1, cycle };

  if (!subscription) {
    throw new Error(
      "No subscription found for user. Approving them creates one."
    );
  }

  const override = subscription.customLimits?.monthlyCredits;
  if (typeof override === "number") return { limit: override, cycle };

  const plan = await Plan.findOne({ key: subscription.planKey }).lean();
  if (!plan) throw new Error(`Plan not found: ${subscription.planKey}`);

  const allowance = (plan as IPlan).monthlyCredits;
  if (typeof allowance === "number") return { limit: allowance, cycle };

  console.error(
    `[credits] plan "${subscription.planKey}" has no monthlyCredits; its users get none until an admin sets one.`
  );
  return { limit: 0, cycle };
}

export type CreditReservation = {
  creditsCharged: number;
  /** The cycle charged. Refunds and spend must land in this same period. */
  period: string;
  limit: number;
  remaining: number;
  periodEndsAt: Date;
};

/**
 * Atomically charges `credits` if the user has room for them.
 *
 * Unlike the USD reservation, the whole cost is charged up front because it is
 * exact. The filter admits the call only when the full amount fits, so the
 * allowance can never be overshot, not even by one call.
 *
 * @throws {CreditsExceededError} when the allowance cannot cover the call.
 */
export async function reserveCredits(
  userId: mongoose.Types.ObjectId | string,
  credits: number
): Promise<CreditReservation> {
  await connectDB();

  const { limit, cycle } = await resolveCreditContext(userId);
  const { period, endsAt: periodEndsAt } = cycle;

  if (limit === -1) {
    return { creditsCharged: 0, period, limit: -1, remaining: -1, periodEndsAt };
  }

  await Usage.updateOne(
    { userId, period },
    { $setOnInsert: { userId, period, aiSpendUSD: 0, creditsUsed: 0 } },
    { upsert: true, strict: false }
  ).catch((err: unknown) => {
    if ((err as { code?: number })?.code !== 11000) throw err;
  });

  const updated = await Usage.findOneAndUpdate(
    { userId, period, creditsUsed: { $lte: limit - credits } },
    { $inc: { creditsUsed: credits } },
    { returnDocument: "after", strict: false }
  );

  if (!updated) {
    const current = await Usage.findOne({ userId, period }).lean();
    throw new CreditsExceededError({
      used: (current as { creditsUsed?: number } | null)?.creditsUsed ?? limit,
      limit,
      periodEndsAt,
    });
  }

  return {
    creditsCharged: credits,
    period,
    limit,
    remaining: Math.max(0, limit - updated.creditsUsed),
    periodEndsAt,
  };
}

/**
 * Refunds credits after a failed call, into the period they were charged to,
 * so a call that straddles a reset refunds the cycle that paid for it.
 */
export async function releaseCredits(
  userId: mongoose.Types.ObjectId | string,
  credits: number,
  period: string
): Promise<void> {
  if (credits <= 0) return;
  await connectDB();
  await Usage.findOneAndUpdate(
    { userId, period },
    { $inc: { creditsUsed: -credits } },
    { returnDocument: "after", strict: false }
  );
}

export type CreditBalance = {
  used: number;
  limit: number;
  remaining: number;
  periodStartsAt: Date;
  periodEndsAt: Date;
};

/** Credit balance for the user's current cycle. Never throws. */
export async function getCreditBalance(
  userId: mongoose.Types.ObjectId | string
): Promise<CreditBalance> {
  await connectDB();

  let context: { limit: number; cycle: CreditCycle };
  try {
    context = await resolveCreditContext(userId);
  } catch {
    const cycle = getCycle(new Date());
    return {
      used: 0,
      limit: 0,
      remaining: 0,
      periodStartsAt: cycle.startsAt,
      periodEndsAt: cycle.endsAt,
    };
  }
  const { limit, cycle } = context;

  const doc = await Usage.findOne({ userId, period: cycle.period }).lean();
  const used = (doc as { creditsUsed?: number } | null)?.creditsUsed ?? 0;

  return {
    used,
    limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - used),
    periodStartsAt: cycle.startsAt,
    periodEndsAt: cycle.endsAt,
  };
}

// ---------------------------------------------------------------------------
// Real cost, recorded for reporting only
// ---------------------------------------------------------------------------

/**
 * Adds a call's real USD cost to the total for `period` (the cycle the call
 * was charged to, from its reservation). Record-only: it
 * never refuses, because spend is not a limit, just what the admin margin
 * view reports against.
 *
 * `strict: false` ensures the write reaches MongoDB even when the Mongoose
 * model cache (from hot-reload in dev) has a stale schema.
 */
export async function recordSpend(
  userId: mongoose.Types.ObjectId | string,
  costUSD: number,
  period: string
): Promise<void> {
  if (costUSD <= 0) return;
  await connectDB();

  await Usage.findOneAndUpdate(
    { userId, period },
    {
      $inc: { aiSpendUSD: costUSD },
      $setOnInsert: { userId, period },
    },
    { upsert: true, returnDocument: "after", strict: false }
  );
}

/**
 * The user's real USD spend for their current cycle, for admin screens.
 * Never throws; a user with no subscription reports zero.
 */
export async function getCurrentUsage(
  userId: mongoose.Types.ObjectId | string
): Promise<{
  used: number;
  periodStartsAt: Date;
  periodEndsAt: Date;
  planKey: string | null;
}> {
  await connectDB();

  const [userDoc, subscription] = await Promise.all([
    User.findById(userId).lean(),
    Subscription.findOne({ userId }).lean(),
  ]);
  const cycle = getCycle(cycleAnchor(subscription, userDoc));
  const usageDoc = await Usage.findOne({ userId, period: cycle.period }).lean();

  return {
    used: (usageDoc as { aiSpendUSD?: number } | null)?.aiSpendUSD ?? 0,
    periodStartsAt: cycle.startsAt,
    periodEndsAt: cycle.endsAt,
    planKey: subscription?.planKey ?? null,
  };
}

/**
 * Total platform AI spend and the count of users who spent anything in the
 * current UTC calendar month. Used by the admin stats bar.
 *
 * Built from UsageEvent rather than Usage: each user's Usage periods follow
 * their own billing month, so they no longer line up into a platform month.
 */
export async function getPlatformStats(): Promise<{
  totalSpendUSD: number;
  activeUserCount: number;
}> {
  await connectDB();
  const result = await UsageEvent.aggregate([
    { $match: { createdAt: { $gte: startOfUtcMonth() } } },
    { $group: { _id: "$userId", spend: { $sum: "$costUSD" } } },
    {
      $group: {
        _id: null,
        totalSpendUSD: { $sum: "$spend" },
        activeUserCount: { $sum: { $cond: [{ $gt: ["$spend", 0] }, 1, 0] } },
      },
    },
  ]);
  const row = result[0] as { totalSpendUSD: number; activeUserCount: number } | undefined;
  return { totalSpendUSD: row?.totalSpendUSD ?? 0, activeUserCount: row?.activeUserCount ?? 0 };
}
