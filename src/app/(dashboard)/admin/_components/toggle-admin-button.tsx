"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { toggleUserAdmin } from "../_actions";

type Props = {
  userId: string;
  currentlyAdmin: boolean;
  userLabel: string;
};

export function ToggleAdminButton({ userId, currentlyAdmin, userLabel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await toggleUserAdmin({ userId });
      if (result.ok) {
        toast.success(
          currentlyAdmin ? "Admin access revoked" : "Admin access granted"
        );
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  const label = currentlyAdmin ? "Revoke admin" : "Make admin";
  const dialogTitle = currentlyAdmin ? "Revoke admin access?" : "Grant admin access?";
  const dialogDesc = currentlyAdmin
    ? `${userLabel} will no longer be able to access the admin panel.`
    : `${userLabel} will be able to access the admin panel and approve, reject, or modify other users. Only grant this to trusted users.`;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {pending ? "Updating..." : label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>{dialogDesc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={pending}>
            {pending ? "Updating..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
