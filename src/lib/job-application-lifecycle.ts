import "server-only";
import * as jobs from "@/lib/repositories/jobs";
import type { JobStatus } from "@/lib/repositories/jobs";
import { InvalidTransitionError, isValidTransition } from "@/lib/repositories/jobs";

export async function moveJobStatus(
  userId: string,
  jobId: string,
  status: JobStatus
) {
  const current = await jobs.getById(userId, jobId);
  if (!current) return null;
  if (!isValidTransition(current.status, status)) {
    throw new InvalidTransitionError(current.status, status);
  }
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
