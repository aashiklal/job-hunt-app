"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/actions";
import * as resumes from "@/lib/repositories/resumes";

const titleSchema = z.string().min(1, "Title is required").max(200);
const contentSchema = z
  .string()
  .min(100, "Resume content must be at least 100 characters")
  .max(100000, "Resume content is too large");

const createResumeSchema = z.object({
  title: titleSchema,
  content: contentSchema,
  isDefault: z.boolean().optional(),
});

const updateResumeSchema = z.object({
  resumeId: z.string().min(1),
  title: titleSchema.optional(),
  content: contentSchema.optional(),
});

const resumeIdSchema = z.object({ resumeId: z.string().min(1) });

export const createResume = defineAction(
  async (ctx, input: z.infer<typeof createResumeSchema>) => {
    const data = createResumeSchema.parse(input);
    const userId = ctx.user._id.toString();

    const currentCount = await resumes.countForUser(userId);
    const maxResumes = ctx.plan.maxResumes;
    if (maxResumes !== -1 && currentCount >= maxResumes) {
      throw new Error(
        `Resume limit reached (${maxResumes}). Delete an existing resume to create a new one.`
      );
    }

    const isDefault = currentCount === 0 ? true : (data.isDefault ?? false);

    const resume = await resumes.create(userId, {
      title: data.title,
      content: data.content,
      isDefault,
    });
    revalidatePath("/resume");
    return { resumeId: (resume._id as { toString(): string }).toString() };
  }
);

export const updateResume = defineAction(
  async (ctx, input: z.infer<typeof updateResumeSchema>) => {
    const { resumeId, ...rest } = updateResumeSchema.parse(input);
    const updated = await resumes.update(ctx.user._id.toString(), resumeId, rest);
    if (!updated) {
      throw new Error("Resume not found");
    }
    revalidatePath("/resume");
    revalidatePath(`/resume/${resumeId}`);
    return { resumeId };
  }
);

export const setDefaultResume = defineAction(
  async (ctx, input: z.infer<typeof resumeIdSchema>) => {
    const { resumeId } = resumeIdSchema.parse(input);
    const updated = await resumes.setDefault(ctx.user._id.toString(), resumeId);
    if (!updated) {
      throw new Error("Resume not found");
    }
    revalidatePath("/resume");
    return { resumeId };
  }
);

export const deleteResume = defineAction(
  async (ctx, input: z.infer<typeof resumeIdSchema>) => {
    const { resumeId } = resumeIdSchema.parse(input);
    const deleted = await resumes.deleteResume(ctx.user._id.toString(), resumeId);
    if (!deleted) {
      throw new Error("Resume not found");
    }
    revalidatePath("/resume");
    return { resumeId };
  }
);
