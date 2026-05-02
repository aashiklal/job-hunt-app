import "server-only";
import JSZip from "jszip";
import { getParagraphText } from "@/lib/export/analyze-docx-theme";
import { getParagraphXmls } from "@/lib/export/docx-xml";

export type DocxTextRegion = {
  id: string;
  partName: string;
  paragraphIndex: number;
  text: string;
  inHeader: boolean;
  inFooter: boolean;
  inTable: boolean;
  inTextBox: boolean;
  hasDrawing: boolean;
};

export type DocxStructure = {
  regions: DocxTextRegion[];
  warnings: string[];
};

function isSupportedPart(name: string): boolean {
  return (
    name === "word/document.xml" ||
    /^word\/header\d+\.xml$/.test(name) ||
    /^word\/footer\d+\.xml$/.test(name)
  );
}

function partKind(name: string) {
  return {
    inHeader: /^word\/header\d+\.xml$/.test(name),
    inFooter: /^word\/footer\d+\.xml$/.test(name),
  };
}

export { getParagraphXmls };

export async function extractDocxStructure(buffer: Buffer): Promise<DocxStructure> {
  const zip = await JSZip.loadAsync(buffer);
  const warnings: string[] = [];
  const regions: DocxTextRegion[] = [];

  const partNames = Object.keys(zip.files).filter(isSupportedPart).sort((a, b) => {
    if (a === "word/document.xml") return -1;
    if (b === "word/document.xml") return 1;
    return a.localeCompare(b);
  });

  for (const partName of partNames) {
    const entry = zip.file(partName);
    if (!entry) continue;

    const xml = await entry.async("string");
    const paragraphs = getParagraphXmls(xml);
    const kind = partKind(partName);

    paragraphs.forEach((paragraphXml, paragraphIndex) => {
      const text = getParagraphText(paragraphXml).replace(/\{\{[A-Z_]+\}\}/g, "").trim();
      if (!text) return;
      regions.push({
        id: `${partName}#${paragraphIndex}`,
        partName,
        paragraphIndex,
        text,
        inHeader: kind.inHeader,
        inFooter: kind.inFooter,
        inTable: paragraphXml.includes("<w:tc"),
        inTextBox: paragraphXml.includes("<w:txbxContent"),
        hasDrawing: paragraphXml.includes("<w:drawing") || paragraphXml.includes("<w:pict"),
      });
    });

    if (xml.includes("<w:txbxContent")) {
      warnings.push(`${partName} contains text boxes; text replacement may be partial.`);
    }
    if (xml.includes("<w:drawing") || xml.includes("<w:pict")) {
      warnings.push(`${partName} contains drawings or shapes; visual elements are preserved where possible.`);
    }
  }

  if (!regions.length) {
    warnings.push("No editable text regions were found in the DOCX.");
  }

  return { regions, warnings };
}
