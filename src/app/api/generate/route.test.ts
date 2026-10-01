import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Regression: running out of credits used to fall through to the generic
 * handler, so the user saw "Generation failed." with a 500. The generation
 * itself is stubbed; this is about how the route answers.
 */

const mocks = vi.hoisted(() => ({
  generateForJob: vi.fn(),
  status: "approved" as string,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_clerk_1" }),
}));

vi.mock("@/lib/repositories/users", () => ({
  getByClerkId: async () => ({
    _id: { toString: () => "mongo_1" },
    isDemo: false,
    status: mocks.status,
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  consume: async () => ({ allowed: true, remaining: 9 }),
  rateLimitResponseInit: () => ({ status: 429 }),
}));

vi.mock("@/lib/job-ai-generation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/job-ai-generation")>();
  return { ...actual, generateForJob: mocks.generateForJob };
});

const { POST } = await import("@/app/api/generate/route");
const { CreditsExceededError } = await import("@/lib/usage");

function request() {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId: "job_1", type: "cover_letter" }),
  });
}

beforeEach(() => {
  mocks.status = "approved";
  mocks.generateForJob.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/generate when credits run out", () => {
  it("answers 429 with a message the panel shows as-is", async () => {
    mocks.generateForJob.mockRejectedValue(
      new CreditsExceededError({
        used: 499,
        limit: 500,
        periodEndsAt: new Date("2026-10-01T00:00:00.000Z"),
      })
    );

    const res = await POST(request());

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("CREDITS_EXHAUSTED");
    expect(body.error).toBe(
      "You have used all 500 credits for this billing month. They reset on October 1."
    );
  });

  it("still reports unexpected failures as a 500", async () => {
    mocks.generateForJob.mockRejectedValue(new Error("anthropic down"));
    const res = await POST(request());
    expect(res.status).toBe(500);
  });
});

describe("POST /api/generate access", () => {
  it("refuses a pending user before any generation runs", async () => {
    mocks.status = "pending";
    const res = await POST(request());

    expect(res.status).toBe(403);
    expect(mocks.generateForJob).not.toHaveBeenCalled();
  });

  it("refuses a rejected user before any generation runs", async () => {
    mocks.status = "rejected";
    const res = await POST(request());

    expect(res.status).toBe(403);
    expect(mocks.generateForJob).not.toHaveBeenCalled();
  });
});
