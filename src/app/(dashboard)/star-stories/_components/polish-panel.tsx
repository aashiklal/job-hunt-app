"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenerationProgressBar } from "@/components/GenerationProgressBar";

type Props = {
  storyId: string;
  initialPolished: string | null;
  maxWords: number | null;
};

export function PolishPanel({ storyId, initialPolished, maxWords }: Props) {
  const [polished, setPolished] = useState(initialPolished ?? "");
  const [maxWordsOverride, setMaxWordsOverride] = useState(maxWords ?? 200);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerate() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/star-stories/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, maxWords: maxWordsOverride }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.error === "QUOTA_EXCEEDED") {
          const spent = typeof data.used === "number" ? `$${data.used.toFixed(2)}` : "your full";
          const limit = typeof data.limit === "number" ? `$${data.limit.toFixed(2)}` : "";
          toast.error(`Monthly AI budget reached (${spent} of ${limit} used).`);
        } else {
          toast.error(data.error ?? "Generation failed");
        }
        return;
      }
      setPolished(data.polished ?? "");
      toast.success("Story polished");
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(polished);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI polish</CardTitle>
        <p className="text-sm text-muted-foreground">
          Rewrites your rough story into a clean STAR-format answer.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="max-words">Target word count</Label>
          <Input
            id="max-words"
            type="number"
            min={50}
            max={500}
            value={maxWordsOverride}
            onChange={(e) => setMaxWordsOverride(Number(e.target.value))}
            className="w-32"
          />
        </div>

        <Button onClick={handleGenerate} disabled={isLoading}>
          {isLoading ? "Polishing..." : polished ? "Re-polish" : "Polish"}
        </Button>

        <GenerationProgressBar isLoading={isLoading} durationMs={4000} />

        {polished && (
          <div className="space-y-2">
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 font-sans text-sm text-foreground">
              {polished}
            </pre>
            <Button onClick={handleCopy} variant="outline" size="sm">
              Copy
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
