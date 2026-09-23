import "server-only";
import * as rateLimitRepo from "@/lib/repositories/rate-limit";

/**
 * Per-user rate limiting for the expensive AI routes.
 *
 * This is defence in depth rather than the budget control itself: spend is
 * enforced atomically in src/lib/usage.ts. What this stops is a single user
 * hammering an endpoint, which costs latency and database load even when every
 * request is correctly refused.
 *
 * Fixed windows, not a sliding log. A burst straddling a window boundary can
 * briefly reach twice the limit, which is an acceptable trade for a single
 * indexed write per request.
 */

export type RateLimitRoute =
  | "generate"
  | "jobs-parse"
  | "offers-compare"
  | "skills-gap"
  | "star-stories-polish"
  | "demo-session";

type Policy = { limit: number; windowSeconds: number };

/**
 * Generation is the slowest and most expensive route, so it gets the tightest
 * budget. The parse and polish routes are cheaper and more likely to be used
 * in quick succession while someone works through a list.
 */
const POLICIES: Record<RateLimitRoute, Policy> = {
  generate: { limit: 10, windowSeconds: 60 },
  "jobs-parse": { limit: 20, windowSeconds: 60 },
  "offers-compare": { limit: 10, windowSeconds: 60 },
  "skills-gap": { limit: 10, windowSeconds: 60 },
  "star-stories-polish": { limit: 20, windowSeconds: 60 },
  // Shared across every visitor, since they all resolve to the same demo user.
  // Generous enough for real traffic, tight enough that the endpoint cannot be
  // used to mint sessions in bulk.
  "demo-session": { limit: 30, windowSeconds: 60 },
};

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export async function consume(
  userId: string,
  route: RateLimitRoute
): Promise<RateLimitResult> {
  const policy = POLICIES[route];
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart =
    Math.floor(nowSeconds / policy.windowSeconds) * policy.windowSeconds;
  const windowEnd = windowStart + policy.windowSeconds;

  const count = await rateLimitRepo.increment({
    userId,
    route,
    windowStart,
    // Keep the counter a little past its window so a clock skew between app
    // instances cannot reap it while it is still authoritative.
    expiresAt: new Date((windowEnd + policy.windowSeconds) * 1000),
  });

  if (count > policy.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, windowEnd - nowSeconds),
    };
  }

  return { allowed: true, remaining: policy.limit - count };
}

/** Builds the 429 body and headers for a refused request. */
export function rateLimitResponseInit(retryAfterSeconds: number) {
  return {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds) },
  };
}
