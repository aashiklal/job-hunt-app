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
