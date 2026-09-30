import "server-only";
import { NextResponse } from "next/server";
import { CreditsExceededError } from "@/lib/usage";

/**
 * How an AI route answers when the user has run out of credits.
 *
 * Credits are the limit users are meant to hit, so this is the normal way a
 * request is refused, and it must read as an explanation rather than a
 * failure. Every AI panel shows the response's `error` field as its toast, so
 * that field carries the sentence; `code` is for anything that needs to branch.
 *
 * Deliberately separate from the USD QUOTA_EXCEEDED response: that one is a
 * backstop users should not normally reach, and its body is shaped in dollars.
 */

/** Plain-language refusal, in credits. Periods are UTC months, so is the date. */
export function creditsExhaustedMessage(err: CreditsExceededError): string {
  const resets = err.periodEndsAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return `You have used all ${err.limit} credits for this month. They reset on ${resets}.`;
}

/** A 429 for a CreditsExceededError, or null so the route's own handling runs. */
export function creditsExhaustedResponse(err: unknown): NextResponse | null {
  if (!(err instanceof CreditsExceededError)) return null;
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
