import "server-only";

import { DEMO_EMAIL } from "@/lib/demo-constants";
import * as users from "@/lib/repositories/users";

/**
 * Demo mode. The shared public demo account (see src/lib/demo-seed.ts) keeps
 * full CRUD so a visitor can drag the kanban, create jobs and edit records,
 * but its AI requests never reach Anthropic. Every expensive route checks
 * isDemoUser() and serves a fixture instead.
 *
 * The guard lives here rather than in defineAction because the AI routes are
 * route handlers that call auth() directly and never pass through the action
 * wrapper.
 */

export type DemoCapableUser = { isDemo?: boolean; email?: string };

/**
 * True when this user must never reach Anthropic.
 *
 * Checks the email as well as the flag, deliberately. The flag alone fails
 * open: if `isDemo` is missing for any reason the demo account starts making
 * real API calls on every visitor's click, and the failure is silent. That is
 * not hypothetical. Mongoose caches a compiled model
 * (`mongoose.models.User ?? mongoose.model(...)`), so a dev server started
 * before the field was added returns `undefined` for it and the guard quietly
 * stops working.
 *
 * The email is the durable fact: it identifies the shared demo account
 * regardless of schema state. Either signal is enough to refuse.
 */
export function isDemoUser(user: DemoCapableUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isDemo === true) return true;
  return user.email?.toLowerCase() === DEMO_EMAIL.toLowerCase();
}

/**
 * Thrown when the demo account reaches a metered AI call. Signals a missing
 * fixture, not a user error: the caller should have branched before spending.
 */
export class DemoCallBlockedError extends Error {
  constructor() {
    super(
      "The demo account cannot make live AI calls. This generation type needs a fixture in src/lib/demo-fixtures.ts."
    );
    this.name = "DemoCallBlockedError";
  }
}

/**
 * Refuses a metered call for the demo account.
 *
 * Takes a user id because that is what the metering layer has. The extra
 * lookup costs one indexed query against a call that takes seconds, which is
 * a fair price for the guarantee.
 */
export async function assertNotDemoUser(userId: string): Promise<void> {
  const user = await users.getById(userId);
  if (isDemoUser(user)) {
    throw new DemoCallBlockedError();
  }
}

/**
 * The AI panels show a progress bar while a request is in flight. A fixture
 * that returns instantly makes the bar flash and look broken, so demo
 * responses are held briefly to approximate a real call.
 */
const DEMO_LATENCY_MS = 1400;

export async function withDemoLatency<T>(value: T, ms = DEMO_LATENCY_MS): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return value;
}
