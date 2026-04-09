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
  const [value, setValue] = useState(String(currentLimit));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a non-negative whole number");
      return;
    }
    if (parsed > 10000) {
      setError("Maximum is 10000");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await setUserCustomLimit({
        userId,
        aiGenerationsPerMonth: parsed,
      });
      if (result.ok) {
        toast.success(`Custom limit set to ${parsed}`);
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
          Set custom limit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set custom AI generation limit</DialogTitle>
          <DialogDescription>
            Override this user&apos;s monthly AI generation limit. The plan
            default is {planDefault}. Use this for friends in heavy job-hunt
            mode who need more than the default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="limit-input">Generations per month</Label>
          <Input
            id="limit-input"
            type="number"
            min={0}
            max={10000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
          />
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
