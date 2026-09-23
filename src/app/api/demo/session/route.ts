import "server-only";
import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import * as users from "@/lib/repositories/users";
import { consume, rateLimitResponseInit } from "@/lib/rate-limit";

/**
 * Mints a short-lived Clerk sign-in ticket for the public demo account.
 *
 * Password sign-in cannot work for a shared demo: Clerk demands email
 * verification from an unrecognised device, every visitor is an unrecognised
 * device, and nobody can read the demo mailbox. A ticket is the authentication
 * itself, so it sidesteps both the password and the device check.
 *
 * This endpoint hands out a session for an account that is public by design.
 * It is still guarded: it only ever resolves the one user flagged isDemo, it
 * refuses outright unless that user exists and is approved, the ticket expires
 * in a minute and is single-use, and it is rate limited so it cannot be used
 * to mint sessions in bulk.
 */

const TICKET_TTL_SECONDS = 60;

export async function POST() {
  const demoUser = await users.getDemoUser();

  if (!demoUser || demoUser.status !== "approved") {
    return NextResponse.json(
      { error: "Demo account is not available." },
      { status: 503 }
    );
  }

  // Defensive: an admin demo account would bypass the budget check entirely
  // and make real Anthropic calls on every visitor's click.
  if (demoUser.isAdmin) {
    console.error("[demo/session] demo user is an admin; refusing to sign in.");
    return NextResponse.json(
      { error: "Demo account is misconfigured." },
      { status: 503 }
    );
  }

  const limit = await consume(demoUser._id.toString(), "demo-session");
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "The demo is busy right now. Try again in a moment." },
      rateLimitResponseInit(limit.retryAfterSeconds)
    );
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("[demo/session] CLERK_SECRET_KEY is not set.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const clerk = createClerkClient({ secretKey });
    const token = await clerk.signInTokens.createSignInToken({
      userId: demoUser.clerkId,
      expiresInSeconds: TICKET_TTL_SECONDS,
    });

    return NextResponse.json(
      { ticket: token.token },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[demo/session] failed to mint sign-in token:", err);
    return NextResponse.json(
      { error: "Could not start the demo." },
      { status: 500 }
    );
  }
}
