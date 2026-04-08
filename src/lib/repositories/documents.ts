import connectDB from "@/lib/db/connect";
import Doc, { IDocument } from "@/lib/models/Document";

export async function list(
  userId: string,
  jobId?: string
): Promise<IDocument[]> {
  await connectDB();
  const filter: Record<string, unknown> = { userId };
  if (jobId) filter.jobId = jobId;
  return Doc.find(filter).sort({ createdAt: -1 });
}

export async function getLatestForJob(
  userId: string,
  jobId: string,
  type: "resume" | "cover_letter" | "jd_analysis"
): Promise<IDocument | null> {
  await connectDB();
  return Doc.findOne({ userId, jobId, type }).sort({ createdAt: -1 });
}

export async function create(
  userId: string,
  data: {
    jobId: string;
    type: string;
    content: string;
    aiModel: string;
    inputTokens?: number;
    outputTokens?: number;
    resumeIdUsed?: string;
  }
): Promise<IDocument> {
  await connectDB();
  return Doc.create({ ...data, userId });
}
