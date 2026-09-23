import connectDB from "@/lib/db/connect";
import Usage, { IUsage } from "@/lib/models/Usage";
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
