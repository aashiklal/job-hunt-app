import { headers } from "next/headers";
import { Webhook } from "svix";
import * as userAccess from "@/lib/user-access-lifecycle";
import * as users from "@/lib/repositories/users";
import { isDemoUser } from "@/lib/demo";

type ClerkUserEventData = {
  id: string;
  email_addresses: { email_address: string; id: string }[];
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
  public_metadata?: Record<string, unknown>;
};

type ClerkWebhookEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: ClerkUserEventData;
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return new Response("Missing CLERK_WEBHOOK_SIGNING_SECRET", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const { type, data } = event;

  // Per-visitor demo accounts are created, mirrored into Mongo, and deleted by
  // src/lib/demo-accounts.ts. Handling them here would create a pending user
  // and notify every admin for each demo click, and a user.deleted arriving
  // mid-sweep would drop the record before the demo's data was wiped, leaving
  // it orphaned. Acknowledge and ignore.
  if (data.public_metadata?.demo === true) {
    return new Response("OK", { status: 200 });
  }
  if (type === "user.deleted" && isDemoUser(await users.getByClerkId(data.id))) {
    return new Response("OK", { status: 200 });
  }

  if (type === "user.created") {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    );
    const email = primaryEmail?.email_address ?? "";

    await userAccess.syncNewClerkUser({
      clerkId: data.id,
      email,
      firstName: data.first_name ?? undefined,
      lastName: data.last_name ?? undefined,
    });
  }

  if (type === "user.updated") {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    );
    await userAccess.syncUpdatedClerkUser(data.id, {
      email: primaryEmail?.email_address,
      firstName: data.first_name ?? undefined,
      lastName: data.last_name ?? undefined,
    });
  }

  if (type === "user.deleted") {
    await userAccess.syncDeletedClerkUser(data.id);
  }

  return new Response("OK", { status: 200 });
}
