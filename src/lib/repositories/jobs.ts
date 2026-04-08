import connectDB from "@/lib/db/connect";
import Job, { IJob, JobStatus } from "@/lib/models/Job";

export type JobCreateInput = {
  company: string;
  role: string;
  location?: string;
  jobDescription?: string;
  url?: string;
  salary?: string;
  status?: JobStatus;
  notes?: string;
  appliedAt?: Date | null;
};

export type JobUpdateInput = {
  company?: string;
  role?: string;
  location?: string;
  jobDescription?: string;
  url?: string;
  salary?: string;
  status?: JobStatus;
  notes?: string;
  appliedAt?: Date | null;
};

export async function list(
  userId: string,
  options?: { includeDeleted?: boolean }
): Promise<IJob[]> {
  await connectDB();
  const filter: Record<string, unknown> = { userId };
  if (!options?.includeDeleted) {
    filter.deletedAt = null;
  }
  return Job.find(filter).sort({ updatedAt: -1 });
}

export async function listByStatus(
  userId: string,
  status: JobStatus
): Promise<IJob[]> {
  await connectDB();
  return Job.find({ userId, status, deletedAt: null }).sort({ updatedAt: -1 });
}

export async function getById(
  userId: string,
  jobId: string,
  options?: { includeDeleted?: boolean }
): Promise<IJob | null> {
  await connectDB();
  const filter: Record<string, unknown> = { _id: jobId, userId };
  if (!options?.includeDeleted) {
    filter.deletedAt = null;
  }
  return Job.findOne(filter);
}

export async function create(
  userId: string,
  data: JobCreateInput
): Promise<IJob> {
  await connectDB();
  return Job.create({
    userId,
    company: data.company,
    role: data.role,
    location: data.location,
    jobDescription: data.jobDescription,
    url: data.url,
    salary: data.salary,
    status: data.status ?? "saved",
    notes: data.notes,
    appliedAt: data.appliedAt ?? undefined,
    deletedAt: null,
  });
}

export async function update(
  userId: string,
  jobId: string,
  data: JobUpdateInput
): Promise<IJob | null> {
  await connectDB();
  const allowedKeys: (keyof JobUpdateInput)[] = [
    "company",
    "role",
    "location",
    "jobDescription",
    "url",
    "salary",
    "status",
    "notes",
    "appliedAt",
  ];
  const set: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in data && data[key] !== undefined) {
      set[key] = data[key];
    }
  }
  return Job.findOneAndUpdate(
    { _id: jobId, userId, deletedAt: null },
    { $set: set },
    { returnDocument: "after" }
  );
}

export async function setStatus(
  userId: string,
  jobId: string,
  status: JobStatus
): Promise<IJob | null> {
  await connectDB();
  return Job.findOneAndUpdate(
    { _id: jobId, userId, deletedAt: null },
    { $set: { status } },
    { returnDocument: "after" }
  );
}

export async function softDelete(
  userId: string,
  jobId: string
): Promise<IJob | null> {
  await connectDB();
  return Job.findOneAndUpdate(
    { _id: jobId, userId },
    { $set: { deletedAt: new Date() } },
    { returnDocument: "after" }
  );
}

export async function restore(
  userId: string,
  jobId: string
): Promise<IJob | null> {
  await connectDB();
  return Job.findOneAndUpdate(
    { _id: jobId, userId },
    { $set: { deletedAt: null } },
    { returnDocument: "after" }
  );
}
