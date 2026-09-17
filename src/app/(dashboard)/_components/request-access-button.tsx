"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestFullAccess } from "../_actions";

/**
 * Always visible for free-plan (lifetime-budget) users, not gated on spend,
 * so someone can ask for full access whenever they like. Visually emphasized
 * once they are close to or past the cap.
 */
export function RequestAccessButton({
  emphasized,
  alreadyRequested,
}: {
  emphasized: boolean;
  alreadyRequested: boolean;
}) {
  const [requested, setRequested] = useState(alreadyRequested);
  const [isPending, startTransition] = useTransition();

  if (requested) {
    return (
      <p className="mt-2 text-muted-foreground">Request sent. We will email you.</p>
    );
  }

  function handleClick() {
    startTransition(async () => {
      const result = await requestFullAccess(undefined);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setRequested(true);
      toast.success("Request sent to the team.");
    });
  }

  return (
    <Button
      size="sm"
      variant={emphasized ? "default" : "outline"}
      className="mt-2 w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? "Sending..." : "Request full access"}
    </Button>
  );
}
