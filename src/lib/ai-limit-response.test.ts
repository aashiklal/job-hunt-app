import { describe, it, expect } from "vitest";
import { CreditsExceededError } from "@/lib/usage";
import { aiLimitResponse, creditsExhaustedMessage } from "@/lib/ai-limit-response";

/**
 * Running out of credits is the only way a user hits a limit, so it must
 * reach them as a plain explanation, never as "Generation failed". Every AI
 * panel shows the response's `error` field as its toast, so that field carries
 * the sentence and `code` carries the machine-readable reason.
 */

const periodEndsAt = new Date("2026-10-01T00:00:00.000Z");

describe("creditsExhaustedMessage", () => {
  it("says what happened and when it resets, in the user's unit", () => {
    const err = new CreditsExceededError({ used: 500, limit: 500, periodEndsAt });
    expect(creditsExhaustedMessage(err)).toBe(
      "You have used all 500 credits for this billing month. They reset on October 1."
    );
  });

  it("reads the reset date in UTC, the timezone periods are defined in", () => {
    const err = new CreditsExceededError({
      used: 10,
      limit: 12,
      periodEndsAt: new Date("2026-11-01T00:00:00.000Z"),
    });
    expect(creditsExhaustedMessage(err)).toContain("November 1");
  });

  it("mentions no dollar amounts", () => {
    const err = new CreditsExceededError({ used: 500, limit: 500, periodEndsAt });
    expect(creditsExhaustedMessage(err)).not.toContain("$");
  });
});

describe("aiLimitResponse", () => {
  it("turns a CreditsExceededError into a 429 the panels can show", async () => {
    const err = new CreditsExceededError({ used: 498, limit: 500, periodEndsAt });

    const res = aiLimitResponse(err);

    expect(res?.status).toBe(429);
    expect(await res?.json()).toEqual({
      error: "You have used all 500 credits for this billing month. They reset on October 1.",
      code: "CREDITS_EXHAUSTED",
      used: 498,
      limit: 500,
      periodEndsAt: periodEndsAt.toISOString(),
    });
  });

  it("ignores every other error so the route's own handling still runs", () => {
    expect(aiLimitResponse(new Error("boom"))).toBeNull();
    expect(aiLimitResponse(null)).toBeNull();
  });
});
