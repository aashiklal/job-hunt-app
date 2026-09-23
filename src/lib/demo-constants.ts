/**
 * Demo account constants shared between server components and the seed layer.
 *
 * Deliberately free of "server-only" and of repository imports so the landing
 * page can render the demo credentials without pulling the whole seed module
 * and its fixture text into the build.
 */

export const DEMO_EMAIL = "demo@jobhunt.app";

/**
 * The demo password is published on the landing page by design, but it lives
 * in the environment rather than the repository so it can be rotated without a
 * deploy. When unset, the landing page omits the demo panel entirely.
 */
export function getDemoPassword(): string | null {
  return process.env.DEMO_ACCOUNT_PASSWORD?.trim() || null;
}
