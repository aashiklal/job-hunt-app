"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SlotInfo = {
  type: "resume" | "cover_letter";
  label: string;
  hint: string;
};

const SLOTS: SlotInfo[] = [
  {
    type: "resume",
    label: "Resume Template",
    hint: "Upload a .docx file with {{MARKER}} placeholders.",
  },
  {
    type: "cover_letter",
    label: "Cover Letter Template",
    hint: "Upload a .docx file with {{MARKER}} placeholders.",
  },
];

type MarkerSummary = {
  markers: string[];
  blocks: string[];
  warnings: string[];
};

type Props = {
  current: Partial<Record<"resume" | "cover_letter", { fileName: string }>>;
  apiBase: string;
  title?: string;
  description?: string;
};

export function TemplateManager({
  current,
  apiBase,
  title = "Export Templates",
  description = "Upload a .docx file with {{MARKER}} placeholders. The system replaces markers with each user's actual data at export time.",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"resume" | "cover_letter" | null>(null);
  const [summary, setSummary] = useState<Partial<Record<"resume" | "cover_letter", MarkerSummary>>>({});
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  function inputRefFor(type: "resume" | "cover_letter") {
    return type === "resume" ? resumeInputRef : coverInputRef;
  }

  async function handleUpload(file: File, type: "resume" | "cover_letter") {
    setBusy(type);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const res = await fetch(apiBase, { method: "POST", body: formData });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error ?? "Upload failed");
        return;
      }

      setSummary((prev) => ({
        ...prev,
        [type]: {
          markers: data.markers ?? [],
          blocks: data.blocks ?? [],
          warnings: data.warnings ?? [],
        },
      }));

      if (data.warnings?.length > 0) {
        toast.warning(`Template uploaded with ${data.warnings.length} warning(s) -- check the marker summary.`);
      } else {
        toast.success("Template saved");
      }

      startTransition(() => router.refresh());
    } catch {
      toast.error("Network error during upload");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(type: "resume" | "cover_letter") {
    setBusy(type);
    try {
      const res = await fetch(`${apiBase}?type=${type}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error ?? "Remove failed");
        return;
      }

      setSummary((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });

      toast.success("Template removed");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(null);
    }
  }

  const isDisabled = isPending || busy !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {SLOTS.map(({ type, label, hint }) => {
          const existing = current[type];
          const isBusy = busy === type;
          const markerSummary = summary[type];

          return (
            <div key={type} className="flex flex-col gap-3 rounded-lg border px-4 py-3">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  {existing ? (
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      {existing.fileName}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={inputRefFor(type)}
                    type="file"
                    aria-label={`Upload ${label} template`}
                    accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file, type);
                      e.target.value = "";
                    }}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isDisabled}
                    onClick={() => inputRefFor(type).current?.click()}
                  >
                    {isBusy && busy === type ? "Uploading..." : existing ? "Replace" : "Upload"}
                  </Button>

                  {existing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isDisabled}
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemove(type)}
                    >
                      {isBusy ? "Removing..." : "Remove"}
                    </Button>
                  )}
                </div>
              </div>

              {markerSummary && (
                <div className="flex flex-col gap-2 text-xs border-t pt-2">
                  {markerSummary.warnings.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {markerSummary.warnings.map((w) => (
                        <p key={w} className="text-destructive">{w}</p>
                      ))}
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-muted-foreground">Detected markers: </span>
                    <span className="text-foreground">
                      {markerSummary.markers.length > 0
                        ? markerSummary.markers.map((m) => `{{${m}}}`).join(", ")
                        : "none"}
                    </span>
                  </div>
                  {markerSummary.blocks.length > 0 && (
                    <div>
                      <span className="font-medium text-muted-foreground">Repeating blocks: </span>
                      <span className="text-foreground">
                        {markerSummary.blocks.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground">
          Only .docx files are supported. Add{" "}
          <code className="font-mono bg-muted px-1 rounded">{"{{MARKER}}"}</code>{" "}
          placeholders where user data should appear. Wrap repeating sections with{" "}
          <code className="font-mono bg-muted px-1 rounded">{"{{START_EXPERIENCE}}"}</code>{" "}
          and{" "}
          <code className="font-mono bg-muted px-1 rounded">{"{{END_EXPERIENCE}}"}</code>.
        </p>
      </CardContent>
    </Card>
  );
}
