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
  aiSpendLimitUSD: z.number().min(0).max(500),
});

export const setUserCustomLimit = defineAdminAction(
  async (ctx, input: z.infer<typeof setCustomLimitSchema>) => {
    const { userId, aiSpendLimitUSD } = setCustomLimitSchema.parse(input);
    const auditCtx = await getAuditContext(ctx, userId);
    if (!auditCtx) {
      throw new Error("Target user not found");
    }
    const subscription = await subscriptions.setCustomLimit(userId, aiSpendLimitUSD);
    if (!subscription) {
      throw new Error("User has no subscription. Approve them first.");
    }
    await auditLog.create({
      ...auditCtx,
      action: "user.custom_limit_set",
      details: { aiSpendLimitUSD },
    });
    revalidatePath("/admin");
    revalidatePath(`/admin/${userId}`);
    return { userId, aiSpendLimitUSD };
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
  aiSpendLimitUSD: z.number().refine(
    (v) => v === -1 || v >= 0,
    { message: "Spend limit must be -1 (unlimited) or a non-negative number" }
  ),
  maxResumes: z.number().int().min(-1),
  maxJobs: z.number().int().min(-1),
});

export const updatePlan = defineAdminAction(
  async (ctx, input: z.infer<typeof updatePlanSchema>) => {
    const { planId, aiSpendLimitUSD, maxResumes, maxJobs } = updatePlanSchema.parse(input);
    const updated = await plans.update(planId, { aiSpendLimitUSD, maxResumes, maxJobs });
    if (!updated) throw new Error("Plan not found");
    const adminId = (ctx.user._id as { toString(): string }).toString();
    await auditLog.create({
      adminId,
      adminEmail: ctx.user.email,
      targetUserId: adminId,
      targetUserEmail: ctx.user.email,
      action: "plan.updated",
      details: { planKey: updated.key, aiSpendLimitUSD, maxResumes, maxJobs },
    });
    revalidatePath("/admin");
    return { planKey: updated.key };
  }
);

export const grantFullAccess = defineAdminAction(
  async (ctx, input: { userId: string }) => {
    const userId = userIdSchema.parse(input.userId);
    const updated = await userAccess.grantFullAccess(ctx.user, userId);
    if (!updated) throw new Error("Target user not found");
    revalidatePath("/admin");
    revalidatePath(`/admin/${userId}`);
    return { userId };
  }
);

export const declineFullAccessRequest = defineAdminAction(
  async (ctx, input: { userId: string }) => {
    const userId = userIdSchema.parse(input.userId);
    const updated = await userAccess.declineFullAccessRequest(ctx.user, userId);
    if (!updated) throw new Error("Target user not found");
    revalidatePath("/admin");
    revalidatePath(`/admin/${userId}`);
    return { userId };
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
