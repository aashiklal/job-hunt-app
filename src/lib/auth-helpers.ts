import { auth } from "@clerk/nextjs/server";
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

  // Signed into Clerk but no DB record yet (webhook pending) → treat as pending
  await connectDB();
  const user = await User.findOne({ clerkId: userId });
  if (!user || user.status === "pending") redirect("/pending");
  if (user.status === "rejected") redirect("/rejected");
  return user;
}

export async function requireAdmin(): Promise<IUser> {
  const user = await requireApprovedUser();
  if (!user.isAdmin) notFound();
  return user;
}
