import connectDB from "@/lib/db/connect";
import Resume, { IResume } from "@/lib/models/Resume";

export async function list(userId: string): Promise<IResume[]> {
  await connectDB();
  return Resume.find({ userId }).sort({ updatedAt: -1 });
}

export async function getById(
  userId: string,
  resumeId: string
): Promise<IResume | null> {
  await connectDB();
  return Resume.findOne({ _id: resumeId, userId });
}

export async function getDefault(userId: string): Promise<IResume | null> {
  await connectDB();
  return Resume.findOne({ userId, isDefault: true });
}

export async function create(
  userId: string,
  data: { title: string; content: string; isDefault?: boolean }
): Promise<IResume> {
  await connectDB();
  if (data.isDefault) {
    await Resume.updateMany({ userId }, { $set: { isDefault: false } });
  }
  return Resume.create({ userId, ...data });
}

export async function update(
  userId: string,
  resumeId: string,
  data: { title?: string; content?: string }
): Promise<IResume | null> {
  await connectDB();
  return Resume.findOneAndUpdate(
    { _id: resumeId, userId },
    { $set: data },
    { returnDocument: "after" }
  );
}

export async function setDefault(
  userId: string,
  resumeId: string
): Promise<IResume | null> {
  await connectDB();
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) return null;
  await Resume.updateMany(
    { userId, _id: { $ne: resumeId } },
    { $set: { isDefault: false } }
  );
  return Resume.findOneAndUpdate(
    { _id: resumeId, userId },
    { $set: { isDefault: true } },
    { returnDocument: "after" }
  );
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
