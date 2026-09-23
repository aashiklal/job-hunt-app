"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

/**
 * One-click entry to the public demo account.
 *
 * Fetches a short-lived sign-in ticket from the server and exchanges it for a
 * session. Password sign-in cannot work here: Clerk requires email
 * verification from an unrecognised device, and every visitor to a shared demo
 * is an unrecognised device with no way to read the mailbox.
 *
 * Uses the Clerk v7 signals API: signIn.ticket() verifies, signIn.finalize()
 * turns the completed attempt into an active session.
 */
export function DemoSignInButton() {
  const { signIn } = useSignIn();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(signIn);

  async function openDemo() {
    if (!signIn || pending) return;

    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/demo/session", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? "Could not start the demo.");
        setPending(false);
        return;
      }

      const { ticket } = (await res.json()) as { ticket: string };

      const verified = await signIn.ticket({ ticket });
      if (verified.error) {
        console.error("[demo] ticket verification failed:", verified.error);
        setError("Could not start the demo. Please try again.");
        setPending(false);
        return;
      }

      const finalized = await signIn.finalize();
      if (finalized.error) {
        console.error("[demo] finalize failed:", finalized.error);
        setError("Could not start the demo. Please try again.");
        setPending(false);
        return;
      }

      router.push("/jobs");
    } catch (err) {
      console.error("[demo] sign-in failed:", err);
      setError("Could not start the demo. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={openDemo}
        disabled={!ready || pending}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {pending ? "Starting the demo" : "Try the live demo"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
