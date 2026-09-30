"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

/**
 * One-click entry to a private demo account.
 *
 * The server creates a fresh account for this visitor and returns a short-lived
 * sign-in ticket, which is exchanged here for a session. Password sign-in
 * cannot work: every visitor is an unrecognised device with no mailbox to
 * verify from.
 *
 * Creating an account is the most abusable thing an anonymous visitor can do,
 * so the request carries a Cloudflare Turnstile token. The widget runs in
 * "interaction-only" mode: invisible for most people, a single checkbox when
 * Cloudflare wants more signal.
 *
 * Uses the Clerk v7 signals API: signIn.ticket() verifies, signIn.finalize()
 * turns the completed attempt into an active session.
 */

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      appearance: "interaction-only";
      theme: "auto";
      size: "flexible";
      action: string;
    }
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_ERROR =
  "Could not verify your browser. Reload the page and try again.";

const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function DemoSignInButton({
  alreadySignedIn = false,
  turnstileSiteKey,
}: {
  /** The visitor still holds a live demo session, so skip creating another. */
  alreadySignedIn?: boolean;
  turnstileSiteKey: string;
}) {
  const { signIn } = useSignIn();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const ready = alreadySignedIn || (Boolean(signIn) && token !== null);

  // Tokens are single use, so any attempt that reached the server needs a
  // fresh one before the visitor can retry.
  const resetChallenge = useCallback(() => {
    setToken(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (alreadySignedIn || !scriptReady) return;
    const container = containerRef.current;
    const turnstile = window.turnstile;
    if (!container || !turnstile || widgetIdRef.current) return;

    widgetIdRef.current = turnstile.render(container, {
      sitekey: turnstileSiteKey,
      callback: (value) => {
        setToken(value);
        // A fresh token only resolves a verification error. Any other error,
        // such as a rate-limit message, must stay visible: the widget issues a
        // new token right after every failed attempt.
        setError((current) => (current === TURNSTILE_ERROR ? null : current));
      },
      "expired-callback": () => setToken(null),
      "error-callback": () => {
        setToken(null);
        setError(TURNSTILE_ERROR);
      },
      appearance: "interaction-only",
      theme: "auto",
      size: "flexible",
      action: "demo",
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [alreadySignedIn, scriptReady, turnstileSiteKey]);

  async function openDemo() {
    if (pending) return;

    if (alreadySignedIn) {
      setPending(true);
      router.push("/jobs");
      return;
    }

    if (!signIn || !token) return;

    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/demo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken: token }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? "Could not start the demo.");
        resetChallenge();
        setPending(false);
        return;
      }

      const { ticket } = (await res.json()) as { ticket: string };

      const verified = await signIn.ticket({ ticket });
      if (verified.error) {
        console.error("[demo] ticket verification failed:", verified.error);
        setError("Could not start the demo. Please try again.");
        resetChallenge();
        setPending(false);
        return;
      }

      const finalized = await signIn.finalize();
      if (finalized.error) {
        console.error("[demo] finalize failed:", finalized.error);
        setError("Could not start the demo. Please try again.");
        resetChallenge();
        setPending(false);
        return;
      }

      // A full page load, not router.push: the in-app navigation can be sent
      // before the new session cookie is stored, and a browser that still
      // holds an ended demo's session then gets bounced to /sign-in.
      window.location.assign("/jobs");
    } catch (err) {
      console.error("[demo] sign-in failed:", err);
      setError("Could not start the demo. Please try again.");
      resetChallenge();
      setPending(false);
    }
  }

  const label = alreadySignedIn
    ? "Back to your demo"
    : pending
      ? "Setting up your demo"
      : token === null && !error
        ? "Checking your browser"
        : "Try the live demo";

  return (
    <div className="flex w-full flex-col items-center">
      {!alreadySignedIn && (
        <>
          <Script
            src={TURNSTILE_SRC}
            strategy="lazyOnload"
            onReady={() => setScriptReady(true)}
          />
          <div ref={containerRef} className="mb-3 w-full empty:mb-0" />
        </>
      )}

      <button
        type="button"
        onClick={openDemo}
        disabled={!ready || pending}
        aria-busy={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-60"
      >
        {(pending || (!ready && !error)) && (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        )}
        {label}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
