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
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" strokeWidth={1.75} />
          <CardTitle className="text-base font-semibold text-gray-900">
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            An unexpected error occurred. Try again or refresh the page.
          </p>
          <Button variant="outline" size="sm" onClick={reset} className="self-start">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
