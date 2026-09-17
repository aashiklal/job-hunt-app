import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repositories/users", () => ({
  getByEmail: vi.fn(),
  getByClerkId: vi.fn(),
  getById: vi.fn(),
  claimByEmail: vi.fn(),
  upsertFromClerk: vi.fn(),
  setStatus: vi.fn(),
}));
vi.mock("@/lib/repositories/subscriptions", () => ({
  ensureForUser: vi.fn(),
  requestUpgrade: vi.fn(),
  setPlan: vi.fn(),
  clearUpgradeRequest: vi.fn(),
}));
vi.mock("@/lib/repositories/audit-log", () => ({
  create: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({
  notifyAdminsNewSignup: vi.fn(),
  notifyAdminsUpgradeRequest: vi.fn(),
  notifyUserUpgraded: vi.fn(),
}));

import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";
import * as auditLog from "@/lib/repositories/audit-log";
import { notifyAdminsNewSignup, notifyAdminsUpgradeRequest, notifyUserUpgraded } from "@/lib/notify";
import {
  approveUser,
  isAutoApproveEnabled,
  syncNewClerkUser,
  requestFullAccess,
  grantFullAccess,
  declineFullAccessRequest,
  AUTO_APPROVED_PLAN_KEY,
  ADMIN_APPROVED_PLAN_KEY,
} from "@/lib/user-access-lifecycle";

const USER_ID = "64f000000000000000000001";
const profile = { clerkId: "user_123", email: "new@example.com", firstName: "New" };

function fakeUser(status: "pending" | "approved" | "rejected") {
  return { _id: USER_ID, email: profile.email, status, isAdmin: false } as never;
}

describe("isAutoApproveEnabled", () => {
  const original = process.env.AUTO_APPROVE_SIGNUPS;
  afterEach(() => {
    process.env.AUTO_APPROVE_SIGNUPS = original;
  });

  it("is only on for the literal string true", () => {
    delete process.env.AUTO_APPROVE_SIGNUPS;
    expect(isAutoApproveEnabled()).toBe(false);
    process.env.AUTO_APPROVE_SIGNUPS = "1";
    expect(isAutoApproveEnabled()).toBe(false);
    process.env.AUTO_APPROVE_SIGNUPS = "true";
    expect(isAutoApproveEnabled()).toBe(true);
  });
});

describe("syncNewClerkUser", () => {
  const original = process.env.AUTO_APPROVE_SIGNUPS;

  beforeEach(() => {
    vi.mocked(users.getByEmail).mockResolvedValue(null);
    vi.mocked(users.upsertFromClerk).mockResolvedValue(fakeUser("pending"));
    vi.mocked(users.setStatus).mockResolvedValue(fakeUser("approved"));
    vi.mocked(subscriptions.ensureForUser).mockResolvedValue({ planKey: "free" } as never);
  });

  afterEach(() => {
    process.env.AUTO_APPROVE_SIGNUPS = original;
  });

  it("leaves a new user pending and notifies admins when auto-approval is off", async () => {
    delete process.env.AUTO_APPROVE_SIGNUPS;

    const user = await syncNewClerkUser(profile);

    expect(user.status).toBe("pending");
    expect(users.setStatus).not.toHaveBeenCalled();
    expect(subscriptions.ensureForUser).not.toHaveBeenCalled();
    expect(notifyAdminsNewSignup).toHaveBeenCalledWith(
      expect.objectContaining({ email: profile.email })
    );
  });

  it("approves and subscribes to the free plan when auto-approval is on", async () => {
    process.env.AUTO_APPROVE_SIGNUPS = "true";

    const user = await syncNewClerkUser(profile);

    expect(user.status).toBe("approved");
    expect(users.setStatus).toHaveBeenCalledWith(USER_ID, "approved");
    expect(subscriptions.ensureForUser).toHaveBeenCalledWith(USER_ID, AUTO_APPROVED_PLAN_KEY);
    expect(notifyAdminsNewSignup).toHaveBeenCalledTimes(1);
  });

  it("does not re-activate a user that already exists", async () => {
    process.env.AUTO_APPROVE_SIGNUPS = "true";
    vi.mocked(users.upsertFromClerk).mockResolvedValue(fakeUser("approved"));

    await syncNewClerkUser(profile);

    expect(users.setStatus).not.toHaveBeenCalled();
  });

  it("claims a pre-provisioned placeholder by email instead of creating a new user", async () => {
    vi.mocked(users.getByEmail).mockResolvedValue(fakeUser("approved"));
    vi.mocked(users.claimByEmail).mockResolvedValue(fakeUser("approved"));

    const user = await syncNewClerkUser(profile);

    expect(user.status).toBe("approved");
    expect(users.upsertFromClerk).not.toHaveBeenCalled();
  });
});

describe("approveUser", () => {
  it("activates on the personal plan and writes an audit entry", async () => {
    const admin = { _id: "admin-1", email: "admin@example.com" } as never;
    vi.mocked(users.getById).mockResolvedValue(fakeUser("pending"));
    vi.mocked(users.setStatus).mockResolvedValue(fakeUser("approved"));
    vi.mocked(subscriptions.ensureForUser).mockResolvedValue({ planKey: "personal" } as never);

    const result = await approveUser(admin, USER_ID);

    expect(result?.status).toBe("approved");
    expect(subscriptions.ensureForUser).toHaveBeenCalledWith(USER_ID, ADMIN_APPROVED_PLAN_KEY);
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.approved", targetUserId: USER_ID })
    );
  });

  it("returns null when the target user does not exist", async () => {
    vi.mocked(users.getById).mockResolvedValue(null);
    const result = await approveUser({ _id: "admin-1", email: "a@b.c" } as never, USER_ID);
    expect(result).toBeNull();
    expect(users.setStatus).not.toHaveBeenCalled();
  });
});

describe("requestFullAccess", () => {
  it("stores the request and notifies admins", async () => {
    const user = fakeUser("approved");
    vi.mocked(subscriptions.requestUpgrade).mockResolvedValue({} as never);

    await requestFullAccess(user);

    expect(subscriptions.requestUpgrade).toHaveBeenCalledWith(USER_ID);
    expect(notifyAdminsUpgradeRequest).toHaveBeenCalledWith(user);
  });
});

describe("grantFullAccess", () => {
  it("moves the user to the paid plan, audits it, and emails the user", async () => {
    const admin = { _id: "admin-1", email: "admin@example.com" } as never;
    vi.mocked(users.getById)
      .mockResolvedValueOnce(fakeUser("approved")) // auditContext lookup
      .mockResolvedValueOnce(fakeUser("approved")); // post-grant lookup for the email
    vi.mocked(subscriptions.setPlan).mockResolvedValue({ planKey: "personal" } as never);

    const result = await grantFullAccess(admin, USER_ID);

    expect(result).toEqual({ planKey: "personal" });
    expect(subscriptions.setPlan).toHaveBeenCalledWith(USER_ID, "personal");
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.upgrade_granted", targetUserId: USER_ID })
    );
    expect(notifyUserUpgraded).toHaveBeenCalledTimes(1);
  });

  it("returns null when the target user does not exist", async () => {
    vi.mocked(users.getById).mockResolvedValue(null);
    const result = await grantFullAccess({ _id: "admin-1", email: "a@b.c" } as never, USER_ID);
    expect(result).toBeNull();
    expect(subscriptions.setPlan).not.toHaveBeenCalled();
  });
});

describe("declineFullAccessRequest", () => {
  it("clears the request and audits it without emailing the user", async () => {
    const admin = { _id: "admin-1", email: "admin@example.com" } as never;
    vi.mocked(users.getById).mockResolvedValue(fakeUser("approved"));
    vi.mocked(subscriptions.clearUpgradeRequest).mockResolvedValue({ planKey: "free" } as never);

    const result = await declineFullAccessRequest(admin, USER_ID);

    expect(result).toEqual({ planKey: "free" });
    expect(subscriptions.clearUpgradeRequest).toHaveBeenCalledWith(USER_ID);
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.upgrade_declined", targetUserId: USER_ID })
    );
    expect(notifyUserUpgraded).not.toHaveBeenCalled();
  });
});
