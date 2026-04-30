import "server-only";
import * as documents from "@/lib/repositories/documents";
import { applyToTemplate, injectContent } from "@/lib/export/from-template";
import { generateDOCX } from "@/lib/export/to-docx";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export type ExportDocumentParams = {
  content: string;
  type: "resume" | "cover_letter";
  docId?: string | null;
  adminTemplate: { _id: string; fileData: Buffer; uploadedAt: Date } | null;
};

export type ExportDocumentResult = {
  buffer: Buffer;
  aiUsage?: { model: string; inputTokens: number; outputTokens: number };
};

export async function exportDocument(
  params: ExportDocumentParams
): Promise<ExportDocumentResult> {
  const { content, type, docId, adminTemplate } = params;

  // Path 1: No template — generic DOCX, no AI
  if (!adminTemplate) {
    const buffer = await generateDOCX(content);
    return { buffer };
  }

  // Path 2: Template + valid cache — apply without AI
  if (docId) {
    const cachedOutput = await documents.getValidDocxCache(
      docId,
      adminTemplate._id,
      adminTemplate.uploadedAt
    );
    if (cachedOutput) {
      const buffer = await applyToTemplate(adminTemplate.fileData, cachedOutput);
      return { buffer };
    }
  }

  // Path 3: Template + cache miss — call AI (Haiku)
  const result = await injectContent(adminTemplate.fileData, content, type);
  return {
    buffer: result.buffer,
    aiUsage: {
      model: HAIKU_MODEL,
      inputTokens: result.inputTokens ?? 0,
      outputTokens: result.outputTokens ?? 0,
    },
  };
}
