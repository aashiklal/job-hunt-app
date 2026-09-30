"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/actions";
import { assertDemoCapacity } from "@/lib/demo-accounts";
import * as starStories from "@/lib/repositories/star-stories";

const createStarStorySchema = z.object({
  title: z.string().min(1).max(200),
  tags: z.array(z.string().max(50)),
  roughDraft: z.string().min(1).max(10000),
  maxWords: z.number().int().min(50).max(500).optional(),
});

const updateStarStorySchema = z.object({
  storyId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  tags: z.array(z.string().max(50)).optional(),
  roughDraft: z.string().min(1).max(10000).optional(),
  maxWords: z.number().int().min(50).max(500).optional(),
});

const storyIdSchema = z.object({
  storyId: z.string().min(1),
});

export const createStarStory = defineAction(
  async (
    ctx,
    input: z.infer<typeof createStarStorySchema>
  ) => {
    const data = createStarStorySchema.parse(input);
    await assertDemoCapacity(ctx.user, "starStories");
    const story = await starStories.create(ctx.user._id.toString(), data);
    revalidatePath("/star-stories");
    return { storyId: story._id };
  }
);

export const updateStarStory = defineAction(
  async (
    ctx,
    input: z.infer<typeof updateStarStorySchema>
  ) => {
    const { storyId, ...rest } = updateStarStorySchema.parse(input);
    const updated = await starStories.update(ctx.user._id.toString(), storyId, rest);
    if (!updated) {
      throw new Error("Story not found");
    }
    revalidatePath("/star-stories");
    return { storyId };
  }
);

export const deleteStarStory = defineAction(
  async (
    ctx,
    input: z.infer<typeof storyIdSchema>
  ) => {
    const { storyId } = storyIdSchema.parse(input);
    const deleted = await starStories.deleteStory(ctx.user._id.toString(), storyId);
    if (!deleted) {
      throw new Error("Story not found");
    }
    revalidatePath("/star-stories");
    return { storyId };
  }
);
