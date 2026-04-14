import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import connectDB from "@/lib/db/connect";
import User, { IUser } from "@/lib/models/User";
import Plan, { IPlan } from "@/lib/models/Plan";
import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";
import { notifyAdminsNewSignup } from "@/lib/notify";
import { ISubscription } from "@/lib/models/Subscription";

export async function getCurrentUser(): Promise<IUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  await connectDB();
  return User.findOne({ clerkId: userId });
}

export type ApprovedUserContext = {
  user: IUser;
  subscription: ISubscription;
  plan: IPlan;
};

export const requireApprovedUserWithPlan = cache(
  async (): Promise<ApprovedUserContext> => {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    let user = await users.getByClerkId(userId);

    if (!user) {
      // Webhook hasn't fired yet (e.g. local dev) — try merging a bootstrap
      // placeholder that was pre-provisioned by email.
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      const primaryEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress;

      if (primaryEmail) {
        user = await users.claimByEmail(primaryEmail, userId, {
          firstName: clerkUser.firstName ?? undefined,
          lastName: clerkUser.lastName ?? undefined,
        });
      }

      // Truly new user — create a pending record (webhook substitute for local dev)
      if (!user) {
        await users.createFromClerk({
          clerkId: userId,
          email: primaryEmail ?? "",
          firstName: clerkUser.firstName ?? undefined,
          lastName: clerkUser.lastName ?? undefined,
        });
        // Notify admins — fire-and-forget, errors are swallowed inside
        await notifyAdminsNewSignup({
          email: primaryEmail ?? "",
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
        });
        redirect("/pending");
      }
    }

    if (user.status === "pending") redirect("/pending");
    if (user.status === "rejected") redirect("/rejected");

    const subscription = await subscriptions.ensureForUser(user._id.toString());
    if (!subscription) {
      throw new Error(
        `Failed to ensure subscription for user ${user._id.toString()}.`
      );
    }

    const plan = await Plan.findOne({ key: subscription.planKey });
    if (!plan) {
      throw new Error(
        `Plan not found: ${subscription.planKey}. Run npm run seed:plans.`
      );
    }

    return { user, subscription, plan };
  }
);

export const requireAdminWithPlan = cache(
  async (): Promise<ApprovedUserContext> => {
    const ctx = await requireApprovedUserWithPlan();
    if (!ctx.user.isAdmin) notFound();
    return ctx;
  }
);
