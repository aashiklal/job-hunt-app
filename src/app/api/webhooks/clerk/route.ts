import { headers } from "next/headers";
import { Webhook } from "svix";
import * as users from "@/lib/repositories/users";

type ClerkUserEventData = {
  id: string;
  email_addresses: { email_address: string; id: string }[];
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
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

  if (type === "user.created") {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    );
    const email = primaryEmail?.email_address ?? "";

    // If a bootstrap placeholder exists for this email, merge into it
    // (preserves isAdmin / status set by the bootstrap script).
    const existing = email ? await users.getByEmail(email) : null;
    if (existing) {
      await users.claimByEmail(email, data.id, {
        firstName: data.first_name ?? undefined,
        lastName: data.last_name ?? undefined,
      });
    } else {
      await users.upsertFromClerk({
        clerkId: data.id,
        email,
        firstName: data.first_name ?? undefined,
        lastName: data.last_name ?? undefined,
      });
    }
  }

  if (type === "user.updated") {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    );
    await users.updateProfileFromClerk(data.id, {
      email: primaryEmail?.email_address,
      firstName: data.first_name ?? undefined,
      lastName: data.last_name ?? undefined,
    });
  }

  if (type === "user.deleted") {
    await users.deleteByClerkId(data.id);
  }

  return new Response("OK", { status: 200 });
}
