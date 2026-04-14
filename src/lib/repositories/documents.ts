import connectDB from "@/lib/db/connect";
import Doc, { IDocument, DocumentType } from "@/lib/models/Document";

export type { DocumentType };

export type CreateDocumentInput = {
  jobId: string;
  type: DocumentType;
  content: string;
  aiModel: string;
  inputTokens?: number;
  outputTokens?: number;
  resumeIdUsed?: string;
};

export async function countAll(): Promise<number> {
  await connectDB();
  return Doc.countDocuments({});
}

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
  type: DocumentType
): Promise<IDocument | null> {
  await connectDB();
  return Doc.findOne({ userId, jobId, type }).sort({ createdAt: -1 });
}

export async function setDocxCache(
  docId: string,
  templateId: string,
  output: Array<[number, string | null]>
): Promise<void> {
  await connectDB();
  await Doc.findByIdAndUpdate(docId, {
    $set: {
      docxSlotCache: { templateId, cachedAt: new Date(), output },
    },
  });
}

export async function upsert(
  userId: string,
  data: CreateDocumentInput
): Promise<IDocument> {
  await connectDB();
  return Doc.findOneAndUpdate(
    { userId, jobId: data.jobId, type: data.type },
    {
      $set: {
        content: data.content,
        aiModel: data.aiModel,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        resumeIdUsed: data.resumeIdUsed,
      },
      $setOnInsert: {
        userId,
        jobId: data.jobId,
        type: data.type,
      },
    },
    { upsert: true, returnDocument: "after" }
  ) as Promise<IDocument>;
}
