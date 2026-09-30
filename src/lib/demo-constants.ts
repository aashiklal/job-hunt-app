/**
 * Demo account constants shared between server components, the seed layer and
 * the account lifecycle in src/lib/demo-accounts.ts.
 *
 * Deliberately free of "server-only" and of repository imports so it can be
 * imported anywhere without pulling the seed module and its fixture text into
 * the build.
 */

/**
 * The retired shared demo account. Kept only so the sweep can recognise and
 * remove it, and so isDemoUser() keeps refusing AI calls for it until then.
 */
export const DEMO_EMAIL = "demo@jobhunt.app";

const DEMO_EMAIL_DOMAIN = "jobhunt.app";
const DEMO_EMAIL_PATTERN = /^demo\+[a-z0-9]{8,64}@jobhunt\.app$/;

/**
 * Address for a per-visitor demo account. Never receives mail: Clerk accounts
 * created through the backend API skip verification, and the address exists
 * only because the Clerk instance requires an email identifier.
 */
export function buildDemoEmail(id: string): string {
  return `demo+${id}@${DEMO_EMAIL_DOMAIN}`;
}

/** True for the shared legacy address and for every per-visitor address. */
export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalised = email.toLowerCase();
  return normalised === DEMO_EMAIL || DEMO_EMAIL_PATTERN.test(normalised);
}

/**
 * Kill switch: DEMO_DISABLED=true stops new demo accounts being created and
 * hides the demo panel. Existing demos run out normally.
 */
export function isDemoDisabled(): boolean {
  return process.env.DEMO_DISABLED?.trim().toLowerCase() === "true";
}
