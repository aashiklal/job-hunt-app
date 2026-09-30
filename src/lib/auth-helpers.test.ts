import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Expiry is enforced on every request rather than trusted to the sweep, so a
 * late or failed sweep can never extend a demo. And a demo whose record has
 * already been swept must not be lazily recreated as a pending signup, which
 * would put a stranger in the admin queue.
 */

const mocks = vi.hoisted(() => ({
  userId: "user_clerk" as string | null,
  dbUser: null as unknown,
  clerkUser: null as unknown,
  ensureUserForClerkSession: vi.fn(),
}));

class RedirectSignal extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.userId }),
  clerkClient: async () => ({
    users: {
      getUser: async () => {
        if (mocks.clerkUser === "deleted") {
          throw Object.assign(new Error("Not Found"), { status: 404 });
        }
        return mocks.clerkUser;
      },
    },
  }),
}));

vi.mock("@/lib/repositories/users", () => ({
  getByClerkId: async () => mocks.dbUser,
}));

vi.mock("@/lib/repositories/subscriptions", () => ({
  ensureForUser: async () => ({ planKey: "personal" }),
}));

vi.mock("@/lib/user-access-lifecycle", () => ({
  ensureUserForClerkSession: mocks.ensureUserForClerkSession,
}));

vi.mock("@/lib/models/Plan", () => ({
  default: { findOne: async () => ({ key: "personal" }) },
}));

const { requireApprovedUserWithPlan } = await import("@/lib/auth-helpers");

async function redirectTarget(): Promise<string | null> {
  try {
    await requireApprovedUserWithPlan();
    return null;
  } catch (err) {
    if (err instanceof RedirectSignal) return err.to;
    throw err;
  }
}

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  mocks.userId = "user_clerk";
  mocks.dbUser = null;
  mocks.clerkUser = null;
  mocks.ensureUserForClerkSession.mockReset();
});

describe("requireApprovedUserWithPlan and demo accounts", () => {
  it("lets a live demo through", async () => {
    mocks.dbUser = {
      _id: "u1",
      status: "approved",
      isDemo: true,
      demoExpiresAt: new Date(Date.now() + HOUR),
    };
    expect(await redirectTarget()).toBeNull();
  });

  it("sends an expired demo to /demo-ended even before any sweep", async () => {
    mocks.dbUser = {
      _id: "u1",
      status: "approved",
      isDemo: true,
      demoExpiresAt: new Date(Date.now() - 1000),
    };
    expect(await redirectTarget()).toBe("/demo-ended");
  });

  it("sends a swept demo to /demo-ended without recreating it as a pending user", async () => {
    mocks.clerkUser = {
      emailAddresses: [{ id: "e1", emailAddress: "demo+0123456789abcdef@jobhunt.app" }],
      primaryEmailAddressId: "e1",
      firstName: "Demo",
      lastName: "Visitor",
      publicMetadata: { demo: true },
    };
    expect(await redirectTarget()).toBe("/demo-ended");
    expect(mocks.ensureUserForClerkSession).not.toHaveBeenCalled();
  });

  it("sends a session whose Clerk user was just deleted to sign-in instead of crashing", async () => {
    mocks.clerkUser = "deleted";
    expect(await redirectTarget()).toBe("/sign-in");
    expect(mocks.ensureUserForClerkSession).not.toHaveBeenCalled();
  });

  it("still lazily creates real users", async () => {
    mocks.clerkUser = {
      emailAddresses: [{ id: "e1", emailAddress: "real@example.com" }],
      primaryEmailAddressId: "e1",
      firstName: null,
      lastName: null,
      publicMetadata: {},
    };
    mocks.ensureUserForClerkSession.mockResolvedValue({ _id: "u2", status: "pending" });
    expect(await redirectTarget()).toBe("/pending");
    expect(mocks.ensureUserForClerkSession).toHaveBeenCalledOnce();
  });
});
