"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions";
import * as users from "@/lib/repositories/users";
import * as userAccess from "@/lib/user-access-lifecycle";

export const requestFullAccess = defineAction(async (ctx) => {
  await userAccess.requestFullAccess(ctx.user);
  revalidatePath("/", "layout");
  return { requested: true };
});

export const dismissOnboarding = defineAction(async (ctx) => {
  await users.dismissOnboarding(ctx.user._id.toString());
  revalidatePath("/", "layout");
  return { dismissed: true };
});
