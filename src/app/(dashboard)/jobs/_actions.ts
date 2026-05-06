"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/actions";
import * as jobs from "@/lib/repositories/jobs";
import * as jobLifecycle from "@/lib/job-application-lifecycle";

const jobStatusSchema = z.enum([
  "saved",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
  "rejected",
  "withdrawn",
]);

const createJobSchema = z.object({
  company: z.string().min(1, "Company is required").max(200),
  role: z.string().min(1, "Role is required").max(200),
  location: z.string().max(200).optional(),
  jobDescription: z.string().max(50000).optional(),
  url: z.string().url("Must be a valid URL").max(2000).optional().or(z.literal("")),
  salary: z.string().max(200).optional(),
  status: jobStatusSchema.optional(),
  notes: z.string().max(10000).optional(),
  appliedAt: z.coerce.date().optional().nullable(),
});

const updateJobSchema = createJobSchema
  .omit({ status: true })
  .partial()
  .extend({
    jobId: z.string().min(1),
    contactName: z.string().max(200).optional(),
    contactTitle: z.string().max(300).optional(),
  });

const jobIdSchema = z.object({ jobId: z.string().min(1) });
const setStatusSchema = z.object({
  jobId: z.string().min(1),
  status: jobStatusSchema,
});

export const createJob = defineAction(
  async (ctx, input: z.infer<typeof createJobSchema>) => {
    const data = createJobSchema.parse(input);
    const cleanData = { ...data, url: data.url === "" ? undefined : data.url };
    const job = await jobs.create(ctx.user._id.toString(), cleanData);
    revalidatePath("/jobs");
    return { jobId: job._id.toString() };
  }
);

export const updateJob = defineAction(
  async (ctx, input: z.infer<typeof updateJobSchema>) => {
    const { jobId, ...rest } = updateJobSchema.parse(input);
    const cleanData = { ...rest, url: rest.url === "" ? undefined : rest.url };
    const updated = await jobs.update(ctx.user._id.toString(), jobId, cleanData);
    if (!updated) {
      throw new Error("Job not found");
    }
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    return { jobId };
  }
);

export const setJobStatus = defineAction(
  async (ctx, input: z.infer<typeof setStatusSchema>) => {
    const { jobId, status } = setStatusSchema.parse(input);
    const updated = await jobLifecycle.moveJobStatus(
      ctx.user._id.toString(),
      jobId,
      status
    );
    if (!updated) {
      throw new Error("Job not found");
    }
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    return { jobId };
  }
);

export const softDeleteJob = defineAction(
  async (ctx, input: z.infer<typeof jobIdSchema>) => {
    const { jobId } = jobIdSchema.parse(input);
    const deleted = await jobLifecycle.moveJobToTrash(ctx.user._id.toString(), jobId);
    if (!deleted) {
      throw new Error("Job not found");
    }
    revalidatePath("/jobs");
    revalidatePath("/jobs/trash");
    return { jobId };
  }
);

export const hardDeleteJob = defineAction(
  async (ctx, input: z.infer<typeof jobIdSchema>) => {
    const { jobId } = jobIdSchema.parse(input);
    const deleted = await jobLifecycle.permanentlyDeleteJob(
      ctx.user._id.toString(),
      jobId
    );
    if (!deleted) {
      throw new Error("Job not found in trash");
    }
    revalidatePath("/jobs/trash");
    return { jobId };
  }
);

export const restoreJob = defineAction(
  async (ctx, input: z.infer<typeof jobIdSchema>) => {
    const { jobId } = jobIdSchema.parse(input);
    const restored = await jobLifecycle.restoreJobFromTrash(
      ctx.user._id.toString(),
      jobId
    );
    if (!restored) {
      throw new Error("Job not found");
    }
    revalidatePath("/jobs");
    revalidatePath("/jobs/trash");
    return { jobId };
  }
);
