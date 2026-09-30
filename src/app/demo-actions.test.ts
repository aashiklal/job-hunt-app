import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * endDemo deletes an account, so its guards matter more than its happy path:
 * it may only ever act on the signed-in user, and never on a real account.
 * Full deletion itself is covered against a real database in
 * src/lib/demo-accounts.test.ts; here the lifecycle is stubbed.
 */

const mocks = vi.hoisted(() => ({
  ctxUser: null as unknown,
  destroyDemoAccount: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireApprovedUserWithPlan: async () => ({
    user: mocks.ctxUser,
    subscription: {},
    plan: {},
  }),
  requireAdminWithPlan: async () => {
    throw new Error("not used");
  },
}));

vi.mock("@/lib/demo-accounts", () => ({
  createDefaultDemoClerk: () => ({ fake: true }),
  destroyDemoAccount: mocks.destroyDemoAccount,
}));

const { endDemo } = await import("@/app/demo-actions");

function user(fields: Record<string, unknown>) {
  return { _id: { toString: () => "mongo_1" }, clerkId: "user_clerk_1", ...fields };
}

beforeEach(() => {
  mocks.destroyDemoAccount.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("endDemo", () => {
  it("deletes the caller's own demo account", async () => {
    mocks.ctxUser = user({ isDemo: true, email: "demo+0123456789abcdef@jobhunt.app" });

    const result = await endDemo(undefined);

    expect(result).toEqual({ ok: true, data: { ended: true } });
    expect(mocks.destroyDemoAccount).toHaveBeenCalledWith(
      { clerkId: "user_clerk_1", userId: "mongo_1" },
      { fake: true }
    );
  });

  it("never deletes a real account", async () => {
    mocks.ctxUser = user({ isDemo: false, email: "real@example.com" });

    const result = await endDemo(undefined);

    expect(result).toEqual({ ok: true, data: { ended: false } });
    expect(mocks.destroyDemoAccount).not.toHaveBeenCalled();
  });

  it("reports failure without claiming the demo ended", async () => {
    mocks.ctxUser = user({ isDemo: true });
    mocks.destroyDemoAccount.mockRejectedValueOnce(new Error("clerk outage"));

    const result = await endDemo(undefined);

    expect(result.ok).toBe(false);
  });
});
