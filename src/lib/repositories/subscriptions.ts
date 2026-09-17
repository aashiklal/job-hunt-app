import connectDB from "@/lib/db/connect";
import Subscription, { ISubscription } from "@/lib/models/Subscription";

export async function getByUserId(
  userId: string
): Promise<ISubscription | null> {
  await connectDB();
  return Subscription.findOne({ userId });
}

/**
 * Creates the user's subscription if none exists. `planKey` only applies on
 * insert; an existing subscription keeps its current plan.
 */
export async function ensureForUser(
  userId: string,
  planKey: string = "personal"
): Promise<ISubscription | null> {
  await connectDB();
  return Subscription.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        planKey,
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

/**
 * Marks that the user has asked for full access. Idempotent: re-requesting
 * just refreshes the timestamp.
 */
export async function requestUpgrade(userId: string): Promise<ISubscription | null> {
  await connectDB();
  return Subscription.findOneAndUpdate(
    { userId },
    { $set: { upgradeRequestedAt: new Date() } },
    { returnDocument: "after" }
  );
}

/** Clears a pending upgrade request without changing the plan (used by decline). */
export async function clearUpgradeRequest(userId: string): Promise<ISubscription | null> {
  await connectDB();
  return Subscription.findOneAndUpdate(
    { userId },
    { $set: { upgradeRequestedAt: null } },
    { returnDocument: "after" }
  );
}

/**
 * Changes an existing subscription's plan key (unlike ensureForUser, which
 * only sets planKey on insert). Also clears any pending upgrade request.
 */
export async function setPlan(
  userId: string,
  planKey: string
): Promise<ISubscription | null> {
  await connectDB();
  return Subscription.findOneAndUpdate(
    { userId },
    { $set: { planKey, upgradeRequestedAt: null } },
    { returnDocument: "after" }
  );
}

/** User ids with a pending upgrade request. Used by the admin Users tab. */
export async function listPendingUpgradeUserIds(): Promise<string[]> {
  await connectDB();
  const docs = await Subscription.find(
    { upgradeRequestedAt: { $ne: null } },
    { userId: 1 }
  ).lean();
  return docs.map((d) => (d.userId as unknown as { toString(): string }).toString());
}

/** Count of pending upgrade requests, for an admin badge. */
export async function countPendingUpgradeRequests(): Promise<number> {
  await connectDB();
  return Subscription.countDocuments({ upgradeRequestedAt: { $ne: null } });
}
