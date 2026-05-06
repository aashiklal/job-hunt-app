"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { Resolver } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createStarStory, updateStarStory } from "../_actions";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  tags: z.string().max(500).optional(),
  roughDraft: z.string().min(1, "Story is required").max(10000),
  maxWords: z.coerce.number().int().min(50).max(500).optional().or(z.literal("")),
});

type FormValues = {
  title: string;
  tags?: string;
  roughDraft: string;
  maxWords?: number | "";
};

type Props = {
  mode: "create" | "edit";
  storyId?: string;
  initialValues?: {
    title?: string;
    tags?: string;
    roughDraft?: string;
    maxWords?: number;
  };
};

export function StarStoryForm({ mode, storyId, initialValues }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      title: initialValues?.title ?? "",
      tags: initialValues?.tags ?? "",
      roughDraft: initialValues?.roughDraft ?? "",
      maxWords: initialValues?.maxWords ?? ("" as unknown as number),
    },
  });

  function onSubmit(values: FormValues) {
    const tags = values.tags
      ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    const maxWords = values.maxWords !== "" && values.maxWords !== undefined
      ? Number(values.maxWords)
      : undefined;

    startTransition(async () => {
      if (mode === "create") {
        const result = await createStarStory({
          title: values.title,
          tags,
          roughDraft: values.roughDraft,
          ...(maxWords !== undefined ? { maxWords } : {}),
        });
        if (result.ok) {
          router.push(`/star-stories/${result.data.storyId}`);
        } else {
          toast.error(result.error.message ?? "Failed to create story.");
        }
      } else {
        if (!storyId) return;
        const result = await updateStarStory({
          storyId,
          title: values.title,
          tags,
          roughDraft: values.roughDraft,
          ...(maxWords !== undefined ? { maxWords } : {}),
        });
        if (result.ok) {
          toast.success("Saved");
          router.refresh();
        } else {
          toast.error(result.error.message ?? "Failed to save story.");
        }
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Led the API migration under deadline" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags (optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. leadership, conflict, technical" {...field} />
              </FormControl>
              <FormDescription>
                Comma-separated. Used to find stories during interview prep.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="roughDraft"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your story</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Write your raw story here. It doesn't need to be perfect; that's what the polish feature is for."
                  rows={8}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="maxWords"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target word count (optional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={50}
                  max={500}
                  placeholder="200"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                Target word count for the AI polished output.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
            ? "Save story"
            : "Save changes"}
        </Button>
      </form>
    </Form>
  );
}
