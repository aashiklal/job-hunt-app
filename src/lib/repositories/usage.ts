import connectDB from "@/lib/db/connect";
import Usage, { IUsage } from "@/lib/models/Usage";
import { Types } from "mongoose";
import { getCurrentPeriod } from "@/lib/usage";

export async function getCurrentPeriodUsage(
  userId: string
): Promise<IUsage | null> {
  await connectDB();
  const period = getCurrentPeriod();
  return Usage.findOne({ userId, period });
}

export async function listForUser(
  userId: string,
  options?: { limit?: number }
): Promise<IUsage[]> {
  await connectDB();
  const limit = options?.limit ?? 12;
  return Usage.find({ userId }).sort({ period: -1 }).limit(limit);
}

/**
 * Current-period cost and credits for a set of users, keyed by user id.
 *
 * Drives the margin bars. Every requested id gets an entry, since a missing
 * key would render as a blank bar rather than a zero-cost one.
 */
export async function currentPeriodByUser(
  userIds: string[]
): Promise<Record<string, { costUSD: number; credits: number }>> {
  const result: Record<string, { costUSD: number; credits: number }> = {};
  for (const id of userIds) result[id] = { costUSD: 0, credits: 0 };
  if (userIds.length === 0) return result;

  await connectDB();
  const docs = await Usage.find({
    userId: { $in: userIds.map((id) => new Types.ObjectId(id)) },
    period: getCurrentPeriod(),
  }).lean();

  for (const doc of docs) {
    result[doc.userId.toString()] = {
      costUSD: doc.aiSpendUSD ?? 0,
      credits: doc.creditsUsed ?? 0,
    };
  }
  return result;
}

/**
 * Platform-wide cost per month, oldest first.
 *
 * Uses the Usage counters rather than UsageEvent deliberately: these hold the
 * only record of spend from before per-call tracking existed, and monthly is
 * exactly the grain this chart needs.
 */
export async function monthlyTotals(
  opts: { limit?: number; excludeUserIds?: string[] } = {}
): Promise<Array<{ period: string; costUSD: number; credits: number }>> {
  await connectDB();

  const match: Record<string, unknown> = {};
  if (opts.excludeUserIds?.length) {
    match.userId = {
      $nin: opts.excludeUserIds.map((id) => new Types.ObjectId(id)),
    };
  }

  const rows = await Usage.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: "$period",
        costUSD: { $sum: "$aiSpendUSD" },
        credits: { $sum: "$creditsUsed" },
      },
    },
    { $sort: { _id: -1 } },
    ...(opts.limit ? [{ $limit: opts.limit }] : []),
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({
    period: r._id as string,
    costUSD: r.costUSD ?? 0,
    credits: r.credits ?? 0,
  }));
}

/**
 * Deletes every usage record for a user, resetting their spend to zero.
 *
 * Used by the demo reset. Demo AI calls are served from fixtures and should
 * never cost anything, but if any spend does accrue it would otherwise
 * accumulate across resets until the shared demo account hit its cap and
 * stopped working for every visitor.
 */
export async function deleteAllForUser(userId: string): Promise<number> {
  await connectDB();
  const result = await Usage.deleteMany({ userId });
  return result.deletedCount ?? 0;
}
