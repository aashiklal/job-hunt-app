import "server-only";
import JSZip from "jszip";
import { DEFAULT_STYLE_HINTS, type StyleHints } from "./types";

// Pull the first w:ascii font name out of a block of XML
function extractFont(xml: string): string | null {
  return /<w:rFonts[^>]*w:ascii="([^"]+)"/i.exec(xml)?.[1] ?? null;
}

// Pull the first w:sz half-point value and return it converted to points
function extractSizePt(xml: string): number | null {
  const val = /<w:sz w:val="(\d+)"/i.exec(xml)?.[1];
  return val ? parseInt(val) / 2 : null;
}

// Pull a 6-hex-digit color value (no #)
function extractColor(xml: string): string | null {
  return /<w:color w:val="([0-9A-Fa-f]{6})"/i.exec(xml)?.[1]?.toUpperCase() ?? null;
}

// Extract the XML block for a named style
function styleBlock(stylesXml: string, styleId: string): string {
  const re = new RegExp(
    `<w:style\\s[^>]*w:styleId="${styleId}"[^>]*>[\\s\\S]*?</w:style>`,
    "i"
  );
  return re.exec(stylesXml)?.[0] ?? "";
}

// Convert EMUs/twips to points (DOCX page margins are in twentieths of a point)
function twipsToPt(twips: number): number {
  return Math.round((twips / 20) * 10) / 10;
}

export async function extractDocxStyles(buffer: Buffer): Promise<StyleHints> {
  try {
    const zip = await JSZip.loadAsync(buffer);

    const stylesEntry = zip.file("word/styles.xml");
    const documentEntry = zip.file("word/document.xml");
    if (!stylesEntry) return DEFAULT_STYLE_HINTS;

    const stylesXml = await stylesEntry.async("string");
    const documentXml = documentEntry ? await documentEntry.async("string") : "";

    // Document defaults — font and size that apply when a style doesn't override
    const defaultsBlock =
      /<w:docDefaults>[\s\S]*?<\/w:docDefaults>/i.exec(stylesXml)?.[0] ?? "";
    const bodyFont = extractFont(defaultsBlock) ?? "Calibri";
    const bodySizePt = extractSizePt(defaultsBlock) ?? 11;

    // Heading styles — try both capitalisation variants Word produces
    function getHeading(id: string, altId: string) {
      const block = styleBlock(stylesXml, id) || styleBlock(stylesXml, altId);
      return {
        font: extractFont(block) ?? bodyFont,
        sizePt: extractSizePt(block),
        color: extractColor(block) ?? "000000",
      };
    }

    const h1 = getHeading("Heading1", "1");
    const h2 = getHeading("Heading2", "2");
    const h3 = getHeading("Heading3", "3");

    // Page margins from the last <w:pgMar .../> in document.xml
    // (the last match is typically the main document body section)
    let marginTopPt = 72;
    let marginBottomPt = 72;
    let marginLeftPt = 72;
    let marginRightPt = 72;

    const pgMarRe = /<w:pgMar\s[^/]*\/>/gi;
    let pgMarMatch: RegExpExecArray | null;
    let lastPgMar = "";
    while ((pgMarMatch = pgMarRe.exec(documentXml)) !== null) {
      lastPgMar = pgMarMatch[0];
    }
    if (lastPgMar) {
      const top = /w:top="(\d+)"/.exec(lastPgMar)?.[1];
      const bottom = /w:bottom="(\d+)"/.exec(lastPgMar)?.[1];
      const left = /w:left="(\d+)"/.exec(lastPgMar)?.[1];
      const right = /w:right="(\d+)"/.exec(lastPgMar)?.[1];
      if (top) marginTopPt = twipsToPt(parseInt(top));
      if (bottom) marginBottomPt = twipsToPt(parseInt(bottom));
      if (left) marginLeftPt = twipsToPt(parseInt(left));
      if (right) marginRightPt = twipsToPt(parseInt(right));
    }

    return {
      bodyFont,
      bodyFontSizePt: bodySizePt,
      h1Font: h1.font,
      h1SizePt: h1.sizePt ?? 20,
      h1Color: h1.color,
      h2Font: h2.font,
      h2SizePt: h2.sizePt ?? 14,
      h2Color: h2.color,
      h3Font: h3.font,
      h3SizePt: h3.sizePt ?? bodySizePt + 1,
      h3Color: h3.color,
      marginTopPt,
      marginBottomPt,
      marginLeftPt,
      marginRightPt,
    };
  } catch (err) {
    console.warn("[extract-styles] failed to extract DOCX styles, using defaults:", err);
    return DEFAULT_STYLE_HINTS;
  }
}
