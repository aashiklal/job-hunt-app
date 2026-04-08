import mongoose from "mongoose";
import connectDB from "@/lib/db/connect";
import Plan, { IPlan } from "@/lib/models/Plan";
import Subscription, { ISubscription } from "@/lib/models/Subscription";
import Usage from "@/lib/models/Usage";

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
      `Quota exceeded for ${args.kind}: ${args.used}/${args.limit}. Resets ${args.periodEndsAt.toISOString()}.`
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
function getCurrentPeriod(): string {
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

/**
 * Returns the effective per-month limit for a given usage kind, honouring any
 * per-subscription custom overrides set by an admin.
 */
function getEffectiveLimit(
  plan: IPlan,
  subscription: ISubscription,
  kind: "aiGeneration"
): number {
  if (kind === "aiGeneration") {
    const customLimit = subscription.customLimits?.aiGenerationsPerMonth;
    if (typeof customLimit === "number") return customLimit;
    return plan.aiGenerationsPerMonth;
  }
  throw new Error(`Unknown usage kind: ${kind}`);
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Atomically checks whether the user is within their monthly quota for `kind`
 * and, if so, increments the counter by 1.
 *
 * The atomic guarantee comes from the conditional Mongo filter
 * `{ aiGenerations: { $lt: limit } }` inside the `findOneAndUpdate`. Two
 * parallel requests cannot both pass the limit because only one can land the
 * increment that brings the count to `limit` — the second request's filter
 * no longer matches.
 *
 * @throws {QuotaExceededError} when the user is at or above their limit.
 * @throws {Error} when no subscription or plan is found.
 *
 * @example
 * const { used, limit, periodEndsAt } = await checkAndIncrementUsage(userId, "aiGeneration");
 */
export async function checkAndIncrementUsage(
  userId: mongoose.Types.ObjectId | string,
  kind: "aiGeneration"
): Promise<{ used: number; limit: number; periodEndsAt: Date }> {
  await connectDB();

  const subscription = await Subscription.findOne({ userId });
  if (!subscription) {
    throw new Error(
      "No subscription found for user. Approve them or run backfill:subscriptions."
    );
  }

  const plan = await Plan.findOne({ key: subscription.planKey });
  if (!plan) {
    throw new Error(`Plan not found: ${subscription.planKey}`);
  }

  const limit = getEffectiveLimit(plan, subscription, kind);
  const period = getCurrentPeriod();
  const periodEndsAt = getPeriodEndsAt();

  try {
    const result = await Usage.findOneAndUpdate(
      {
        userId,
        period,
        aiGenerations: { $lt: limit },
      },
      {
        $inc: { aiGenerations: 1 },
        $setOnInsert: { userId, period },
      },
      {
        returnDocument: "after",
        upsert: true,
      }
    );

    // findOneAndUpdate with upsert returns null only in very old Mongo drivers;
    // with `new: true` it always returns the updated/inserted doc.
    // Non-null assertion is safe here because upsert guarantees a document.
    return { used: result!.aiGenerations, limit, periodEndsAt };
  } catch (err: unknown) {
    // When the document already exists at `limit`, the conditional filter
    // does not match, but upsert attempts to insert a new document. The
    // compound unique index on (userId, period) rejects that insert with
    // E11000. We catch it here and translate it into a QuotaExceededError.
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: number }).code === 11000
    ) {
      const existing = await Usage.findOne({ userId, period });
      throw new QuotaExceededError({
        kind,
        used: existing?.aiGenerations ?? limit,
        limit,
        periodEndsAt,
      });
    }
    throw err;
  }
}

/**
 * Decrements the usage counter by 1 for the current period. Call this to
 * refund a generation that failed **after** the increment already happened
 * (e.g. the Anthropic API call threw).
 *
 * The `$gt: 0` guard prevents the counter from going negative.
 * Silently no-ops if there is nothing to decrement.
 *
 * @example
 * await decrementUsage(userId, "aiGeneration");
 */
export async function decrementUsage(
  userId: mongoose.Types.ObjectId | string,
  kind: "aiGeneration"
): Promise<void> {
  // Validate kind so callers get a clear error early rather than a silent no-op.
  if (kind !== "aiGeneration") {
    throw new Error(`Unknown usage kind: ${kind}`);
  }

  await connectDB();

  const result = await Usage.findOneAndUpdate(
    { userId, period: getCurrentPeriod(), aiGenerations: { $gt: 0 } },
    { $inc: { aiGenerations: -1 } },
    { returnDocument: "after" }
  );

  if (!result) {
    console.warn(
      `[usage] decrementUsage: nothing to decrement for userId=${userId} kind=${kind} period=${getCurrentPeriod()}`
    );
  }
}

/**
 * Returns the user's current usage for the active period without modifying
 * any counters. Safe to call from dashboard widgets.
 *
 * Never throws — returns zeroed-out data when the subscription or plan is
 * missing so the UI degrades gracefully.
 *
 * @example
 * const { used, limit, periodEndsAt, planKey } = await getCurrentUsage(userId);
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

  const subscription = await Subscription.findOne({ userId });
  if (!subscription) {
    return { used: 0, limit: 0, periodEndsAt, planKey: null };
  }

  const plan = await Plan.findOne({ key: subscription.planKey });
  if (!plan) {
    return { used: 0, limit: 0, periodEndsAt, planKey: subscription.planKey };
  }

  const period = getCurrentPeriod();
  const usageDoc = await Usage.findOne({ userId, period });
  const used = usageDoc?.aiGenerations ?? 0;
  const limit = getEffectiveLimit(plan, subscription, "aiGeneration");

  return { used, limit, periodEndsAt, planKey: subscription.planKey };
}
