import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import connectDB from "@/lib/db/connect";
import User, { IUser } from "@/lib/models/User";

export async function getCurrentUser(): Promise<IUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  await connectDB();
  return User.findOne({ clerkId: userId });
}

export async function requireApprovedUser(): Promise<IUser> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await connectDB();
  let user = await User.findOne({ clerkId: userId });

  if (!user) {
    // Webhook hasn't fired yet (e.g. local dev) — try merging a bootstrap
    // placeholder that was pre-provisioned by email.
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (primaryEmail) {
      user = await User.findOneAndUpdate(
        { email: primaryEmail },
        {
          clerkId: userId,
          firstName: clerkUser.firstName ?? undefined,
          lastName: clerkUser.lastName ?? undefined,
        },
        { returnDocument: "after" }
      );
    }

    // Truly new user — create a pending record (webhook substitute for local dev)
    if (!user) {
      await User.create({
        clerkId: userId,
        email: primaryEmail ?? "",
        firstName: clerkUser.firstName ?? undefined,
        lastName: clerkUser.lastName ?? undefined,
        status: "pending",
        isAdmin: false,
      });
      redirect("/pending");
    }
  }

  if (user.status === "pending") redirect("/pending");
  if (user.status === "rejected") redirect("/rejected");
  return user;
}

export async function requireAdmin(): Promise<IUser> {
  const user = await requireApprovedUser();
  if (!user.isAdmin) notFound();
  return user;
}
