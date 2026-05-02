import "server-only";
import { generateDOCX } from "@/lib/export/to-docx";
import { renderThemedDOCX } from "@/lib/export/render-themed-docx";
import {
  generatedDocumentSchema,
  generatedDocumentToMarkdown,
} from "@/lib/generated-documents";
import type { DocumentThemeAnalysis } from "@/lib/export/analyze-docx-theme";
import type { PixelThemeMap } from "@/lib/export/map-pixel-theme";
import type { StyleRoleMap } from "@/lib/export/map-styles-to-roles";
import { buildPixelThemeContract } from "@/lib/export/pixel-theme-contract";

export type ExportDocumentParams = {
  content: string;
  type: "resume" | "cover_letter";
  adminTemplate: {
    _id: string;
    fileData: Buffer;
    uploadedAt: Date;
    themeAnalysis?: DocumentThemeAnalysis | null;
    pixelThemeMap?: PixelThemeMap | null;
    styleRoleMap?: StyleRoleMap | null;
  } | null;
  structuredContent?: Record<string, unknown> | null;
};

export type ExportDocumentResult = {
  buffer: Buffer;
  usedTheme: boolean;
};

export async function exportDocument(
  params: ExportDocumentParams
): Promise<ExportDocumentResult> {
  const { content, adminTemplate, structuredContent } = params;
  const parsedStructured = structuredContent
    ? generatedDocumentSchema.safeParse(structuredContent)
    : null;
  const structured = parsedStructured?.success ? parsedStructured.data : null;
  const renderContent = structured ? generatedDocumentToMarkdown(structured) : content;

  if (!adminTemplate || !structured) {
    const buffer = await generateDOCX(renderContent);
    return { buffer, usedTheme: false };
  }

  const contract = buildPixelThemeContract({
    docType: structured.kind,
    themeAnalysis: adminTemplate.themeAnalysis,
    pixelThemeMap: adminTemplate.pixelThemeMap,
    styleRoleMap: adminTemplate.styleRoleMap,
  });
  const themed = await renderThemedDOCX(adminTemplate.fileData, structured, contract);
  if (themed.usedTheme) {
    return { buffer: themed.buffer, usedTheme: true };
  }

  const buffer = await generateDOCX(renderContent);
  return { buffer, usedTheme: false };
}
