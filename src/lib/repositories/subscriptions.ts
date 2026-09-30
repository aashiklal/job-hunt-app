import connectDB from "@/lib/db/connect";
import { Types } from "mongoose";
import Subscription, { ISubscription } from "@/lib/models/Subscription";
import type { BillingStatus } from "@/lib/margin";

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
        status: "trialing",
      },
    },
    { upsert: true, returnDocument: "after" }
  );
}

export async function deleteForUser(userId: string): Promise<boolean> {
  await connectDB();
  const result = await Subscription.findOneAndDelete({ userId });
  return result !== null;
}

/**
 * Sets billing state. Called by the backfill today and by a Stripe webhook
 * later, which is why it speaks Stripe's vocabulary.
 */
export async function setBillingStatus(
  userId: string,
  status: BillingStatus
): Promise<ISubscription | null> {
  await connectDB();
  return Subscription.findOneAndUpdate(
    { userId },
    { $set: { status } },
    { returnDocument: "after" }
  );
}

/** Plan key and billing status for many users at once, keyed by user id. */
export async function bulkByUserId(
  userIds: string[]
): Promise<Record<string, { planKey: string; status: BillingStatus }>> {
  const result: Record<string, { planKey: string; status: BillingStatus }> = {};
  if (userIds.length === 0) return result;

  await connectDB();
  const docs = await Subscription.find({
    userId: { $in: userIds.map((id) => new Types.ObjectId(id)) },
  }).lean();

  for (const doc of docs) {
    result[doc.userId.toString()] = {
      planKey: doc.planKey,
      status: doc.status as BillingStatus,
    };
  }
  return result;
}

export async function listAll(): Promise<ISubscription[]> {
  await connectDB();
  return Subscription.find({});
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
