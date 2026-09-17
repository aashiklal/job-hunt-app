import "server-only";
import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";
import * as auditLog from "@/lib/repositories/audit-log";
import { notifyAdminsNewSignup, notifyAdminsUpgradeRequest, notifyUserUpgraded } from "@/lib/notify";
import type { IUser } from "@/lib/repositories/users";

type ClerkUserProfile = {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

/** Plan given to users approved by an admin. */
export const ADMIN_APPROVED_PLAN_KEY = "personal";
/** Capped plan given to self-serve sign-ups when auto-approval is on. */
export const AUTO_APPROVED_PLAN_KEY = "free";

function idOf(user: { _id: unknown }) {
  return (user._id as { toString(): string }).toString();
}

/**
 * Self-serve mode. When on, new sign-ups skip the admin approval queue and
 * land instantly on the capped "free" plan. Read at call time so the flag
 * can be flipped without a rebuild.
 */
export function isAutoApproveEnabled(): boolean {
  return process.env.AUTO_APPROVE_SIGNUPS === "true";
}

/**
 * Grants dashboard access: marks the user approved and ensures a
 * subscription on the given plan.
 */
export async function activateUser(
  userId: string,
  planKey: string
): Promise<IUser | null> {
  const updated = await users.setStatus(userId, "approved");
  if (!updated) return null;

  const subscription = await subscriptions.ensureForUser(userId, planKey);
  if (!subscription) {
    throw new Error("Failed to create subscription for approved user.");
  }

  return updated;
}

async function claimOrCreatePendingUser(
  profile: ClerkUserProfile,
  options: { notifyAdmins: boolean }
): Promise<IUser> {
  const existing = profile.email ? await users.getByEmail(profile.email) : null;
  if (existing) {
    const claimed = await users.claimByEmail(profile.email, profile.clerkId, {
      firstName: profile.firstName,
      lastName: profile.lastName,
    });
    if (claimed) return claimed;
  }

  let user = await users.upsertFromClerk(profile);
  if (!user) {
    throw new Error(`Failed to create pending user for Clerk ID ${profile.clerkId}.`);
  }

  if (user.status === "pending" && isAutoApproveEnabled()) {
    user = (await activateUser(idOf(user), AUTO_APPROVED_PLAN_KEY)) ?? user;
  }

  if (options.notifyAdmins) {
    await notifyAdminsNewSignup({
      email: profile.email,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
    });
  }

  return user;
}

export async function syncNewClerkUser(profile: ClerkUserProfile): Promise<IUser> {
  return claimOrCreatePendingUser(profile, { notifyAdmins: true });
}

export async function ensureUserForClerkSession(
  profile: ClerkUserProfile
): Promise<IUser> {
  const existing = await users.getByClerkId(profile.clerkId);
  if (existing) return existing;
  return claimOrCreatePendingUser(profile, { notifyAdmins: true });
}

export async function syncUpdatedClerkUser(
  clerkId: string,
  profile: { email?: string; firstName?: string; lastName?: string }
): Promise<IUser | null> {
  return users.updateProfileFromClerk(clerkId, profile);
}

export async function syncDeletedClerkUser(clerkId: string): Promise<boolean> {
  return users.deleteByClerkId(clerkId);
}

async function auditContext(admin: IUser, targetUserId: string) {
  const target = await users.getById(targetUserId);
  if (!target) return null;
  return {
    adminId: idOf(admin),
    adminEmail: admin.email,
    targetUserId,
    targetUserEmail: target.email,
  };
}

export async function approveUser(admin: IUser, targetUserId: string) {
  const ctx = await auditContext(admin, targetUserId);
  if (!ctx) return null;

  const updated = await activateUser(targetUserId, ADMIN_APPROVED_PLAN_KEY);
  if (!updated) return null;

  await auditLog.create({
    ...ctx,
    action: "user.approved",
  });
  return updated;
}

export async function rejectUser(admin: IUser, targetUserId: string) {
  if (idOf(admin) === targetUserId) {
    throw new Error("You cannot reject your own account.");
  }

  const ctx = await auditContext(admin, targetUserId);
  if (!ctx) return null;

  const updated = await users.setStatus(targetUserId, "rejected");
  if (!updated) return null;

  await auditLog.create({
    ...ctx,
    action: "user.rejected",
  });
  return updated;
}

export async function requestAccessAgain(clerkId: string) {
  const user = await users.getByClerkId(clerkId);
  if (user && user.status === "rejected") {
    await users.setStatus(idOf(user), "pending");
  }
}

/** A free-plan user asks for full access. Always available, at any spend level. */
export async function requestFullAccess(user: IUser): Promise<void> {
  await subscriptions.requestUpgrade(idOf(user));
  await notifyAdminsUpgradeRequest(user);
}

/** Admin grants a pending request: moves the user to the paid plan and clears the request. */
export async function grantFullAccess(admin: IUser, targetUserId: string) {
  const ctx = await auditContext(admin, targetUserId);
  if (!ctx) return null;

  const updated = await subscriptions.setPlan(targetUserId, ADMIN_APPROVED_PLAN_KEY);
  if (!updated) {
    throw new Error("User has no subscription. Approve them first.");
  }

  await auditLog.create({
    ...ctx,
    action: "user.upgrade_granted",
  });

  const target = await users.getById(targetUserId);
  if (target) {
    await notifyUserUpgraded(target);
  }

  return updated;
}

/** Admin declines a pending request: clears it silently, no email to the user. */
export async function declineFullAccessRequest(admin: IUser, targetUserId: string) {
  const ctx = await auditContext(admin, targetUserId);
  if (!ctx) return null;

  const updated = await subscriptions.clearUpgradeRequest(targetUserId);
  if (!updated) {
    throw new Error("User has no subscription.");
  }

  await auditLog.create({
    ...ctx,
    action: "user.upgrade_declined",
  });

  return updated;
}

export async function toggleAdmin(admin: IUser, targetUserId: string) {
  if (idOf(admin) === targetUserId) {
    throw new Error("You cannot change your own admin status.");
  }

  const target = await users.getById(targetUserId);
  if (!target) return null;

  const isAdmin = !target.isAdmin;
  const updated = await users.setAdmin(targetUserId, isAdmin);
  if (!updated) return null;

  await auditLog.create({
    adminId: idOf(admin),
    adminEmail: admin.email,
    targetUserId,
    targetUserEmail: target.email,
    action: isAdmin ? "user.admin_granted" : "user.admin_revoked",
  });

  return updated;
}
