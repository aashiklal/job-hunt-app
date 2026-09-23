import mongoose from "mongoose";
import connectDB from "@/lib/db/connect";
import Plan, { IPlan } from "@/lib/models/Plan";
import Subscription, { ISubscription } from "@/lib/models/Subscription";
import Usage from "@/lib/models/Usage";
import User from "@/lib/models/User";

// ---------------------------------------------------------------------------
// Pricing table. Update if Anthropic changes rates.
// ---------------------------------------------------------------------------

const MODEL_PRICING: Record<string, { inputPerMToken: number; outputPerMToken: number }> = {
  "claude-sonnet-4-5":            { inputPerMToken: 3.00,  outputPerMToken: 15.00 },
  "claude-sonnet-4-6":            { inputPerMToken: 3.00,  outputPerMToken: 15.00 },
  "claude-haiku-4-5":             { inputPerMToken: 0.80,  outputPerMToken: 4.00  },
  "claude-haiku-4-5-20251001":    { inputPerMToken: 0.80,  outputPerMToken: 4.00  },
  "claude-opus-4-5":              { inputPerMToken: 15.00, outputPerMToken: 75.00 },
  "claude-opus-4-6":              { inputPerMToken: 15.00, outputPerMToken: 75.00 },
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
// Error class
// ---------------------------------------------------------------------------

export class QuotaExceededError extends Error {
  public readonly kind: string;
  public readonly used: number;
  public readonly limit: number;
  public readonly periodEndsAt: Date;

  constructor(args: {
    kind: string;
    used: number;
    limit: number;
    periodEndsAt: Date;
  }) {
    super(
      `Monthly AI budget exceeded ($${args.used.toFixed(4)} of $${args.limit.toFixed(2)} used). Resets ${args.periodEndsAt.toISOString()}.`
    );
    this.name = "QuotaExceededError";
    this.kind = args.kind;
    this.used = args.used;
    this.limit = args.limit;
    this.periodEndsAt = args.periodEndsAt;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
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

/** Returns the effective monthly spend limit in USD, honouring any admin override. */
function getSpendLimit(plan: IPlan, subscription: ISubscription): number {
  const customLimit = subscription.customLimits?.aiSpendLimitUSD;
  if (typeof customLimit === "number") return customLimit;
  return plan.aiSpendLimitUSD ?? 5.0;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Reads the user's current spend and throws `QuotaExceededError` if they are
 * at or over their monthly USD budget.
 *
 * Admins always pass because they have no cap.
 *
 * This is a read-only check and does not increment anything. Call
 * `addSpend()` after a successful API call to record the actual cost.
 *
 * @throws {QuotaExceededError} when the user is at or above their budget.
 */
export async function checkBudget(
  userId: mongoose.Types.ObjectId | string,
  kind: "aiGeneration"
): Promise<{ spentUSD: number; limitUSD: number; periodEndsAt: Date }> {
  if (kind !== "aiGeneration") throw new Error(`Unknown usage kind: ${kind}`);
  await connectDB();

  const periodEndsAt = getPeriodEndsAt();

  // Admins have no spending cap
  const userDoc = await User.findById(userId).lean();
  if (userDoc?.isAdmin) {
    const period = getCurrentPeriod();
    const usageDoc = await Usage.findOne({ userId, period }).lean();
    return { spentUSD: (usageDoc as { aiSpendUSD?: number } | null)?.aiSpendUSD ?? 0, limitUSD: -1, periodEndsAt };
  }

  const subscription = await Subscription.findOne({ userId });
  if (!subscription) {
    throw new Error(
      "No subscription found for user. Approve them or run backfill:subscriptions."
    );
  }

  const plan = await Plan.findOne({ key: subscription.planKey }).lean();
  if (!plan) {
    throw new Error(`Plan not found: ${subscription.planKey}`);
  }

  const limitUSD = getSpendLimit(plan as IPlan, subscription);
  const period = getCurrentPeriod();

  const usageDoc = await Usage.findOne({ userId, period }).lean();
  const spentUSD = (usageDoc as { aiSpendUSD?: number } | null)?.aiSpendUSD ?? 0;

  if (limitUSD !== -1 && spentUSD >= limitUSD) {
    throw new QuotaExceededError({
      kind,
      used: spentUSD,
      limit: limitUSD,
      periodEndsAt,
    });
  }

  return { spentUSD, limitUSD, periodEndsAt };
}

// ---------------------------------------------------------------------------
// Reserve-then-reconcile
//
// checkBudget() reads spend and addSpend() writes it, but the Anthropic call
// sits between them. That gap is a check-then-act race: concurrent requests
// all read the same stale total, all pass the check, and all proceed, so the
// budget ceiling only holds for serial traffic.
//
// reserveSpend() closes it by making the check and the charge a single atomic
// conditional update. The business rule is unchanged ("you may start a call
// while you are under budget"), but now only one concurrent caller can win it,
// so overrun is bounded by a single call's reservation instead of by however
// many requests arrive at once.
// ---------------------------------------------------------------------------

/**
 * Resolves a user's effective spend limit. Returns -1 for unlimited (admins,
 * or a plan with no cap).
 */
async function resolveLimit(
  userId: mongoose.Types.ObjectId | string
): Promise<number> {
  const userDoc = await User.findById(userId).lean();
  if (userDoc?.isAdmin) return -1;

  const subscription = await Subscription.findOne({ userId });
  if (!subscription) {
    throw new Error(
      "No subscription found for user. Approve them or run backfill:subscriptions."
    );
  }

  const plan = await Plan.findOne({ key: subscription.planKey }).lean();
  if (!plan) {
    throw new Error(`Plan not found: ${subscription.planKey}`);
  }

  return getSpendLimit(plan as IPlan, subscription);
}

/**
 * A deliberately generous up-front estimate of what a call will cost, assuming
 * the response uses its whole token budget and the prompt is comparable in
 * size. Over-reserving is corrected downward the moment the call returns;
 * under-reserving is what lets concurrent calls overshoot, so err high.
 */
export function estimateCallCost(model: string, maxTokens: number): number {
  return calculateCost(model, maxTokens, maxTokens);
}

export type Reservation = {
  /** Amount provisionally charged. Always 0 for unlimited users. */
  reservedUSD: number;
  limitUSD: number;
  periodEndsAt: Date;
};

/**
 * Atomically verifies the user is under budget and charges `estimateUSD`
 * against them in the same operation.
 *
 * @throws {QuotaExceededError} when the user is at or over their budget.
 */
export async function reserveSpend(
  userId: mongoose.Types.ObjectId | string,
  kind: "aiGeneration",
  estimateUSD: number
): Promise<Reservation> {
  if (kind !== "aiGeneration") throw new Error(`Unknown usage kind: ${kind}`);
  await connectDB();

  const periodEndsAt = getPeriodEndsAt();
  const period = getCurrentPeriod();
  const limitUSD = await resolveLimit(userId);

  // Unlimited users skip reservation entirely; their spend is still recorded
  // after the call, it just cannot be refused.
  if (limitUSD === -1) {
    return { reservedUSD: 0, limitUSD: -1, periodEndsAt };
  }

  // Ensure the period document exists before the conditional update. Doing the
  // conditional update with upsert:true would insert a duplicate when the
  // filter fails to match an over-budget document; the unique index on
  // {userId, period} makes this first write safe under concurrency.
  await Usage.updateOne(
    { userId, period },
    { $setOnInsert: { userId, period, aiSpendUSD: 0 } },
    { upsert: true, strict: false }
  ).catch((err: unknown) => {
    // A concurrent caller won the insert. That is the expected outcome, not an
    // error, so long as the document now exists.
    if ((err as { code?: number })?.code !== 11000) throw err;
  });

  // The atomic step. Matches only while the user is under budget, so exactly
  // one of N concurrent callers at the threshold can succeed.
  const updated = await Usage.findOneAndUpdate(
    { userId, period, aiSpendUSD: { $lt: limitUSD } },
    { $inc: { aiSpendUSD: estimateUSD } },
    { returnDocument: "after", strict: false }
  );

  if (!updated) {
    const current = await Usage.findOne({ userId, period }).lean();
    throw new QuotaExceededError({
      kind,
      used: (current as { aiSpendUSD?: number } | null)?.aiSpendUSD ?? limitUSD,
      limit: limitUSD,
      periodEndsAt,
    });
  }

  return { reservedUSD: estimateUSD, limitUSD, periodEndsAt };
}

// ---------------------------------------------------------------------------
// Credits
//
// Credits are what users see and what actually refuses them. They are exact
// and known before the call, so unlike the USD path there is nothing to
// reconcile afterwards. The USD ceiling stays underneath as a backstop in case
// a credit weight is mis-tuned relative to real token usage.
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

async function resolveCreditLimit(
  userId: mongoose.Types.ObjectId | string
): Promise<number> {
  const userDoc = await User.findById(userId).lean();
  if (userDoc?.isAdmin) return -1;

  const subscription = await Subscription.findOne({ userId });
  if (!subscription) {
    throw new Error(
      "No subscription found for user. Approve them or run backfill:subscriptions."
    );
  }

  const plan = await Plan.findOne({ key: subscription.planKey }).lean();
  if (!plan) throw new Error(`Plan not found: ${subscription.planKey}`);

  const planDoc = plan as IPlan;
  if (typeof planDoc.monthlyCredits === "number") return planDoc.monthlyCredits;

  // No allowance configured. Falling back to a fixed generous number would
  // quietly make an unconfigured plan the most generous on the system, which
  // is how a free tier ends up costing the same as a paid one. Derive it from
  // the plan's own USD ceiling instead, so the fallback can never exceed what
  // that plan was already allowed to spend.
  const derived = Math.floor((planDoc.aiSpendLimitUSD ?? 0) / USD_PER_CREDIT);
  return Math.max(0, derived);
}

/** Rough USD cost of one credit, used only to derive a fallback allowance. */
const USD_PER_CREDIT = 0.006;

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

/**
 * Corrects a reservation to the true cost once token counts are known.
 * The delta may be negative, which is the normal case.
 */
export async function reconcileSpend(
  userId: mongoose.Types.ObjectId | string,
  reservedUSD: number,
  actualUSD: number
): Promise<void> {
  const delta = actualUSD - reservedUSD;
  if (delta === 0) return;
  await connectDB();

  const period = getCurrentPeriod();
  await Usage.findOneAndUpdate(
    { userId, period },
    { $inc: { aiSpendUSD: delta }, $setOnInsert: { userId, period } },
    { upsert: true, returnDocument: "after", strict: false }
  );
}

/** Refunds a reservation in full after a failed call. */
export async function releaseSpend(
  userId: mongoose.Types.ObjectId | string,
  reservedUSD: number
): Promise<void> {
  if (reservedUSD <= 0) return;
  return reconcileSpend(userId, reservedUSD, 0);
}

/**
 * Records actual API cost after a successful Anthropic call.
 * Uses `$inc` so concurrent writes are safe.
 *
 * Prefer reserveSpend() + reconcileSpend() for anything gated by a budget:
 * this function only records, it does not enforce, so calling it alone
 * reintroduces the check-then-act race described above.
 *
 * `strict: false` ensures the write reaches MongoDB even when the Mongoose
 * model cache (from hot-reload in dev) has a stale schema.
 */
export async function addSpend(
  userId: mongoose.Types.ObjectId | string,
  kind: "aiGeneration",
  costUSD: number
): Promise<void> {
  if (kind !== "aiGeneration") throw new Error(`Unknown usage kind: ${kind}`);
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
 * Returns the user's current USD spend and budget for the active period.
 * Admins return limit = -1 (unlimited).
 * Never throws. Returns zeroed-out data when subscription or plan is missing.
 */
export async function getCurrentUsage(
  userId: mongoose.Types.ObjectId | string
): Promise<{
  used: number;
  limit: number;
  periodEndsAt: Date;
  planKey: string | null;
}> {
  await connectDB();

  const periodEndsAt = getPeriodEndsAt();
  const period = getCurrentPeriod();

  // Admins are unlimited, so show spend but no cap.
  const userDoc = await User.findById(userId).lean();
  if (userDoc?.isAdmin) {
    const usageDoc = await Usage.findOne({ userId, period }).lean();
    return { used: (usageDoc as { aiSpendUSD?: number } | null)?.aiSpendUSD ?? 0, limit: -1, periodEndsAt, planKey: null };
  }

  const subscription = await Subscription.findOne({ userId });
  if (!subscription) {
    return { used: 0, limit: 0, periodEndsAt, planKey: null };
  }

  const plan = await Plan.findOne({ key: subscription.planKey }).lean();
  if (!plan) {
    return { used: 0, limit: 0, periodEndsAt, planKey: subscription.planKey };
  }

  const usageDoc = await Usage.findOne({ userId, period }).lean();
  const used = (usageDoc as { aiSpendUSD?: number } | null)?.aiSpendUSD ?? 0;
  const limit = getSpendLimit(plan as IPlan, subscription);

  return { used, limit, periodEndsAt, planKey: subscription.planKey };
}

/**
 * Returns current-period spend for a list of user IDs in one query.
 * Used by the admin users table to show per-user spend.
 * Returns a map of userId string → spentUSD.
 */
export async function getBulkSpend(
  userIds: string[]
): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  await connectDB();

  const period = getCurrentPeriod();
  const docs = await Usage.find({ userId: { $in: userIds }, period }).lean();

  const map: Record<string, number> = {};
  for (const doc of docs) {
    map[doc.userId.toString()] = (doc as { aiSpendUSD?: number }).aiSpendUSD ?? 0;
  }
  return map;
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

/**
 * Wraps an AI call with quota enforcement and spend recording.
 * Sequence: reserveSpend → fn() → calculateCost → reconcileSpend, releasing
 * the reservation if the call throws.
 * Re-throws QuotaExceededError so routes continue to return 429.
 */
export async function withBudget<T>(
  userId: string,
  model: string,
  maxTokens: number,
  fn: () => Promise<{ result: T; inputTokens: number; outputTokens: number }>
): Promise<T> {
  const { reservedUSD } = await reserveSpend(
    userId,
    "aiGeneration",
    estimateCallCost(model, maxTokens)
  );

  try {
    const { result, inputTokens, outputTokens } = await fn();
    const cost = calculateCost(model, inputTokens, outputTokens);
    await reconcileSpend(userId, reservedUSD, cost);
    return result;
  } catch (err) {
    await releaseSpend(userId, reservedUSD).catch((releaseErr) =>
      console.error("[releaseSpend failed]", releaseErr)
    );
    throw err;
  }
}
