import connectDB from "@/lib/db/connect";
import Job, { IJob } from "@/lib/models/Job";

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
  status: string
): Promise<IJob[]> {
  await connectDB();
  return Job.find({ userId, status, deletedAt: null }).sort({ updatedAt: -1 });
}

export async function getById(
  userId: string,
  jobId: string
): Promise<IJob | null> {
  await connectDB();
  return Job.findOne({ _id: jobId, userId });
}

export async function create(
  userId: string,
  data: Partial<IJob>
): Promise<IJob> {
  await connectDB();
  return Job.create({ ...data, userId });
}

export async function update(
  userId: string,
  jobId: string,
  data: Partial<IJob>
): Promise<IJob | null> {
  await connectDB();
  return Job.findOneAndUpdate(
    { _id: jobId, userId },
    { $set: data },
    { new: true }
  );
}

export async function setStatus(
  userId: string,
  jobId: string,
  status: string
): Promise<IJob | null> {
  await connectDB();
  return Job.findOneAndUpdate(
    { _id: jobId, userId },
    { $set: { status } },
    { new: true }
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
    { new: true }
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
    { new: true }
  );
}
