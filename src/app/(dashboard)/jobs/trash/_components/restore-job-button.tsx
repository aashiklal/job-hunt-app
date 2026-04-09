"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { restoreJob } from "@/app/(dashboard)/jobs/_actions";

type Props = {
  jobId: string;
};

export function RestoreJobButton({ jobId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreJob({ jobId });
      if (result.ok) {
        toast.success("Job restored.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={handleRestore}>
      {isPending ? "Restoring…" : "Restore"}
    </Button>
  );
}
