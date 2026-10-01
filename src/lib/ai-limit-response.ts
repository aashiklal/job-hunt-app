import "server-only";
import { NextResponse } from "next/server";
import { CreditsExceededError } from "@/lib/usage";

/**
 * How AI routes answer when the credit allowance refuses a request.
 *
 * Credits are the only limit a user can hit (docs/adr/0007), so this is the
 * one refusal they can meet, and it must read as an explanation rather than a
 * failure. Users are only ever spoken to in credits; real spend is for admins.
 *
 * Every AI panel shows the response's `error` field as its toast, so that
 * field carries the sentence and `code` carries the machine-readable reason.
 */

/** Billing months turn over at 00:00 UTC, so format reset dates in UTC. */
function formatResetDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Plain-language refusal, in credits. */
export function creditsExhaustedMessage(err: CreditsExceededError): string {
  return `You have used all ${err.limit} credits for this billing month. They reset on ${formatResetDate(err.periodEndsAt)}.`;
}

/**
 * A 429 when the user is out of credits, or null so the route's own error
 * handling runs. Call it first in the route's catch block.
 */
export function aiLimitResponse(err: unknown): NextResponse | null {
  if (err instanceof CreditsExceededError) {
    return NextResponse.json(
      {
        error: creditsExhaustedMessage(err),
        code: "CREDITS_EXHAUSTED",
        used: err.used,
        limit: err.limit,
        periodEndsAt: err.periodEndsAt.toISOString(),
      },
      { status: 429 }
    );
  }
  return null;
}
