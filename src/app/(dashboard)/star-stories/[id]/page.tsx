import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as starStories from "@/lib/repositories/star-stories";
import { StarStoryForm } from "../_components/star-story-form";
import { DeleteStoryButton } from "../_components/delete-story-button";
import { PolishPanel } from "../_components/polish-panel";

export const metadata: Metadata = {
  title: "STAR story: Job Hunt",
  description: "Edit your behavioral interview story.",
};

export default async function StarStoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireApprovedUserWithPlan();
  const userIdStr = user._id.toString();

  const story = await starStories.getById(userIdStr, id);
  if (!story) notFound();

  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10 md:space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href="/star-stories"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground mb-2"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
            Back to stories
          </Link>
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {story.title}
          </h1>
        </div>
        <DeleteStoryButton storyId={id} storyTitle={story.title} />
      </div>

      <StarStoryForm
        mode="edit"
        storyId={id}
        initialValues={{
          title: story.title,
          tags: story.tags.join(", "),
          roughDraft: story.roughDraft,
          maxWords: story.maxWords ?? undefined,
        }}
      />

      <PolishPanel
        storyId={id}
        initialPolished={story.polishedOutput}
        maxWords={story.maxWords}
      />
    </div>
  );
}
