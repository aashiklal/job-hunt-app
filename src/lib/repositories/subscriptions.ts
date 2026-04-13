import connectDB from "@/lib/db/connect";
import Subscription, { ISubscription } from "@/lib/models/Subscription";

export async function getByUserId(
  userId: string
): Promise<ISubscription | null> {
  await connectDB();
  return Subscription.findOne({ userId });
}

export async function ensureForUser(
  userId: string
): Promise<ISubscription | null> {
  await connectDB();
  return Subscription.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        planKey: "personal",
        status: "active",
      },
    },
    { upsert: true, returnDocument: "after" }
  );
}

export async function setCustomLimit(
  userId: string,
  aiSpendLimitUSD: number
): Promise<ISubscription | null> {
  if (typeof aiSpendLimitUSD !== "number" || aiSpendLimitUSD < 0) {
    throw new Error("aiSpendLimitUSD must be a non-negative number");
  }
  await connectDB();
  return Subscription.findOneAndUpdate(
    { userId },
    { $set: { "customLimits.aiSpendLimitUSD": aiSpendLimitUSD } },
    { returnDocument: "after" }
  );
}

export async function clearCustomLimit(
  userId: string
): Promise<ISubscription | null> {
  await connectDB();
  return Subscription.findOneAndUpdate(
    { userId },
    { $unset: { customLimits: "" } },
    { returnDocument: "after" }
  );
}
