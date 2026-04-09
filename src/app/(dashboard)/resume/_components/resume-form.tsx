"use client";

import { useTransition } from "react";
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

  const form = useForm<ResumeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "My Resume",
      content: "",
      ...initialValues,
    },
  });

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
        {/* TODO phase-5.2: file upload buttons */}

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
          <Button type="submit" disabled={isPending}>
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
