"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAdminAction } from "@/lib/actions";
import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";
import * as auditLog from "@/lib/repositories/audit-log";
import * as plans from "@/lib/repositories/plans";
import * as userAccess from "@/lib/user-access-lifecycle";

const userIdSchema = z.string().min(1, "userId is required");

// Helper: build the audit context tuple from the action ctx + the target
async function getAuditContext(
  ctx: { user: { _id: unknown; email: string } },
  targetUserId: string
): Promise<{
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetUserEmail: string;
} | null> {
  const adminId = (ctx.user._id as { toString(): string }).toString();
  const adminEmail = ctx.user.email;
  const target = await users.getById(targetUserId);
  if (!target) return null;
  return {
    adminId,
    adminEmail,
    targetUserId,
    targetUserEmail: target.email,
  };
}

export const approveUser = defineAdminAction(
  async (ctx, input: { userId: string }) => {
    const userId = userIdSchema.parse(input.userId);
    const approved = await userAccess.approveUser(ctx.user, userId);
    if (!approved) throw new Error("Target user not found");
    revalidatePath("/admin");
    revalidatePath(`/admin/${userId}`);
    return { userId };
  }
);

export const rejectUser = defineAdminAction(
  async (ctx, input: { userId: string }) => {
    const userId = userIdSchema.parse(input.userId);
    const rejected = await userAccess.rejectUser(ctx.user, userId);
    if (!rejected) throw new Error("Target user not found");
    revalidatePath("/admin");
    revalidatePath(`/admin/${userId}`);
    return { userId };
  }
);

const setCustomLimitSchema = z.object({
  userId: z.string().min(1),
  // -1 = unlimited. The ceiling guards against a typo handing out millions.
  monthlyCredits: z.number().int().min(-1).max(100_000),
});

export const setUserCustomLimit = defineAdminAction(
  async (ctx, input: z.infer<typeof setCustomLimitSchema>) => {
    const { userId, monthlyCredits } = setCustomLimitSchema.parse(input);
    const auditCtx = await getAuditContext(ctx, userId);
    if (!auditCtx) {
      throw new Error("Target user not found");
    }
    const subscription = await subscriptions.setCustomLimit(userId, monthlyCredits);
    if (!subscription) {
      throw new Error("User has no subscription. Approve them first.");
    }
    await auditLog.create({
      ...auditCtx,
      action: "user.custom_limit_set",
      details: { monthlyCredits },
    });
    revalidatePath("/admin");
    revalidatePath(`/admin/${userId}`);
    return { userId, monthlyCredits };
  }
);

export const clearUserCustomLimit = defineAdminAction(
  async (ctx, input: { userId: string }) => {
    const userId = userIdSchema.parse(input.userId);
    const auditCtx = await getAuditContext(ctx, userId);
    if (!auditCtx) {
      throw new Error("Target user not found");
    }
    const subscription = await subscriptions.clearCustomLimit(userId);
    if (!subscription) {
      throw new Error("User has no subscription.");
    }
    await auditLog.create({
      ...auditCtx,
      action: "user.custom_limit_cleared",
    });
    revalidatePath("/admin");
    revalidatePath(`/admin/${userId}`);
    return { userId };
  }
);

const updatePlanSchema = z.object({
  planId: z.string().min(1),
  monthlyCredits: z.number().int().min(-1),
  monthlyPriceUSD: z.number().min(0),
  maxResumes: z.number().int().min(-1),
});

export const updatePlan = defineAdminAction(
  async (ctx, input: z.infer<typeof updatePlanSchema>) => {
    const { planId, monthlyCredits, monthlyPriceUSD, maxResumes } =
      updatePlanSchema.parse(input);
    const updated = await plans.update(planId, {
      monthlyCredits,
      monthlyPriceUSD,
      maxResumes,
    });
    if (!updated) throw new Error("Plan not found");
    const adminId = (ctx.user._id as { toString(): string }).toString();
    await auditLog.create({
      adminId,
      adminEmail: ctx.user.email,
      targetUserId: adminId,
      targetUserEmail: ctx.user.email,
      action: "plan.updated",
      details: { planKey: updated.key, monthlyCredits, monthlyPriceUSD, maxResumes },
    });
    revalidatePath("/admin");
    return { planKey: updated.key };
  }
);

export const toggleUserAdmin = defineAdminAction(
  async (ctx, input: { userId: string }) => {
    const userId = userIdSchema.parse(input.userId);
    const updated = await userAccess.toggleAdmin(ctx.user, userId);
    if (!updated) {
      throw new Error("Target user not found");
    }
    revalidatePath("/admin");
    revalidatePath(`/admin/${userId}`);
    return { userId, isAdmin: updated.isAdmin };
  }
);
