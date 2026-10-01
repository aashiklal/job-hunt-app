import "server-only";
import * as jobs from "@/lib/repositories/jobs";
import type { JobStatus } from "@/lib/repositories/jobs";

// Any status may move to any other (see Status in CONTEXT.md).
export async function moveJobStatus(
  userId: string,
  jobId: string,
  status: JobStatus
) {
  return jobs.setStatus(userId, jobId, status);
}

export async function moveJobToTrash(userId: string, jobId: string) {
  return jobs.softDelete(userId, jobId);
}

export async function restoreJobFromTrash(userId: string, jobId: string) {
  return jobs.restore(userId, jobId);
}

export async function permanentlyDeleteJob(userId: string, jobId: string) {
  return jobs.hardDelete(userId, jobId);
}
