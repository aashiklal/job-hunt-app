import "server-only";
import * as documents from "@/lib/repositories/documents";
import { applyToTemplate, injectContent } from "@/lib/export/from-template";
import { generateDOCX } from "@/lib/export/to-docx";
import { fillTemplate } from "@/lib/export/template-fill";
import type { ResumeTemplateData, CoverLetterTemplateData } from "@/lib/export/template-data";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export type ExportDocumentParams = {
  content: string;
  type: "resume" | "cover_letter";
  docId?: string | null;
  adminTemplate: { _id: string; fileData: Buffer; uploadedAt: Date } | null;
  templateData?: Record<string, unknown> | null;
};

export type ExportDocumentResult = {
  buffer: Buffer;
  aiUsage?: { model: string; inputTokens: number; outputTokens: number };
};

export async function exportDocument(
  params: ExportDocumentParams
): Promise<ExportDocumentResult> {
  const { content, type, docId, adminTemplate, templateData } = params;

  // Path 1: No template — generic DOCX, no AI
  if (!adminTemplate) {
    const buffer = await generateDOCX(content);
    return { buffer };
  }

  // Path 2: Template + precomputed structured data — deterministic fill, no AI
  if (templateData) {
    const data = templateData as ResumeTemplateData | CoverLetterTemplateData;
    const buffer = await fillTemplate(adminTemplate.fileData, data, type);
    return { buffer };
  }

  // Path 3: Template + valid slot-fill cache — apply without AI (backwards compat)
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

  // Path 4: Template + cache miss — call AI (Haiku)
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
