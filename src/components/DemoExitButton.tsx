"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { endDemo } from "@/app/demo-actions";

/**
 * Ends a demo, after a warning, then navigates.
 *
 * A plain link cannot do this: Clerk bounces /sign-in and /sign-up straight
 * back into the app while the demo session is live. Ending it deletes the demo
 * account and everything in it, so the visitor confirms first.
 *
 * If deletion fails the visitor stays in their demo, untouched: the server
 * deletes the Clerk user before any data, so nothing is left half-gone.
 */

const COPY = {
  exit: {
    title: "End your demo?",
    description:
      "Your demo workspace and everything you changed in it will be deleted. You can start a fresh demo at any time.",
    confirm: "End demo",
  },
  "sign-up": {
    title: "Signing up ends your demo",
    description:
      "Your demo workspace and everything you changed in it will be deleted. Your new account starts empty.",
    confirm: "End demo and sign up",
  },
  "sign-in": {
    title: "Signing in ends your demo",
    description:
      "Your demo workspace and everything you changed in it will be deleted.",
    confirm: "End demo and sign in",
  },
} as const;

export type DemoExitIntent = keyof typeof COPY;

export function DemoExitButton({
  redirectUrl,
  intent,
  className,
  children,
  ...rest
}: {
  redirectUrl: string;
  intent: DemoExitIntent;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const copy = COPY[intent];

  async function handleConfirm(event: React.MouseEvent) {
    // Keep the dialog open while the demo is deleted.
    event.preventDefault();
    if (isPending) return;
    setIsPending(true);

    const result = await endDemo(undefined).catch(() => null);
    if (!result?.ok || !result.data.ended) {
      toast.error("Could not end the demo. Please try again.");
      setIsPending(false);
      return;
    }

    // The server deleted the Clerk user, which revokes the session. Leave with
    // a full page load rather than Clerk's signOut() or the Next router: both
    // re-render the current dashboard page for a user that no longer exists,
    // and that render never settles. A fresh document request goes through
    // the Clerk proxy, which clears the dead session properly.
    window.location.replace(redirectUrl);
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className={`${className ?? ""} focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none`}
          {...rest}
        >
          {children}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep exploring</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Ending demo..." : copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
