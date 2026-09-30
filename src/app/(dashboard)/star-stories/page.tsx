import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as starStories from "@/lib/repositories/star-stories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "STAR stories: JobHunt",
  description: "Manage your behavioral interview stories.",
};

export default async function StarStoriesPage() {
  const { user } = await requireApprovedUserWithPlan();
  const userIdStr = user._id.toString();
  const storyList = await starStories.list(userIdStr);

  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10 md:space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          STAR stories
        </h1>
        <Button asChild>
          <Link href="/star-stories/new">New story</Link>
        </Button>
      </div>

      {storyList.length === 0 ? (
        <Card className="border border-border/60 shadow-xs">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-base font-semibold text-foreground">
              No stories yet
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Write your behavioral interview stories in rough form. The AI will
              polish them into clean STAR-format answers ready for interviews.
            </p>
            <Button asChild className="mt-1">
              <Link href="/star-stories/new">Create your first story</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {storyList.map((story) => (
            <Link
              key={story._id}
              href={`/star-stories/${story._id}`}
              className="block group"
            >
              <Card className="border border-border/60 shadow-xs transition-shadow duration-200 hover:shadow-sm">
                <CardContent className="px-4 py-4 md:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground group-hover:underline underline-offset-4">
                          {story.title}
                        </p>
                        {story.polishedOutput && (
                          <Badge variant="secondary" className="shrink-0">
                            Polished
                          </Badge>
                        )}
                      </div>
                      {story.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {story.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {story.roughDraft.slice(0, 150)}
                        {story.roughDraft.length > 150 ? "..." : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(story.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
