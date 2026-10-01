import mongoose from "mongoose";
import connectDB from "@/lib/db/connect";
import Plan, { IPlan } from "@/lib/models/Plan";
import Subscription from "@/lib/models/Subscription";
import Usage from "@/lib/models/Usage";
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
// ---------------------------------------------------------------------------

/** Returns the current billing period as "YYYY-MM" in UTC. */
export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Returns a Date for the first millisecond of the next UTC month. */
function getPeriodEndsAt(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  );
}

// ---------------------------------------------------------------------------
// Credits
//
// Credits are the only limit a user can hit (docs/adr/0006). Each feature has
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
      `Out of credits (${args.used} of ${args.limit} used this month). Resets ${args.periodEndsAt.toISOString()}.`
    );
    this.name = "CreditsExceededError";
    this.used = args.used;
    this.limit = args.limit;
    this.periodEndsAt = args.periodEndsAt;
  }
}

/**
 * The user's monthly credit allowance: an admin's per-user override if set,
 * otherwise their plan's. -1 is unlimited; admins are always unlimited.
 *
 * A plan saved without an allowance gives 0 rather than a guessed number, so
 * a configuration mistake refuses loudly instead of silently handing out the
 * paid allowance.
 *
 * Anyone not currently approved also gets 0. The routes check status first;
 * this is the backstop, because rejecting a user leaves their subscription in
 * place and a subscription alone would otherwise keep their credits live.
 */
async function resolveCreditLimit(
  userId: mongoose.Types.ObjectId | string
): Promise<number> {
  const userDoc = await User.findById(userId).lean();
  if (!userDoc || userDoc.status !== "approved") return 0;
  if (userDoc.isAdmin) return -1;

  const subscription = await Subscription.findOne({ userId }).lean();
  if (!subscription) {
    throw new Error(
      "No subscription found for user. Approving them creates one."
    );
  }

  const override = subscription.customLimits?.monthlyCredits;
  if (typeof override === "number") return override;

  const plan = await Plan.findOne({ key: subscription.planKey }).lean();
  if (!plan) throw new Error(`Plan not found: ${subscription.planKey}`);

  const allowance = (plan as IPlan).monthlyCredits;
  if (typeof allowance === "number") return allowance;

  console.error(
    `[credits] plan "${subscription.planKey}" has no monthlyCredits; its users get none until an admin sets one.`
  );
  return 0;
}

export type CreditReservation = {
  creditsCharged: number;
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

  const periodEndsAt = getPeriodEndsAt();
  const period = getCurrentPeriod();
  const limit = await resolveCreditLimit(userId);

  if (limit === -1) {
    return { creditsCharged: 0, limit: -1, remaining: -1, periodEndsAt };
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
    limit,
    remaining: Math.max(0, limit - updated.creditsUsed),
    periodEndsAt,
  };
}

/** Refunds credits after a failed call. */
export async function releaseCredits(
  userId: mongoose.Types.ObjectId | string,
  credits: number
): Promise<void> {
  if (credits <= 0) return;
  await connectDB();
  await Usage.findOneAndUpdate(
    { userId, period: getCurrentPeriod() },
    { $inc: { creditsUsed: -credits } },
    { returnDocument: "after", strict: false }
  );
}

/** Credit balance for the current period. Never throws. */
export async function getCreditBalance(
  userId: mongoose.Types.ObjectId | string
): Promise<{ used: number; limit: number; remaining: number; periodEndsAt: Date }> {
  await connectDB();
  const periodEndsAt = getPeriodEndsAt();

  let limit: number;
  try {
    limit = await resolveCreditLimit(userId);
  } catch {
    return { used: 0, limit: 0, remaining: 0, periodEndsAt };
  }

  const doc = await Usage.findOne({
    userId,
    period: getCurrentPeriod(),
  }).lean();
  const used = (doc as { creditsUsed?: number } | null)?.creditsUsed ?? 0;

  return {
    used,
    limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - used),
    periodEndsAt,
  };
}

// ---------------------------------------------------------------------------
// Real cost, recorded for reporting only
// ---------------------------------------------------------------------------

/**
 * Adds a call's real USD cost to the user's period total. Record-only: it
 * never refuses, because spend is not a limit, just what the admin margin
 * view reports against.
 *
 * `strict: false` ensures the write reaches MongoDB even when the Mongoose
 * model cache (from hot-reload in dev) has a stale schema.
 */
export async function recordSpend(
  userId: mongoose.Types.ObjectId | string,
  costUSD: number
): Promise<void> {
  if (costUSD <= 0) return;
  await connectDB();

  const period = getCurrentPeriod();
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
 * The user's real USD spend for the current period, for admin screens.
 * Never throws; a user with no subscription reports zero.
 */
export async function getCurrentUsage(
  userId: mongoose.Types.ObjectId | string
): Promise<{ used: number; periodEndsAt: Date; planKey: string | null }> {
  await connectDB();

  const periodEndsAt = getPeriodEndsAt();
  const period = getCurrentPeriod();

  const [subscription, usageDoc] = await Promise.all([
    Subscription.findOne({ userId }).lean(),
    Usage.findOne({ userId, period }).lean(),
  ]);

  return {
    used: (usageDoc as { aiSpendUSD?: number } | null)?.aiSpendUSD ?? 0,
    periodEndsAt,
    planKey: subscription?.planKey ?? null,
  };
}

/**
 * Returns total platform AI spend and the count of users who have spent
 * anything in the current billing period. Used by the admin stats bar.
 */
export async function getPlatformStats(): Promise<{
  totalSpendUSD: number;
  activeUserCount: number;
}> {
  await connectDB();
  const period = getCurrentPeriod();
  const result = await Usage.aggregate([
    { $match: { period } },
    {
      $group: {
        _id: null,
        totalSpendUSD: { $sum: "$aiSpendUSD" },
        activeUserCount: { $sum: { $cond: [{ $gt: ["$aiSpendUSD", 0] }, 1, 0] } },
      },
    },
  ]);
  const row = result[0] as { totalSpendUSD: number; activeUserCount: number } | undefined;
  return { totalSpendUSD: row?.totalSpendUSD ?? 0, activeUserCount: row?.activeUserCount ?? 0 };
}
