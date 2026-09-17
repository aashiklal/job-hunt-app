"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { createResume, updateResume } from "../_actions";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(100, "Resume content must be at least 100 characters"),
});

export type ResumeFormValues = z.infer<typeof formSchema>;

type Props = {
  mode: "create" | "edit";
  initialValues?: Partial<ResumeFormValues>;
  resumeId?: string;
};

export function ResumeForm({ mode, initialValues, resumeId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isParsing, setIsParsing] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ResumeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "My Resume",
      content: "",
      ...initialValues,
    },
  });

  async function handleFileUpload(file: File, kind: "pdf" | "docx") {
    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint =
        kind === "pdf" ? "/api/resume/parse-pdf" : "/api/resume/parse-docx";
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to parse file");
        return;
      }
      form.setValue("content", data.text, {
        shouldValidate: true,
        shouldDirty: true,
      });
      toast.success("Text extracted. Review and edit below before saving.");
    } catch (err) {
      console.error(err);
      toast.error("Network error while parsing file");
    } finally {
      setIsParsing(false);
    }
  }

  function onSubmit(values: ResumeFormValues) {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createResume(values)
          : await updateResume({ ...values, resumeId: resumeId! });

      if (result.ok) {
        router.push("/resume");
      } else {
        toast.error(result.error.message);
        if (result.error.code === "VALIDATION" && result.error.fieldErrors) {
          for (const [field, message] of Object.entries(result.error.fieldErrors)) {
            form.setError(field as keyof ResumeFormValues, { message });
          }
        }
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground mr-2">
            Or import from a file:
          </span>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, "pdf");
              e.target.value = "";
            }}
          />
          <input
            ref={docxInputRef}
            type="file"
            accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, "docx");
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isParsing}
            onClick={() => pdfInputRef.current?.click()}
            data-tour="upload-resume"
          >
            {isParsing ? "Parsing…" : "Upload PDF"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isParsing}
            onClick={() => docxInputRef.current?.click()}
            data-tour="upload-resume"
          >
            {isParsing ? "Parsing…" : "Upload DOCX"}
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            Max 5 MB. Text will populate the content field below.
          </span>
        </div>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input placeholder="My Resume" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Paste your resume text here…"
                  rows={24}
                  className="font-mono text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending} data-tour="submit-resume">
            {isPending
              ? "Saving…"
              : mode === "create"
              ? "Create resume"
              : "Save changes"}
          </Button>
          {mode === "edit" && (
            <Button variant="outline" asChild>
              <Link href="/resume">Cancel</Link>
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
