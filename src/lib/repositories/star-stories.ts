import connectDB from "@/lib/db/connect";
import StarStory, { IStarStory } from "@/lib/models/StarStory";

export type StarStoryItem = {
  _id: string;
  userId: string;
  title: string;
  tags: string[];
  roughDraft: string;
  polishedOutput: string | null;
  maxWords: number | null;
  createdAt: string;
  updatedAt: string;
};

function toStarStoryItem(doc: IStarStory): StarStoryItem {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    userId: (doc.userId as unknown as { toString(): string }).toString(),
    title: doc.title,
    tags: doc.tags,
    roughDraft: doc.roughDraft,
    polishedOutput: doc.polishedOutput ?? null,
    maxWords: doc.maxWords ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function list(userId: string): Promise<StarStoryItem[]> {
  await connectDB();
  const docs = await StarStory.find({ userId }).sort({ createdAt: -1 });
  return docs.map(toStarStoryItem);
}

export async function getById(
  userId: string,
  id: string
): Promise<StarStoryItem | null> {
  await connectDB();
  const doc = await StarStory.findOne({ _id: id, userId });
  return doc ? toStarStoryItem(doc) : null;
}

export async function create(
  userId: string,
  data: { title: string; tags: string[]; roughDraft: string; maxWords?: number }
): Promise<StarStoryItem> {
  await connectDB();
  const doc = await StarStory.create({
    userId,
    title: data.title,
    tags: data.tags,
    roughDraft: data.roughDraft,
    ...(data.maxWords !== undefined ? { maxWords: data.maxWords } : {}),
  });
  return toStarStoryItem(doc);
}

export async function update(
  userId: string,
  id: string,
  data: { title?: string; tags?: string[]; roughDraft?: string; maxWords?: number }
): Promise<StarStoryItem | null> {
  await connectDB();
  const doc = await StarStory.findOneAndUpdate(
    { _id: id, userId },
    { $set: data },
    { returnDocument: "after" }
  );
  return doc ? toStarStoryItem(doc) : null;
}

export async function savePolished(
  userId: string,
  id: string,
  polishedOutput: string
): Promise<StarStoryItem | null> {
  await connectDB();
  const doc = await StarStory.findOneAndUpdate(
    { _id: id, userId },
    { $set: { polishedOutput } },
    { returnDocument: "after" }
  );
  return doc ? toStarStoryItem(doc) : null;
}

export async function deleteStory(userId: string, id: string): Promise<boolean> {
  await connectDB();
  const doc = await StarStory.findOneAndDelete({ _id: id, userId });
  return doc !== null;
}

export async function countForUser(userId: string): Promise<number> {
  await connectDB();
  return StarStory.countDocuments({ userId });
}

export async function deleteAllForUser(userId: string): Promise<number> {
  await connectDB();
  const result = await StarStory.deleteMany({ userId });
  return result.deletedCount ?? 0;
}
