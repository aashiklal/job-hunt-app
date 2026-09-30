import "server-only";

/**
 * Server-side verification of a Cloudflare Turnstile token.
 *
 * Guards demo creation, which is the one unauthenticated route that creates
 * accounts. Fails closed: without a configured secret every token is refused
 * outside development, so a missing env var can never silently open the door.
 *
 * Tokens are single use and expire after 300 seconds; Cloudflare enforces both.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Cloudflare's documented always-pass test secret. Used only in development
 * when no secret is configured, paired with the always-pass test site key.
 */
const DEV_TEST_SECRET = "1x0000000000000000000000000000000AA";

function secretKey(): string | null {
  const configured = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "development" ? DEV_TEST_SECRET : null;
}

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | null
): Promise<TurnstileResult> {
  const secret = secretKey();
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set; refusing.");
    return { ok: false, reason: "not-configured" };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, reason: `siteverify-http-${res.status}` };
    }
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success === true) return { ok: true };
    return { ok: false, reason: (data["error-codes"] ?? ["rejected"]).join(",") };
  } catch (err) {
    console.error("[turnstile] siteverify request failed:", err);
    return { ok: false, reason: "siteverify-unreachable" };
  }
}

/** The public site key the widget needs, or null when the demo cannot run. */
export function turnstileSiteKey(): string | null {
  const configured = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (configured) return configured;
  // Cloudflare's always-pass test site key, development only.
  return process.env.NODE_ENV === "development" ? "1x00000000000000000000AA" : null;
}
