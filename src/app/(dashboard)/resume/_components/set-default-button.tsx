"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setDefaultResume } from "../_actions";

type Props = {
  resumeId: string;
};

export function SetDefaultButton({ resumeId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await setDefaultResume({ resumeId });
      if (result.ok) {
        toast.success("Default resume updated.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "Setting…" : "Set default"}
    </Button>
  );
}
