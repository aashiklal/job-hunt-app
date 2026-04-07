"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import connectDB from "@/lib/db/connect";
import User from "@/lib/models/User";

export async function requestAccessAgain(): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await connectDB();
  await User.findOneAndUpdate(
    { clerkId: userId, status: "rejected" },
    { status: "pending" }
  );

  redirect("/pending");
}
