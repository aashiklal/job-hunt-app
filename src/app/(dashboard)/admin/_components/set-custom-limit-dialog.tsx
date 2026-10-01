"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { describeCredits } from "@/lib/credits";
import { setUserCustomLimit } from "../_actions";

type Props = {
  userId: string;
  /** The user's current monthly allowance in credits. -1 = unlimited. */
  currentCredits: number;
  /** The plan's allowance, shown for reference. -1 = unlimited. */
  planCredits: number;
};

const MAX_CREDITS = 100_000;

function formatCredits(n: number): string {
  return n === -1 ? "unlimited" : `${n} credits`;
}

export function SetCustomLimitDialog({ userId, currentCredits, planCredits }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentCredits));
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= -1 && parsed <= MAX_CREDITS;

  function handleSubmit() {
    if (!valid) {
      setError(`Enter a whole number of credits up to ${MAX_CREDITS}, or -1 for unlimited.`);
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await setUserCustomLimit({ userId, monthlyCredits: parsed });
      if (result.ok) {
        toast.success(`Allowance set to ${formatCredits(parsed)} a billing month`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Set custom allowance
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set custom credit allowance</DialogTitle>
          <DialogDescription>
            Give this user their own monthly allowance in place of the plan&apos;s{" "}
            {formatCredits(planCredits)}. Use it for someone in a heavy stretch
            of their search who needs more.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="credits-input">Credits per billing month (-1 for unlimited)</Label>
          <Input
            id="credits-input"
            type="number"
            inputMode="numeric"
            min={-1}
            max={MAX_CREDITS}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">
            {valid
              ? parsed === -1
                ? "No limit."
                : describeCredits(parsed)
              : " "}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
