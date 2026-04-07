"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestAccessAgain } from "../_actions";

export function RequestAccessButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className="mt-4 w-full"
      disabled={pending}
      onClick={() => startTransition(() => requestAccessAgain())}
    >
      {pending ? "Submitting…" : "Request access again"}
    </Button>
  );
}
