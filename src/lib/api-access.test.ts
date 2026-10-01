import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Route handlers cannot use requireApprovedUserWithPlan(), so before this
 * check existed they only confirmed a user record existed. A rejected or
 * pending user could keep calling the AI routes on the owner's key.
 */

const mocks = vi.hoisted(() => ({
  userId: "user_clerk" as string | null,
  dbUser: null as unknown,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.userId }),
}));

vi.mock("@/lib/repositories/users", () => ({
  getByClerkId: async () => mocks.dbUser,
  // demo.ts imports the repository too; unused here.
}));

import { requireApprovedApiUser, apiAccessDenial } from "@/lib/api-access";

function user(overrides: Record<string, unknown> = {}) {
  return {
    _id: "u1",
    email: "person@example.com",
    status: "approved",
    isDemo: false,
    demoExpiresAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.userId = "user_clerk";
  mocks.dbUser = user();
});

async function statusOf(): Promise<number | "ok"> {
  const result = await requireApprovedApiUser();
  return result.ok ? "ok" : result.response.status;
}

describe("requireApprovedApiUser", () => {
  it("lets an approved user through", async () => {
    expect(await statusOf()).toBe("ok");
  });

  it("returns 401 with no session", async () => {
    mocks.userId = null;
    expect(await statusOf()).toBe(401);
  });

  it("returns 404 when there is no app user", async () => {
    mocks.dbUser = null;
    expect(await statusOf()).toBe(404);
  });

  it("returns 403 for a pending user", async () => {
    mocks.dbUser = user({ status: "pending" });
    expect(await statusOf()).toBe(403);
  });

  it("returns 403 for a rejected user", async () => {
    mocks.dbUser = user({ status: "rejected" });
    expect(await statusOf()).toBe(403);
  });

  it("returns 401 for an expired demo", async () => {
    mocks.dbUser = user({
      isDemo: true,
      email: "demo+abc@jobhunt.app",
      demoExpiresAt: new Date(Date.now() - 60_000),
    });
    expect(await statusOf()).toBe(401);
  });
});

describe("apiAccessDenial", () => {
  it("returns null for an approved user", () => {
    expect(apiAccessDenial(user() as never)).toBeNull();
  });
});
