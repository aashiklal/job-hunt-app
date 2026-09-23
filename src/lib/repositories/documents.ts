import connectDB from "@/lib/db/connect";
import Doc, { IDocument, DocumentType } from "@/lib/models/Document";

export type { DocumentType };

export type DocItem = {
  _id: string;
  userId: string;
  jobId: string;
  type: DocumentType;
  content: string;
  structuredContent?: Record<string, unknown>;
  aiModel: string;
  inputTokens?: number;
  outputTokens?: number;
  resumeIdUsed?: string;
  createdAt: string;
  updatedAt: string;
};

function toDocItem(doc: IDocument): DocItem {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    userId: (doc.userId as unknown as { toString(): string }).toString(),
    jobId: (doc.jobId as unknown as { toString(): string }).toString(),
    type: doc.type,
    content: doc.content,
    structuredContent: doc.structuredContent,
    aiModel: doc.aiModel,
    inputTokens: doc.inputTokens,
    outputTokens: doc.outputTokens,
    resumeIdUsed: doc.resumeIdUsed
      ? (doc.resumeIdUsed as unknown as { toString(): string }).toString()
      : undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export type CreateDocumentInput = {
  jobId: string;
  type: DocumentType;
  content: string;
  structuredContent?: Record<string, unknown>;
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
): Promise<DocItem[]> {
  await connectDB();
  const filter: Record<string, unknown> = { userId };
  if (jobId) filter.jobId = jobId;
  const docs = await Doc.find(filter).sort({ createdAt: -1 });
  return docs.map(toDocItem);
}

export async function getLatestForJob(
  userId: string,
  jobId: string,
  type: DocumentType
): Promise<DocItem | null> {
  await connectDB();
  const doc = await Doc.findOne({ userId, jobId, type }).sort({ createdAt: -1 });
  return doc ? toDocItem(doc) : null;
}

export async function getById(
  userId: string,
  documentId: string
): Promise<DocItem | null> {
  await connectDB();
  const doc = await Doc.findOne({ _id: documentId, userId });
  return doc ? toDocItem(doc) : null;
}

export async function upsert(
  userId: string,
  data: CreateDocumentInput
): Promise<DocItem> {
  await connectDB();
  const doc = await Doc.findOneAndUpdate(
    { userId, jobId: data.jobId, type: data.type },
    {
      $set: {
        content: data.content,
        structuredContent: data.structuredContent,
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
  ) as IDocument;
  return toDocItem(doc);
}

export type LatexCacheFields = {
  latexBodyCache: string | null;
  latexBodyCachedAt: Date | null;
};

export async function getLatexCache(
  userId: string,
  documentId: string
): Promise<LatexCacheFields | null> {
  await connectDB();
  const doc = await Doc.findOne({ _id: documentId, userId }, {
    latexBodyCache: 1,
    latexBodyCachedAt: 1,
  });
  if (!doc) return null;
  return {
    latexBodyCache: doc.latexBodyCache ?? null,
    latexBodyCachedAt: doc.latexBodyCachedAt ?? null,
  };
}

export async function setLatexCache(
  userId: string,
  documentId: string,
  body: string
): Promise<void> {
  await connectDB();
  await Doc.findOneAndUpdate(
    { _id: documentId, userId },
    {
      $set: {
        latexBodyCache: body,
        latexBodyCachedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );
}

export async function listByType(
  userId: string,
  type: DocumentType
): Promise<DocItem[]> {
  await connectDB();
  const docs = await Doc.find({ userId, type }).sort({ createdAt: -1 });
  return docs.map(toDocItem);
}

export async function deleteAllForUser(userId: string): Promise<number> {
  await connectDB();
  const result = await Doc.deleteMany({ userId });
  return result.deletedCount ?? 0;
}
