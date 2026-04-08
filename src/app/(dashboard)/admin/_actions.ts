"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAdminAction } from "@/lib/actions";
import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";

const userIdSchema = z.string().min(1, "userId is required");

export const approveUser = defineAdminAction(
  async (_ctx, input: { userId: string }) => {
    const userId = userIdSchema.parse(input.userId);
    await users.setStatus(userId, "approved");
    await subscriptions.ensureForUser(userId);
    revalidatePath("/admin");
    return { userId };
  }
);

export const rejectUser = defineAdminAction(
  async (ctx, input: { userId: string }) => {
    const userId = userIdSchema.parse(input.userId);
    if (ctx.user._id.toString() === userId) {
      throw new Error("You cannot reject your own account.");
    }
    await users.setStatus(userId, "rejected");
    revalidatePath("/admin");
    return { userId };
  }
);
