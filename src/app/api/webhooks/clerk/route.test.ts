import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Demo accounts are created and deleted by src/lib/demo-accounts.ts, which
 * owns their whole lifecycle. The webhook must stay out of it: handling a demo
 * user.created would put every demo visitor in the admin approval queue and
 * notify every admin, and handling a demo user.deleted mid-sweep would drop the
 * record before the demo's data was wiped.
 *
 * Signature verification is stubbed; these tests are about routing.
 */

const mocks = vi.hoisted(() => ({
  event: null as unknown,
  syncNewClerkUser: vi.fn(),
  syncUpdatedClerkUser: vi.fn(),
  syncDeletedClerkUser: vi.fn(),
  getByClerkId: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "svix-id": "id", "svix-timestamp": "1", "svix-signature": "sig" }),
}));

vi.mock("svix", () => ({
  Webhook: class {
    verify() {
      return mocks.event;
    }
  },
}));

vi.mock("@/lib/user-access-lifecycle", () => ({
  syncNewClerkUser: mocks.syncNewClerkUser,
  syncUpdatedClerkUser: mocks.syncUpdatedClerkUser,
  syncDeletedClerkUser: mocks.syncDeletedClerkUser,
}));

vi.mock("@/lib/repositories/users", () => ({
  getByClerkId: mocks.getByClerkId,
}));

const { POST } = await import("@/app/api/webhooks/clerk/route");

function userData(publicMetadata: Record<string, unknown> = {}) {
  return {
    id: "user_1",
    email_addresses: [{ id: "e1", email_address: "someone@example.com" }],
    primary_email_address_id: "e1",
    first_name: null,
    last_name: null,
    public_metadata: publicMetadata,
  };
}

function send(event: unknown) {
  mocks.event = event;
  return POST(new Request("http://localhost/api/webhooks/clerk", { method: "POST", body: "{}" }));
}

beforeEach(() => {
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = "whsec_test";
  mocks.syncNewClerkUser.mockReset();
  mocks.syncUpdatedClerkUser.mockReset();
  mocks.syncDeletedClerkUser.mockReset();
  mocks.getByClerkId.mockReset().mockResolvedValue(null);
});

describe("Clerk webhook and demo accounts", () => {
  it("ignores user.created for a demo account", async () => {
    const res = await send({ type: "user.created", data: userData({ demo: true }) });
    expect(res.status).toBe(200);
    expect(mocks.syncNewClerkUser).not.toHaveBeenCalled();
  });

  it("ignores user.updated for a demo account", async () => {
    const res = await send({ type: "user.updated", data: userData({ demo: true }) });
    expect(res.status).toBe(200);
    expect(mocks.syncUpdatedClerkUser).not.toHaveBeenCalled();
  });

  it("ignores user.deleted when the record is a demo account", async () => {
    mocks.getByClerkId.mockResolvedValue({ isDemo: true, email: "x" });
    const res = await send({ type: "user.deleted", data: { id: "user_1" } });
    expect(res.status).toBe(200);
    expect(mocks.syncDeletedClerkUser).not.toHaveBeenCalled();
  });

  it("still handles real users", async () => {
    await send({ type: "user.created", data: userData() });
    expect(mocks.syncNewClerkUser).toHaveBeenCalledOnce();

    mocks.getByClerkId.mockResolvedValue({ isDemo: false, email: "someone@example.com" });
    await send({ type: "user.deleted", data: { id: "user_1" } });
    expect(mocks.syncDeletedClerkUser).toHaveBeenCalledWith("user_1");
  });
});
