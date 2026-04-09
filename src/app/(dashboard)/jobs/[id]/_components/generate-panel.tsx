"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

type ResumeOption = {
  _id: string;
  title: string;
  isDefault: boolean;
};

type Props = {
  type: "resume" | "cover_letter";
  jobId: string;
  resumes: ResumeOption[];
  initialContent: string | null;
  initialResumeId: string | null;
};

const TITLES = {
  resume: "Tailored Resume",
  cover_letter: "Cover Letter",
};

const DESCRIPTIONS = {
  resume:
    "Generate a version of your resume tailored to this specific job, drawing only on facts in your base resume.",
  cover_letter:
    "Generate a concise, personalized cover letter for this role.",
};

export function GeneratePanel({
  type,
  jobId,
  resumes,
  initialContent,
  initialResumeId,
}: Props) {
  // Pick the default resume on first render: prefer initialResumeId (the
  // one used last time for this job+type), otherwise fall back to the
  // user's marked-default resume, otherwise the first resume in the list.
  const defaultId =
    initialResumeId ??
    resumes.find((r) => r.isDefault)?._id ??
    resumes[0]?._id ??
    "";

  const [selectedResumeId, setSelectedResumeId] = useState(defaultId);
  const [content, setContent] = useState<string>(initialContent ?? "");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(initialContent !== null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const noResumes = resumes.length === 0;

  async function handleGenerate() {
    if (noResumes) return;
    if (!selectedResumeId) {
      toast.error("Pick a resume first");
      return;
    }

    setIsStreaming(true);
    setContent("");
    setHasGenerated(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          type,
          resumeId: selectedResumeId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Error responses are always JSON, even from this normally-streaming route
        const errBody = await res.json().catch(() => null);
        if (res.status === 429 && errBody?.error === "QUOTA_EXCEEDED") {
          toast.error(
            `You have used ${errBody.used} of ${errBody.limit} AI generations this month. Quota resets soon.`
          );
        } else if (res.status === 400 && errBody?.error === "NO_RESUME") {
          toast.error(errBody.message ?? "No resume available");
        } else {
          toast.error(errBody?.error ?? errBody?.message ?? "Generation failed");
        }
        setIsStreaming(false);
        return;
      }

      if (!res.body) {
        toast.error("No response body");
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setContent(accumulated);
      }

      // Final flush
      const flushed = decoder.decode();
      if (flushed) {
        accumulated += flushed;
        setContent(accumulated);
      }

      setHasGenerated(true);
      setIsStreaming(false);
      toast.success(
        type === "resume" ? "Resume tailored" : "Cover letter ready"
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("Generation cancelled");
      } else {
        console.error(err);
        toast.error("Network error during generation");
      }
      setIsStreaming(false);
    } finally {
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }

  // Empty state: no resumes saved at all
  if (noResumes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{TITLES[type]}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You need a base resume saved before you can use this feature.
          </p>
          <Button asChild className="mt-3">
            <Link href="/resume/new">Save a resume</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLES[type]}</CardTitle>
        <p className="text-sm text-muted-foreground">{DESCRIPTIONS[type]}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resume picker */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Base resume to tailor from
            </label>
            <Select
              value={selectedResumeId}
              onValueChange={setSelectedResumeId}
              disabled={isStreaming}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a resume" />
              </SelectTrigger>
              <SelectContent>
                {resumes.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.title}
                    {r.isDefault ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            {isStreaming ? (
              <Button onClick={handleCancel} variant="outline">
                Cancel
              </Button>
            ) : (
              <Button onClick={handleGenerate}>
                {hasGenerated ? "Regenerate" : "Generate"}
              </Button>
            )}
          </div>
        </div>

        {/* Output area */}
        {(content || isStreaming) && (
          <div className="border rounded-md p-4 bg-muted/30 min-h-32 max-h-[600px] overflow-y-auto">
            {isStreaming && content === "" ? (
              <p className="text-sm text-muted-foreground italic">
                Generating...
              </p>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Action buttons after generation */}
        {hasGenerated && !isStreaming && content && (
          <div className="flex gap-2">
            <Button onClick={handleCopy} variant="outline" size="sm">
              Copy
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
