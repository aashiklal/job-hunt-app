"use client";

import { useEffect } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";

/**
 * Ends a demo session that has outlived its account. Reloads this page once
 * signed out, so the visitor stays on the explanation rather than being
 * bounced to the landing page without one.
 */
export function EndDemoSession() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    signOut({ redirectUrl: "/demo-ended" }).catch((err: unknown) => {
      console.error("[demo] sign-out failed:", err);
    });
  }, [isLoaded, isSignedIn, signOut]);

  return null;
}
