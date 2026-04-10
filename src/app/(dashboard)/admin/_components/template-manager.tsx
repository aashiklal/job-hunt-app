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
    hint: "Used when exporting a tailored resume.",
  },
  {
    type: "cover_letter",
    label: "Cover Letter Template",
    hint: "Used when exporting a cover letter.",
  },
];

type Props = {
  /** Current templates already set. Keyed by type. */
  current: Partial<Record<"resume" | "cover_letter", { fileName: string }>>;
  /** Which API base path to use. "/api/templates" for users, "/api/admin/templates" for admins. */
  apiBase: string;
  title?: string;
  description?: string;
};

export function TemplateManager({
  current,
  apiBase,
  title = "Export Templates",
  description = "Upload a .docx file as a style template. When you download a generated resume or cover letter, the output will use this template's fonts, colours, and formatting.",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"resume" | "cover_letter" | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  function inputRefFor(type: "resume" | "cover_letter") {
    return type === "resume" ? resumeInputRef : coverInputRef;
  }

  async function handleUpload(
    file: File,
    type: "resume" | "cover_letter"
  ) {
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

      toast.success("Template saved");
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

          return (
            <div
              key={type}
              className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between rounded-lg border px-4 py-3"
            >
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
                {/* Hidden file input */}
                <input
                  ref={inputRefFor(type)}
                  type="file"
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
                  {isBusy && busy === type ? "Uploading…" : existing ? "Replace" : "Upload"}
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
                    {isBusy ? "Removing…" : "Remove"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground">
          Only .docx files are supported. Templates work best when built with standard Word
          heading styles (Heading 1, Heading 2, etc.).
        </p>
      </CardContent>
    </Card>
  );
}
