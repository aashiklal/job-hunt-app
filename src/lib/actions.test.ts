import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

/**
 * The action wrapper is the single funnel every mutation passes through, so
 * its error mapping is load-bearing: a regression here turns a quota refusal
 * into a generic failure, or worse, swallows a redirect and leaves the user
 * staring at a dead form.
 *
 * Auth is mocked because these tests are about the wrapper's behaviour, not
 * about Clerk.
 */

const requireApprovedUserWithPlan = vi.fn();
const requireAdminWithPlan = vi.fn();

vi.mock("@/lib/auth-helpers", () => ({
  requireApprovedUserWithPlan: () => requireApprovedUserWithPlan(),
  requireAdminWithPlan: () => requireAdminWithPlan(),
}));

const { defineAction, defineAdminAction } = await import("@/lib/actions");
const { CreditsExceededError } = await import("@/lib/usage");

const fakeContext = {
  user: { _id: "user_1", email: "a@example.com" },
  subscription: { planKey: "personal" },
  plan: { key: "personal", monthlyCredits: 500 },
};

beforeEach(() => {
  requireApprovedUserWithPlan.mockReset().mockResolvedValue(fakeContext);
  requireAdminWithPlan.mockReset().mockResolvedValue(fakeContext);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("defineAction success path", () => {
  it("wraps the handler result in { ok: true, data }", async () => {
    const action = defineAction(async (_ctx, input: { n: number }) => ({
      doubled: input.n * 2,
    }));

    await expect(action({ n: 21 })).resolves.toEqual({
      ok: true,
      data: { doubled: 42 },
    });
  });

  it("passes the authenticated context through to the handler", async () => {
    const action = defineAction(async (ctx) => ctx.user._id);

    const result = await action(undefined);
    expect(result).toEqual({ ok: true, data: "user_1" });
  });

  it("enforces auth before running the handler", async () => {
    const handler = vi.fn();
    requireApprovedUserWithPlan.mockRejectedValue(new Error("not approved"));

    const action = defineAction(handler);
    const result = await action(undefined);

    expect(handler).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});

describe("defineAction error mapping", () => {
  it("maps CreditsExceededError to a CREDITS_EXHAUSTED result a user can read", async () => {
    const periodEndsAt = new Date("2026-10-01T00:00:00.000Z");
    const action = defineAction(async () => {
      throw new CreditsExceededError({ used: 500, limit: 500, periodEndsAt });
    });

    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CREDITS_EXHAUSTED");
      expect(result.error.message).toBe(
        "You have used all 500 credits for this billing month. They reset on October 1."
      );
      if (result.error.code === "CREDITS_EXHAUSTED") {
        expect(result.error.limit).toBe(500);
        expect(result.error.periodEndsAt).toBe(periodEndsAt.toISOString());
      }
    }
  });

  it("maps a ZodError to VALIDATION with per-field messages", async () => {
    const schema = z.object({
      company: z.string().min(1, "Company is required"),
      role: z.string().min(1, "Role is required"),
    });

    const action = defineAction(async (_ctx, input: unknown) => schema.parse(input));
    const result = await action({ company: "", role: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error).toHaveProperty("fieldErrors");
      const fieldErrors = (result.error as { fieldErrors: Record<string, string> })
        .fieldErrors;
      expect(fieldErrors.company).toBe("Company is required");
      expect(fieldErrors.role).toBe("Role is required");
    }
  });

  it("maps an unexpected error to INTERNAL without leaking its message", async () => {
    const action = defineAction(async () => {
      throw new Error("connection string postgres://user:hunter2@db");
    });

    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL");
      expect(result.error.message).not.toContain("hunter2");
      expect(result.error.message).toBe(
        "Something went wrong. Please try again."
      );
    }
  });

  it("re-throws a redirect instead of swallowing it", async () => {
    // Next signals navigation by throwing. If the wrapper caught these, every
    // redirect() inside an action would silently become a failed result.
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/jobs;307;",
    });

    const action = defineAction(async () => {
      throw redirectError;
    });

    await expect(action(undefined)).rejects.toBe(redirectError);
  });

  it("re-throws a notFound instead of swallowing it", async () => {
    const notFoundError = Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_NOT_FOUND",
    });

    const action = defineAction(async () => {
      throw notFoundError;
    });

    await expect(action(undefined)).rejects.toBe(notFoundError);
  });

  it("treats an error whose digest merely resembles a redirect as internal", async () => {
    const lookalike = Object.assign(new Error("boom"), {
      digest: "NOT_NEXT_REDIRECT",
    });

    const action = defineAction(async () => {
      throw lookalike;
    });

    const result = await action(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL");
  });
});

describe("defineAdminAction", () => {
  it("runs the handler when the admin check passes", async () => {
    const action = defineAdminAction(async () => "done");
    await expect(action(undefined)).resolves.toEqual({ ok: true, data: "done" });
  });

  it("uses the admin guard rather than the approved-user guard", async () => {
    const action = defineAdminAction(async () => "done");
    await action(undefined);

    expect(requireAdminWithPlan).toHaveBeenCalledOnce();
    expect(requireApprovedUserWithPlan).not.toHaveBeenCalled();
  });

  it("does not run the handler when the admin check fails", async () => {
    const handler = vi.fn();
    requireAdminWithPlan.mockRejectedValue(new Error("not an admin"));

    const action = defineAdminAction(handler);
    const result = await action(undefined);

    expect(handler).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it("re-throws notFound from the admin guard so non-admins get a 404", async () => {
    const notFoundError = Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_NOT_FOUND",
    });
    requireAdminWithPlan.mockRejectedValue(notFoundError);

    const action = defineAdminAction(async () => "done");
    await expect(action(undefined)).rejects.toBe(notFoundError);
  });
});
