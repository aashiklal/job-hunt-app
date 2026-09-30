import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DemoCapacityError,
  createDefaultDemoClerk,
  createDemoAccount,
  sweepExpiredDemoAccounts,
} from "@/lib/demo-accounts";
import { isDemoDisabled } from "@/lib/demo-constants";
import { consumeByKey, rateLimitResponseInit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";

/**
 * Creates a private demo account for one visitor and returns a short-lived
 * Clerk sign-in ticket for it.
 *
 * This is the only unauthenticated route that creates accounts, so it is
 * guarded in layers, cheapest first: kill switch, Turnstile, a per-IP limit, a
 * global limit, and a cap on live demo accounts. See src/lib/demo-accounts.ts
 * for the account lifecycle and its cleanup guarantees.
 */

const bodySchema = z.object({
  turnstileToken: z.string().min(1).max(2048),
});

/** Creation seeds a full dataset against a remote database. */
export const maxDuration = 30;

/** Opportunistic cleanup per creation. Bounded so it never slows a visitor. */
const LAZY_SWEEP_LIMIT = 5;

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  if (isDemoDisabled()) {
    return jsonError("The demo is switched off right now.", 503);
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return jsonError("Missing verification. Reload the page and try again.", 400);
  }

  const ip = clientIp(req);

  const verified = await verifyTurnstileToken(body.turnstileToken, ip);
  if (!verified.ok) {
    console.warn("[demo/session] turnstile rejected:", verified.reason);
    return jsonError("Verification failed. Reload the page and try again.", 403);
  }

  // Every request that reaches here has passed Turnstile. An unknown IP gets
  // one shared bucket, which is stricter, not looser.
  const perIp = await consumeByKey(ip ?? "unknown", "demo-create-ip");
  if (!perIp.allowed) {
    return NextResponse.json(
      { error: "You have started several demos recently. Try again in a few minutes." },
      rateLimitResponseInit(perIp.retryAfterSeconds)
    );
  }

  const global = await consumeByKey("global", "demo-create-global");
  if (!global.allowed) {
    return NextResponse.json(
      { error: "The demo is busy right now. Try again in a moment." },
      rateLimitResponseInit(global.retryAfterSeconds)
    );
  }

  let clerk;
  try {
    clerk = createDefaultDemoClerk();
  } catch (err) {
    console.error("[demo/session] Clerk is not configured:", err);
    return jsonError("The demo is not available.", 500);
  }

  try {
    await sweepExpiredDemoAccounts(clerk, { limit: LAZY_SWEEP_LIMIT });
  } catch (err) {
    // Cleanup is best effort here; the cron and the next creation retry it.
    console.error("[demo/session] lazy sweep failed:", err);
  }

  try {
    const { ticket } = await createDemoAccount(clerk);
    return NextResponse.json(
      { ticket },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof DemoCapacityError) {
      return jsonError("The demo is busy right now. Try again in a few minutes.", 503);
    }
    console.error("[demo/session] could not create a demo account:", err);
    return jsonError("Could not start the demo. Please try again.", 500);
  }
}
