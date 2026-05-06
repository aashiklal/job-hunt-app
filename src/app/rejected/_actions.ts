"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import * as userAccess from "@/lib/user-access-lifecycle";

export async function requestAccessAgain(): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await userAccess.requestAccessAgain(userId);

  redirect("/pending");
}
