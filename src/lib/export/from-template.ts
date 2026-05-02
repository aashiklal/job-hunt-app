import "server-only";
import JSZip from "jszip";
import { cloneParagraphWithText, extractParagraphs } from "@/lib/export/docx-xml";

/**
 * Replace a template paragraph's text while preserving its run formatting.
 *
 * The template's run structure is the source of truth for styling — we never
 * hard-code bold, color, or any other property. Instead:
 *
 * - 1 template run  → single replacement run with the same rPr
 * - 2+ template runs, text has a date at the end (h3 job-title pattern)
 *     → run[0].rPr for the title, run[last].rPr for the date (right-aligned)
 * - 2+ template runs, text has "Label: value" (skill-line pattern)
 *     → run[0].rPr for the label, run[last].rPr for the value
 * - 2+ template runs, no pattern matched → all text into run[0].rPr
 */
export function setParaText(paraXml: string, newText: string): string {
  return cloneParagraphWithText(paraXml, newText);
}

// ─── ZIP helpers ──────────────────────────────────────────────────────────────

export async function loadTemplate(templateBuffer: Buffer) {
  const zip = await JSZip.loadAsync(templateBuffer);
  const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const paragraphs = extractParagraphs(docXml);

  const bodyOpenIdx = docXml.indexOf("<w:body>");
  const header =
    bodyOpenIdx >= 0
      ? docXml.slice(0, bodyOpenIdx + "<w:body>".length)
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`;

  const sectPrParas = paragraphs
    .filter((p) => p.hasSectPr)
    .map((p) => p.xml)
    .join("\n");

  let directSectPr = "";
  if (!paragraphs.some((p) => p.hasSectPr)) {
    const re = /<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>|<w:sectPr(?:\s[^>]*)?\/>/g;
    let sm: RegExpExecArray | null;
    while ((sm = re.exec(docXml)) !== null) directSectPr = sm[0];
  }

  return { zip, paragraphs, header, sectPrParas, directSectPr };
}
