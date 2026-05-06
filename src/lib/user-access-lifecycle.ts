import "server-only";
import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";
import * as auditLog from "@/lib/repositories/audit-log";
import { notifyAdminsNewSignup } from "@/lib/notify";
import type { IUser } from "@/lib/repositories/users";

type ClerkUserProfile = {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

function idOf(user: { _id: unknown }) {
  return (user._id as { toString(): string }).toString();
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

  const user = await users.upsertFromClerk(profile);
  if (!user) {
    throw new Error(`Failed to create pending user for Clerk ID ${profile.clerkId}.`);
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

  const updated = await users.setStatus(targetUserId, "approved");
  if (!updated) return null;

  const subscription = await subscriptions.ensureForUser(targetUserId);
  if (!subscription) {
    throw new Error("Failed to create subscription for approved user.");
  }

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
