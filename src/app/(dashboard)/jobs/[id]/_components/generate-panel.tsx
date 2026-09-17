"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { describeQuotaError } from "@/lib/quota-copy";

type StreamEvent =
  | { type: "partial"; markdown: string }
  | {
      type: "done";
      documentId: string;
      content: string;
    }
  | {
      type: "error";
      status: number;
      error?: string;
      message?: string;
      used?: number;
      limit?: number;
      budgetScope?: "monthly" | "lifetime" | null;
    };

function describeError(body: {
  status: number;
  error?: string;
  message?: string;
  used?: number;
  limit?: number;
  budgetScope?: "monthly" | "lifetime" | null;
}): string {
  if (body.status === 429 && body.error === "QUOTA_EXCEEDED") {
    return describeQuotaError(body);
  }
  if (body.status === 400 && body.error === "NO_RESUME") {
    return body.message ?? "No resume available";
  }
  return body.message ?? body.error ?? "Generation failed";
}

/** Reads a newline-delimited JSON body and hands each parsed event to `onEvent`. */
async function readNdjson(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
      newline = buffer.indexOf("\n");
    }
  }
}

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
  initialDocumentId: string | null;
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

const FILENAMES = {
  resume: "tailored-resume",
  cover_letter: "cover-letter",
};

export function GeneratePanel({
  type,
  jobId,
  resumes,
  initialContent,
  initialResumeId,
  initialDocumentId,
}: Props) {
  const defaultId =
    initialResumeId ??
    resumes.find((r) => r.isDefault)?._id ??
    resumes[0]?._id ??
    "";

  const router = useRouter();
  const [selectedResumeId, setSelectedResumeId] = useState(defaultId);
  const [content, setContent] = useState<string>(initialContent ?? "");
  const [documentId, setDocumentId] = useState<string | null>(initialDocumentId);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(initialContent !== null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingTex, setIsDownloadingTex] = useState(false);
  const [isCopyingTex, setIsCopyingTex] = useState(false);
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
    setDocumentId(null);

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

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        toast.error(describeError({ status: res.status, ...errBody }));
        setIsStreaming(false);
        return;
      }

      // Partial previews arrive faster than React needs to paint; coalesce
      // them to one state update per animation frame.
      let pendingMarkdown: string | null = null;
      let frame: number | null = null;
      const flush = () => {
        frame = null;
        if (pendingMarkdown !== null) setContent(pendingMarkdown);
        pendingMarkdown = null;
      };

      let outcome: "done" | "error" | null = null;
      await readNdjson(res.body, (event) => {
        if (event.type === "partial") {
          pendingMarkdown = event.markdown;
          if (frame === null) frame = requestAnimationFrame(flush);
          return;
        }
        if (frame !== null) cancelAnimationFrame(frame);
        pendingMarkdown = null;
        if (event.type === "done") {
          outcome = "done";
          setContent(event.content ?? "");
          setDocumentId(event.documentId ?? null);
          setHasGenerated(true);
          return;
        }
        outcome = "error";
        toast.error(describeError(event));
      });

      if (outcome === "done") {
        toast.success(type === "resume" ? "Resume tailored" : "Cover letter ready");
        router.refresh();
      } else if (outcome === null) {
        toast.error("Generation ended before a result arrived. Please try again.");
      }
      setIsStreaming(false);
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

  async function handleDownload() {
    if (!content || !documentId) return;
    setIsDownloading(true);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/export?format=docx&filename=${encodeURIComponent(FILENAMES[type])}`
      );

      if (!res.ok) {
        toast.error("Export failed");
        return;
      }

      const fallback = res.headers.get("X-Template-Fallback");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${FILENAMES[type]}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (fallback === "admin") {
        toast.info("Your template didn't have enough structure. The default template was used instead.");
      } else if (fallback === "generic") {
        toast.info("Your template didn't have enough structure. A clean default format was used instead.");
      } else {
        toast.success("Downloaded as DOCX");
      }
    } catch {
      toast.error("Download failed");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDownloadTex() {
    if (!content || !documentId) return;
    setIsDownloadingTex(true);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/export?format=tex&filename=${encodeURIComponent(FILENAMES[type])}`
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? "Export failed");
        return;
      }

      const fallback = res.headers.get("X-Template-Fallback");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${FILENAMES[type]}.tex`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (fallback === "generic") {
        toast.info("No LaTeX template found. A clean default format was used.");
      } else {
        toast.success("Downloaded as LaTeX");
      }
    } catch {
      toast.error("Download failed");
    } finally {
      setIsDownloadingTex(false);
    }
  }

  async function handleCopyTex() {
    if (!documentId) return;
    setIsCopyingTex(true);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/export?format=tex`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? "Copy failed");
        return;
      }
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast.success("Copied as LaTeX");
    } catch {
      toast.error("Copy failed");
    } finally {
      setIsCopyingTex(false);
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
        {/* Resume picker + Generate */}
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
              <Button
                onClick={handleGenerate}
                data-tour={type === "resume" ? "generate-resume" : "generate-cover-letter"}
              >
                {hasGenerated ? "Regenerate" : "Generate"}
              </Button>
            )}
          </div>
        </div>

        {isStreaming && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
            {content ? "Streaming from Claude" : "Reading your resume and the job description"}
          </p>
        )}

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
                {isStreaming && (
                  <span
                    className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle"
                    aria-hidden
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Post-generation actions */}
        {hasGenerated && !isStreaming && content && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleCopy} variant="outline" size="sm">
              Copy
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              disabled={isDownloading || !documentId}
            >
              {isDownloading ? "Preparing…" : "Download DOCX"}
            </Button>
            <Button
              onClick={handleCopyTex}
              variant="outline"
              size="sm"
              disabled={isCopyingTex || !documentId}
            >
              {isCopyingTex ? "Copying…" : "Copy .tex"}
            </Button>
            <Button
              onClick={handleDownloadTex}
              variant="outline"
              size="sm"
              disabled={isDownloadingTex || !documentId}
            >
              {isDownloadingTex ? "Preparing…" : "Download .tex"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
