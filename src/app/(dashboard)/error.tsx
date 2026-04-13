"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[dashboard error]", error.message);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md border border-border/60 shadow-xs">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <AlertTriangle
            className="size-5 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          <CardTitle className="text-base font-semibold text-foreground">
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Try again or refresh the page.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="self-start"
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
