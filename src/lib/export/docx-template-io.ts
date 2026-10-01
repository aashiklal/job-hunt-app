import "server-only";
import JSZip from "jszip";
import { cloneParagraphWithText, extractParagraphs } from "@/lib/export/docx-xml";

/**
 * Reading a DOCX template and writing text into its paragraphs, shared by the
 * themed renderer (render-themed-docx.ts) and the style-based builder
 * (build-from-styles.ts).
 *
 * Replaces a template paragraph's text while keeping its run formatting. The
 * run-splitting rules (title and date, "Label: value" lines) live in
 * cloneParagraphWithText in docx-xml.ts.
 */
export function setParaText(paraXml: string, newText: string): string {
  return cloneParagraphWithText(paraXml, newText);
}

// ZIP helpers

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
