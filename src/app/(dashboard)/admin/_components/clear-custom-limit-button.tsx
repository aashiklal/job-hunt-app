"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearUserCustomLimit } from "../_actions";

type Props = {
  userId: string;
};

export function ClearCustomLimitButton({ userId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await clearUserCustomLimit({ userId });
      if (result.ok) {
        toast.success("Custom limit cleared. Plan default applies.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? "Clearing..." : "Clear custom limit"}
    </Button>
  );
}
