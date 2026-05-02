import "server-only";
import JSZip from "jszip";
import { getParagraphText } from "@/lib/export/analyze-docx-theme";
import { getParagraphXmls } from "@/lib/export/extract-docx-structure";

export type DocxParagraphStyle = {
  styleId: string;
  name: string;
  basedOn: string | null;
  next: string | null;
  isDefault: boolean;
  summary: {
    bold: boolean;
    italic: boolean;
    allCaps: boolean;
    underline: boolean;
    color: string | null;
    fontSizeHalfPoints: number | null;
    fontFamily: string | null;
    spacingBefore: string | null;
    spacingAfter: string | null;
    lineSpacing: string | null;
    leftIndent: string | null;
    hangingIndent: string | null;
    hasNumbering: boolean;
    justification: string | null;
  };
};

export type DocxStyleSample = {
  text: string;
  styleId: string | null;
};

export type DocxStyleCatalog = {
  version: 1;
  styles: DocxParagraphStyle[];
  samples: DocxStyleSample[];
  warnings: string[];
};

function attr(xml: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]+)"`).exec(xml);
  return match?.[1] ?? null;
}

function tagAttr(xml: string, tag: string, name = "w:val"): string | null {
  const match = new RegExp(`<${tag}\\b([^>]*)\\/?>`).exec(xml);
  return match ? attr(match[1], name) : null;
}

function hasTag(xml: string, tag: string): boolean {
  return new RegExp(`<${tag}\\b`).test(xml);
}

function styleBlocks(stylesXml: string): string[] {
  return stylesXml.match(/<w:style\b[\s\S]*?<\/w:style>/g) ?? [];
}

function paragraphStyleId(paragraphXml: string): string | null {
  return tagAttr(paragraphXml, "w:pStyle");
}

function parseStyle(styleXml: string): DocxParagraphStyle | null {
  const openTag = /^<w:style\b([^>]*)>/.exec(styleXml)?.[1] ?? "";
  if (attr(openTag, "w:type") !== "paragraph") return null;

  const styleId = attr(openTag, "w:styleId");
  if (!styleId) return null;

  const fontSizeRaw = tagAttr(styleXml, "w:sz") ?? tagAttr(styleXml, "w:szCs");
  const leftIndent = tagAttr(styleXml, "w:ind", "w:left");
  const hangingIndent = tagAttr(styleXml, "w:ind", "w:hanging");

  return {
    styleId,
    name: tagAttr(styleXml, "w:name") ?? styleId,
    basedOn: tagAttr(styleXml, "w:basedOn"),
    next: tagAttr(styleXml, "w:next"),
    isDefault: attr(openTag, "w:default") === "1",
    summary: {
      bold: hasTag(styleXml, "w:b"),
      italic: hasTag(styleXml, "w:i"),
      allCaps: hasTag(styleXml, "w:caps"),
      underline: hasTag(styleXml, "w:u"),
      color: tagAttr(styleXml, "w:color"),
      fontSizeHalfPoints: fontSizeRaw ? Number.parseInt(fontSizeRaw, 10) : null,
      fontFamily:
        tagAttr(styleXml, "w:rFonts", "w:ascii") ??
        tagAttr(styleXml, "w:rFonts", "w:hAnsi"),
      spacingBefore: tagAttr(styleXml, "w:spacing", "w:before"),
      spacingAfter: tagAttr(styleXml, "w:spacing", "w:after"),
      lineSpacing: tagAttr(styleXml, "w:spacing", "w:line"),
      leftIndent,
      hangingIndent,
      hasNumbering: hasTag(styleXml, "w:numPr"),
      justification: tagAttr(styleXml, "w:jc"),
    },
  };
}

export async function extractDocxStyles(buffer: Buffer): Promise<DocxStyleCatalog> {
  const zip = await JSZip.loadAsync(buffer);
  const stylesXml = await zip.file("word/styles.xml")?.async("string");
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const warnings: string[] = [];

  if (!stylesXml) {
    warnings.push("word/styles.xml not found; style-based rendering cannot run.");
  }

  const styles = stylesXml
    ? styleBlocks(stylesXml)
        .map(parseStyle)
        .filter((style): style is DocxParagraphStyle => Boolean(style))
    : [];

  const samples = (documentXml ? getParagraphXmls(documentXml) : [])
    .map((paragraphXml) => ({
      text: getParagraphText(paragraphXml).replace(/\{\{[A-Z_]+\}\}/g, "").trim(),
      styleId: paragraphStyleId(paragraphXml),
    }))
    .filter((sample) => sample.text.length > 0)
    .slice(0, 80);

  if (!styles.length) {
    warnings.push("No paragraph styles found in word/styles.xml.");
  }
  if (!samples.length) {
    warnings.push("No sample paragraphs found in word/document.xml.");
  }

  return {
    version: 1,
    styles,
    samples,
    warnings,
  };
}
