"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { approveUser, rejectUser } from "../_actions";

type Props = {
  userId: string;
  variant: "approve" | "reject";
};

export function UserActionButton({ userId, variant }: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleApprove() {
    startTransition(async () => {
      const result = await approveUser({ userId });
      if (result.ok) {
        toast.success("User approved.");
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectUser({ userId });
      if (result.ok) {
        toast.success("User rejected.");
        setOpen(false);
      } else {
        toast.error(result.error.message);
        setOpen(false);
      }
    });
  }

  if (variant === "approve") {
    return (
      <Button size="sm" disabled={pending} onClick={handleApprove}>
        {pending ? "Approving…" : "Approve"}
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {pending ? "Rejecting…" : "Reject"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this user?</DialogTitle>
            <DialogDescription>
              They&apos;ll lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={handleReject}
            >
              {pending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
