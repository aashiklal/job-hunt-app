import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { callMeteredText } from "@/lib/ai-execution";
import * as users from "@/lib/repositories/users";
import * as starStories from "@/lib/repositories/star-stories";
import { QuotaExceededError } from "@/lib/usage";
import { buildSTARStoryPolishPrompt } from "@/lib/prompts";

const MODEL = "claude-sonnet-4-5";

const requestSchema = z.object({
  storyId: z.string().min(1),
  maxWords: z.number().int().min(50).max(500).optional(),
});

export async function POST(req: NextRequest) {
  // 1. Auth check
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  const { storyId, maxWords } = parseResult.data;

  // 3. Look up the user (Mongo, not Clerk)
  const user = await users.getByClerkId(clerkUserId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userIdStr = (user._id as { toString(): string }).toString();

  // 4. Look up the story (with userId scoping)
  const story = await starStories.getById(userIdStr, storyId);
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  try {
    const { system, userMessage } = buildSTARStoryPolishPrompt({
      roughDraft: story.roughDraft,
      title: story.title,
      maxWords: maxWords ?? 200,
    });
    const { content: polished } = await callMeteredText({
      userId: userIdStr,
      model: MODEL,
      maxTokens: 1024,
      system,
      userMessage,
    });

    await starStories.savePolished(userIdStr, storyId, polished);

    return NextResponse.json({ polished });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: err.message,
          limit: err.limit,
          used: err.used,
          periodEndsAt: err.periodEndsAt.toISOString(),
          budgetScope: err.budgetScope,
        },
        { status: 429 }
      );
    }
    console.error("[star-stories/polish] generation failed:", err);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
