import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { startTestMongo, stopTestMongo, clearTestMongo, syncIndexes } from "@/test/mongo";
import RateLimit from "@/lib/models/RateLimit";

/**
 * The route's guards run in a fixed order, cheapest first, and each must stop
 * the request before an account is created. Rate limiting runs against a real
 * database; Turnstile and the account lifecycle are stubbed (they have their
 * own tests) so each guard can be triggered in isolation.
 */

const mocks = vi.hoisted(() => ({
  turnstileOk: true,
  createDemoAccount: vi.fn(),
  sweepExpiredDemoAccounts: vi.fn(),
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: vi.fn(async () =>
    mocks.turnstileOk ? { ok: true } : { ok: false, reason: "invalid-input-response" }
  ),
}));

vi.mock("@/lib/demo-accounts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demo-accounts")>();
  return {
    ...actual,
    createDefaultDemoClerk: () => ({}),
    createDemoAccount: mocks.createDemoAccount,
    sweepExpiredDemoAccounts: mocks.sweepExpiredDemoAccounts,
  };
});

const { POST } = await import("@/app/api/demo/session/route");
const { DemoCapacityError } = await import("@/lib/demo-accounts");

function request(body: unknown, ip = "203.0.113.7") {
  return new NextRequest("http://localhost/api/demo/session", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await startTestMongo();
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
  await syncIndexes(RateLimit);
  mocks.turnstileOk = true;
  mocks.createDemoAccount.mockReset();
  mocks.createDemoAccount.mockResolvedValue({ ticket: "ticket_123" });
  mocks.sweepExpiredDemoAccounts.mockReset();
  mocks.sweepExpiredDemoAccounts.mockResolvedValue({ deleted: 0, failed: 0 });
  delete process.env.DEMO_DISABLED;
});

describe("POST /api/demo/session", () => {
  it("returns a ticket on the happy path", async () => {
    const res = await POST(request({ turnstileToken: "tok" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ticket: "ticket_123" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("is switched off by the kill switch before anything else runs", async () => {
    process.env.DEMO_DISABLED = "true";
    const res = await POST(request({ turnstileToken: "tok" }));
    expect(res.status).toBe(503);
    expect(mocks.createDemoAccount).not.toHaveBeenCalled();
  });

  it("rejects a request without a Turnstile token", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
    expect(mocks.createDemoAccount).not.toHaveBeenCalled();
  });

  it("rejects a failed Turnstile check", async () => {
    mocks.turnstileOk = false;
    const res = await POST(request({ turnstileToken: "forged" }));
    expect(res.status).toBe(403);
    expect(mocks.createDemoAccount).not.toHaveBeenCalled();
  });

  it("allows three demos per IP per window and refuses the fourth", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await POST(request({ turnstileToken: "tok" }))).status).toBe(200);
    }
    const refused = await POST(request({ turnstileToken: "tok" }));
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBeTruthy();
    expect(mocks.createDemoAccount).toHaveBeenCalledTimes(3);

    // A different visitor is unaffected.
    expect((await POST(request({ turnstileToken: "tok" }, "198.51.100.9"))).status).toBe(200);
  });

  it("maps a full live-demo cap to 503", async () => {
    mocks.createDemoAccount.mockRejectedValueOnce(new DemoCapacityError());
    const res = await POST(request({ turnstileToken: "tok" }));
    expect(res.status).toBe(503);
  });

  it("still creates the demo when the opportunistic sweep fails", async () => {
    mocks.sweepExpiredDemoAccounts.mockRejectedValueOnce(new Error("sweep down"));
    const res = await POST(request({ turnstileToken: "tok" }));
    expect(res.status).toBe(200);
  });

  it("returns a generic 500 without leaking the error", async () => {
    mocks.createDemoAccount.mockRejectedValueOnce(new Error("mongo exploded: secret detail"));
    const res = await POST(request({ turnstileToken: "tok" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret detail");
  });
});
