import "server-only";
import { createHash } from "node:crypto";
import * as rateLimitRepo from "@/lib/repositories/rate-limit";

/**
 * Per-user rate limiting for the expensive AI routes.
 *
 * This is defence in depth rather than the usage limit itself: credits are
 * charged atomically in src/lib/usage.ts. What this stops is a single user
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
  | "skills-gap"
  | "resume-parse"
  | "demo-create-ip"
  | "demo-create-global";

type Policy = { limit: number; windowSeconds: number };

/**
 * Generation is the slowest and most expensive route, so it gets the tightest
 * allowance. Quick import is cheaper and more likely to be used in quick
 * succession while someone works through a list of postings.
 */
const POLICIES: Record<RateLimitRoute, Policy> = {
  generate: { limit: 10, windowSeconds: 60 },
  "jobs-parse": { limit: 20, windowSeconds: 60 },
  "skills-gap": { limit: 10, windowSeconds: 60 },
  // Resume extraction makes no model call but parses untrusted files, which
  // costs CPU and memory. Generous for a person, tight for a script.
  "resume-parse": { limit: 10, windowSeconds: 60 },
  // Demo creation makes a Clerk user and seeds a full dataset, so it is
  // limited twice. Per visitor IP: enough for a genuine retry or two. Globally:
  // a ceiling no pool of IPs can exceed. The key passed to consume() for these
  // go through consumeByKey() with an IP or "global", not a user id.
  "demo-create-ip": { limit: 3, windowSeconds: 600 },
  "demo-create-global": { limit: 30, windowSeconds: 60 },
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

/**
 * Rate limits a request that has no user yet, such as demo creation, keyed on
 * an arbitrary string like a client IP.
 *
 * The counter collection keys on an ObjectId, so the key is hashed into one.
 * Hashing also means no raw IP is ever stored. The server secret salts the hash
 * so the small IPv4 space cannot be brute-forced back from a stored counter.
 */
export async function consumeByKey(
  key: string,
  route: RateLimitRoute
): Promise<RateLimitResult> {
  const salt = process.env.CLERK_SECRET_KEY ?? "";
  const bucket = createHash("sha256")
    .update(`${salt}:${route}:${key}`)
    .digest("hex")
    .slice(0, 24);
  return consume(bucket, route);
}

/** Builds the 429 body and headers for a refused request. */
export function rateLimitResponseInit(retryAfterSeconds: number) {
  return {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds) },
  };
}
