import "server-only";
import JSZip from "jszip";
import { getParagraphText } from "@/lib/export/docx-xml";

export type DocumentThemeAnalysis = {
  version: 1;
  docType: "resume" | "cover_letter";
  textParagraphCount: number;
  hasTables: boolean;
  hasDrawings: boolean;
  hasTextBoxes: boolean;
  hasMarkers: boolean;
  warnings: string[];
};

export { getParagraphText };

export function stripThemeSampleText(text: string): string {
  return text.replace(/\{\{[A-Z_]+\}\}/g, "").trim();
}

export async function analyzeDocxTheme(
  buffer: Buffer,
  docType: "resume" | "cover_letter"
): Promise<DocumentThemeAnalysis> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) {
    throw new Error("Invalid DOCX: word/document.xml not found in archive");
  }

  const docXml = await entry.async("string");
  const paragraphMatches = docXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
  const textParagraphCount = paragraphMatches.filter((p) =>
    stripThemeSampleText(getParagraphText(p))
  ).length;

  const hasTables = docXml.includes("<w:tbl");
  const hasDrawings = docXml.includes("<w:drawing") || docXml.includes("<w:pict");
  const hasTextBoxes = docXml.includes("<w:txbxContent");
  const hasMarkers = /\{\{[A-Z_]+\}\}/.test(docXml);

  const warnings: string[] = [];
  if (textParagraphCount < 4) {
    warnings.push("Theme has very few text paragraphs, so generated content may use a simpler fallback layout.");
  }
  if (hasTables) {
    warnings.push("Tables are approximated; complex table layouts may not be preserved exactly.");
  }
  if (hasDrawings) {
    warnings.push("Drawings, icons, and shapes are preserved only when they are not embedded inside replaced text paragraphs.");
  }
  if (hasTextBoxes) {
    warnings.push("Text boxes are not rewritten; text box content may remain as visual decoration only.");
  }
  if (hasMarkers) {
    warnings.push("Marker placeholders were found and will be treated as sample text, not as fill instructions.");
  }

  return {
    version: 1,
    docType,
    textParagraphCount,
    hasTables,
    hasDrawings,
    hasTextBoxes,
    hasMarkers,
    warnings,
  };
}
