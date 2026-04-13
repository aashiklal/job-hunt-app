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
import { setUserCustomLimit } from "../_actions";

type Props = {
  userId: string;
  currentLimit: number;
  planDefault: number;
};

export function SetCustomLimitDialog({ userId, currentLimit, planDefault }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentLimit.toFixed(2));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a non-negative dollar amount (e.g. 10.00)");
      return;
    }
    if (parsed > 500) {
      setError("Maximum is $500.00");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await setUserCustomLimit({
        userId,
        aiSpendLimitUSD: parsed,
      });
      if (result.ok) {
        toast.success(`Custom budget set to $${parsed.toFixed(2)}`);
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
          Set custom budget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set custom AI budget</DialogTitle>
          <DialogDescription>
            Override this user&apos;s monthly AI spend budget. The plan
            default is ${planDefault.toFixed(2)}/month. Use this for users
            in heavy job-hunt mode who need more than the default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="limit-input">Monthly budget (USD)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              id="limit-input"
              type="number"
              min={0}
              max={500}
              step={0.01}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="pl-7"
            />
          </div>
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
