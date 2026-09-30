import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import connectDB from "@/lib/db/connect";
import User, { IUser } from "@/lib/models/User";
import Plan, { IPlan } from "@/lib/models/Plan";
import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";
import * as userAccess from "@/lib/user-access-lifecycle";
import { ISubscription } from "@/lib/models/Subscription";
import { isDemoExpired } from "@/lib/demo";
import { isDemoEmail } from "@/lib/demo-constants";

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
      // Webhook may not have fired yet in local dev, so try merging a bootstrap
      // placeholder that was pre-provisioned by email.
      const clerk = await clerkClient();
      const clerkUser = await clerk.users
        .getUser(userId)
        .catch((err: unknown) => {
          // The session token outlives its user by up to a minute, so a
          // just-deleted account (an ended or swept demo) still arrives here.
          // There is nothing to recreate: send them to sign in.
          if ((err as { status?: unknown })?.status === 404) return null;
          throw err;
        });
      if (!clerkUser) redirect("/sign-in");
      const primaryEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress;

      // A demo account whose record is gone has been swept. Never recreate it
      // as a pending signup: that would put a stranger in the admin queue and
      // notify every admin.
      if (clerkUser.publicMetadata?.demo === true || isDemoEmail(primaryEmail)) {
        redirect("/demo-ended");
      }

      if (primaryEmail) {
        user = await userAccess.ensureUserForClerkSession({
          clerkId: userId,
          email: primaryEmail,
          firstName: clerkUser.firstName ?? undefined,
          lastName: clerkUser.lastName ?? undefined,
        });
      }

      // Truly new user. Create a pending record as a local-dev webhook substitute.
      if (!user) {
        user = await userAccess.ensureUserForClerkSession({
          clerkId: userId,
          email: "",
          firstName: clerkUser.firstName ?? undefined,
          lastName: clerkUser.lastName ?? undefined,
        });
        redirect("/pending");
      }
    }

    // Checked on every request, so a late or failed sweep can never extend a
    // demo past its expiry.
    if (isDemoExpired(user)) redirect("/demo-ended");

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
