import mongoose from "mongoose";
import connectDB from "@/lib/db/connect";
import Plan, { IPlan } from "@/lib/models/Plan";
import Subscription, { ISubscription } from "@/lib/models/Subscription";
import Usage from "@/lib/models/Usage";
import User from "@/lib/models/User";

// ---------------------------------------------------------------------------
// Pricing table — update if Anthropic changes rates
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
 * Admins always pass — they have no cap.
 *
 * This is a read-only check — it does NOT increment anything. Call
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

/**
 * Records actual API cost after a successful Anthropic call.
 * Uses `$inc` so concurrent writes are safe.
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
 * Never throws — returns zeroed-out data when subscription or plan is missing.
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

  // Admins are unlimited — show spend but no cap
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
 * Sequence: checkBudget → fn() → calculateCost → addSpend.
 * Re-throws QuotaExceededError so routes continue to return 429.
 */
export async function withBudget<T>(
  userId: string,
  model: string,
  fn: () => Promise<{ result: T; inputTokens: number; outputTokens: number }>
): Promise<T> {
  await checkBudget(userId, "aiGeneration");
  const { result, inputTokens, outputTokens } = await fn();
  const cost = calculateCost(model, inputTokens, outputTokens);
  await addSpend(userId, "aiGeneration", cost);
  return result;
}
