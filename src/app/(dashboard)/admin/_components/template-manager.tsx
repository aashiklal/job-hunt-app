"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ThemeCapacity } from "@/lib/export/pixel-theme-contract";

type SlotType = "resume" | "cover_letter";

type SlotInfo = {
  type: SlotType;
  label: string;
  hint: string;
  accept: string;
};

const SLOTS: SlotInfo[] = [
  {
    type: "resume",
    label: "Resume theme (DOCX)",
    hint: "Upload a .docx visual reference.",
    accept: "application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx",
  },
  {
    type: "cover_letter",
    label: "Cover letter theme (DOCX)",
    hint: "Upload a .docx visual reference.",
    accept: "application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx",
  },
];

type ThemeSummary = {
  textParagraphCount: number;
  mappedRegionCount: number;
  mappedStyleCount: number;
  hasTables: boolean;
  hasDrawings: boolean;
  hasTextBoxes: boolean;
  hasMarkers: boolean;
  themeCapacity: ThemeCapacity | null;
  warnings: string[];
};

type Props = {
  current: Partial<
    Record<
      SlotType,
      {
        fileName: string;
        mappedRegionCount?: number;
        mappedStyleCount?: number;
        themeCapacity?: ThemeCapacity | null;
      }
    >
  >;
  apiBase: string;
  title?: string;
  description?: string;
};

export function TemplateManager({
  current,
  apiBase,
  title = "Document Themes",
  description = "Upload normal .docx files as visual references. The app keeps the look and replaces the sample text with each user's generated content.",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<SlotType | null>(null);
  const [summary, setSummary] = useState<Partial<Record<SlotType, ThemeSummary>>>({});
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  function inputRefFor(type: SlotType) {
    return type === "resume" ? resumeInputRef : coverInputRef;
  }

  async function handleUpload(file: File, type: SlotType) {
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
          textParagraphCount: data.themeAnalysis?.textParagraphCount ?? 0,
          mappedRegionCount: data.pixelThemeMap?.regionCount ?? 0,
          mappedStyleCount: data.styleRoleMap?.mappedStyleCount ?? 0,
          hasTables: data.themeAnalysis?.hasTables ?? false,
          hasDrawings: data.themeAnalysis?.hasDrawings ?? false,
          hasTextBoxes: data.themeAnalysis?.hasTextBoxes ?? false,
          hasMarkers: data.themeAnalysis?.hasMarkers ?? false,
          themeCapacity: data.themeCapacity ?? null,
          warnings: data.warnings ?? [],
        },
      }));
      if (data.warnings?.length > 0) {
        toast.warning(`Theme uploaded with ${data.warnings.length} warning(s). Check the theme summary.`);
      } else {
        toast.success("Theme saved");
      }

      startTransition(() => router.refresh());
    } catch {
      toast.error("Network error during upload");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(type: SlotType) {
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

      toast.success("Theme removed");
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
        {SLOTS.map(({ type, label, hint, accept }) => {
          const existing = current[type];
          const isBusy = busy === type;
          const themeSummary = summary[type];
          const existingRegionCount = existing?.mappedRegionCount;
          const existingStyleCount = existing?.mappedStyleCount;
          const existingCapacity = existing?.themeCapacity;

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
                    accept={accept}
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

              {themeSummary ? (
                <div className="flex flex-col gap-2 text-xs border-t pt-2">
                  {themeSummary.warnings.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {themeSummary.warnings.map((w) => (
                        <p key={w} className="text-destructive">{w}</p>
                      ))}
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-muted-foreground">Theme Capacity: </span>
                    <span className="text-foreground">
                      {themeSummary.themeCapacity
                        ? `${themeSummary.themeCapacity.level}: ${themeSummary.themeCapacity.guidance}`
                        : "unavailable"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Theme text paragraphs: </span>
                    <span className="text-foreground">{themeSummary.textParagraphCount}</span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Style roles: </span>
                    <span className="text-foreground">
                      {themeSummary.mappedStyleCount > 0
                        ? `${themeSummary.mappedStyleCount} mapped`
                        : "none. Re-upload to enable style matching"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Pixel theme regions: </span>
                    <span className="text-foreground">
                      {themeSummary.mappedRegionCount > 0
                        ? `${themeSummary.mappedRegionCount} mapped`
                        : "none. Re-upload to enable design matching"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Detected features: </span>
                    <span className="text-foreground">
                      {[
                        themeSummary.hasTables ? "tables" : null,
                        themeSummary.hasDrawings ? "drawings/shapes" : null,
                        themeSummary.hasTextBoxes ? "text boxes" : null,
                        themeSummary.hasMarkers ? "old markers treated as sample text" : null,
                      ].filter(Boolean).join(", ") || "standard paragraphs"}
                    </span>
                  </div>
                </div>
              ) : existing && (existingRegionCount !== undefined || existingStyleCount !== undefined) && (
                <div className="flex flex-col gap-2 text-xs border-t pt-2">
                  {existingCapacity && (
                    <div>
                      <span className="font-medium text-muted-foreground">Theme Capacity: </span>
                      <span className="text-foreground">
                        {existingCapacity.level}: {existingCapacity.guidance}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-muted-foreground">Style roles: </span>
                    <span className="text-foreground">
                      {(existingStyleCount ?? 0) > 0
                        ? `${existingStyleCount} mapped`
                        : "none. Re-upload to enable style matching"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Pixel theme regions: </span>
                    <span className="text-foreground">
                      {(existingRegionCount ?? 0) > 0
                        ? `${existingRegionCount} mapped`
                        : "none. Re-upload to enable design matching"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground">
          Existing text in uploaded DOCX files is treated as sample content and will not be copied into user exports.
        </p>
      </CardContent>
    </Card>
  );
}
