import connectDB from "@/lib/db/connect";
import Usage, { IUsage } from "@/lib/models/Usage";
import { Types } from "mongoose";

export async function listForUser(
  userId: string,
  options?: { limit?: number }
): Promise<IUsage[]> {
  await connectDB();
  const limit = options?.limit ?? 12;
  return Usage.find({ userId }).sort({ period: -1 }).limit(limit);
}

/**
 * Cost and credits for each user's current period, keyed by user id. Each
 * user has their own billing month, so callers pass the period per user (see
 * getCycle in usage.ts).
 *
 * Drives the margin bars. Every requested id gets an entry, since a missing
 * key would render as a blank bar rather than a zero-cost one.
 */
export async function currentPeriodByUser(
  entries: Array<{ userId: string; period: string }>
): Promise<Record<string, { costUSD: number; credits: number }>> {
  const result: Record<string, { costUSD: number; credits: number }> = {};
  for (const e of entries) result[e.userId] = { costUSD: 0, credits: 0 };
  if (entries.length === 0) return result;

  await connectDB();
  const docs = await Usage.find({
    $or: entries.map((e) => ({
      userId: new Types.ObjectId(e.userId),
      period: e.period,
    })),
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
 * Platform-wide cost per month ("YYYY-MM"), oldest first.
 *
 * Uses the Usage counters rather than UsageEvent deliberately: these hold the
 * only record of spend from before per-call tracking existed. Periods are
 * legacy calendar months ("YYYY-MM") or per-user cycles keyed by their start
 * date ("YYYY-MM-DD"); both bucket by their first seven characters, so a
 * cycle counts toward the month it started in.
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
        _id: { $substrBytes: ["$period", 0, 7] },
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
 * Deletes every usage record for a user, resetting their credits and spend.
 *
 * Used when a demo account is deleted. Demo AI calls are served from fixtures
 * and charge credits but never cost anything; the records go with the demo
 * rather than being left orphaned.
 */
export async function deleteAllForUser(userId: string): Promise<number> {
  await connectDB();
  const result = await Usage.deleteMany({ userId });
  return result.deletedCount ?? 0;
}
