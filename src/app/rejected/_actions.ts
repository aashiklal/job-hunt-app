"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import * as users from "@/lib/repositories/users";

export async function requestAccessAgain(): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await users.getByClerkId(userId);
  if (user && user.status === "rejected") {
    await users.setStatus(user._id.toString(), "pending");
  }

  redirect("/pending");
}
