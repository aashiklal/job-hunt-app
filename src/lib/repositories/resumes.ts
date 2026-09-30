import connectDB from "@/lib/db/connect";
import Resume, { IResume } from "@/lib/models/Resume";

export type ResumeListItem = {
  _id: string;
  userId: string;
  title: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

function toResumeListItem(doc: IResume): ResumeListItem {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    userId: (doc.userId as unknown as { toString(): string }).toString(),
    title: doc.title,
    content: doc.content,
    isDefault: doc.isDefault,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function list(userId: string): Promise<ResumeListItem[]> {
  await connectDB();
  const docs = await Resume.find({ userId }).sort({ updatedAt: -1 });
  return docs.map(toResumeListItem);
}

export async function getById(
  userId: string,
  resumeId: string
): Promise<ResumeListItem | null> {
  await connectDB();
  const doc = await Resume.findOne({ _id: resumeId, userId });
  return doc ? toResumeListItem(doc) : null;
}

export async function getDefault(userId: string): Promise<ResumeListItem | null> {
  await connectDB();
  const doc = await Resume.findOne({ userId, isDefault: true });
  return doc ? toResumeListItem(doc) : null;
}

export async function create(
  userId: string,
  data: { title: string; content: string; isDefault?: boolean }
): Promise<ResumeListItem> {
  await connectDB();
  if (data.isDefault) {
    await Resume.updateMany({ userId }, { $set: { isDefault: false } });
  }
  const doc = await Resume.create({
    userId,
    title: data.title,
    content: data.content,
    isDefault: data.isDefault ?? false,
  });
  return toResumeListItem(doc);
}

export async function countForUser(userId: string): Promise<number> {
  await connectDB();
  return Resume.countDocuments({ userId });
}

export async function update(
  userId: string,
  resumeId: string,
  data: { title?: string; content?: string }
): Promise<ResumeListItem | null> {
  await connectDB();
  const doc = await Resume.findOneAndUpdate(
    { _id: resumeId, userId },
    { $set: data },
    { returnDocument: "after" }
  );
  return doc ? toResumeListItem(doc) : null;
}

export async function setDefault(
  userId: string,
  resumeId: string
): Promise<ResumeListItem | null> {
  await connectDB();
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) return null;
  await Resume.updateMany(
    { userId, _id: { $ne: resumeId } },
    { $set: { isDefault: false } }
  );
  const doc = await Resume.findOneAndUpdate(
    { _id: resumeId, userId },
    { $set: { isDefault: true } },
    { returnDocument: "after" }
  );
  return doc ? toResumeListItem(doc) : null;
}

export async function deleteResume(
  userId: string,
  resumeId: string
): Promise<boolean> {
  await connectDB();
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) return false;

  const wasDefault = resume.isDefault;
  await resume.deleteOne();

  if (wasDefault) {
    const next = await Resume.findOne({ userId }).sort({ updatedAt: -1 });
    if (next) {
      await Resume.findByIdAndUpdate(next._id, { $set: { isDefault: true } });
    }
  }

  return true;
}

export async function deleteAllForUser(userId: string): Promise<number> {
  await connectDB();
  const result = await Resume.deleteMany({ userId });
  return result.deletedCount ?? 0;
}
