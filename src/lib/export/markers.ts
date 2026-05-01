import "server-only";
import JSZip from "jszip";

// Known block section names — must match START_X / END_X markers in templates
export const BLOCK_NAMES = [
  "EXPERIENCE",
  "PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS",
  "SKILLS",
] as const;
export type BlockName = (typeof BLOCK_NAMES)[number];

export const FIXED_RESUME_MARKERS = [
  "NAME", "LOCATION", "PHONE", "EMAIL", "LINKEDIN",
  "GITHUB", "WEBSITE", "WORK_RIGHTS", "SUMMARY", "FOOTER",
] as const;

export const FIXED_COVER_LETTER_MARKERS = [
  "NAME", "DATE", "RECIPIENT", "COMPANY", "ROLE", "CLOSING",
] as const;

const CRITICAL_RESUME_MARKERS = ["NAME", "SUMMARY", "BULLET"];
const CRITICAL_COVER_LETTER_MARKERS = ["NAME", "BODY_PARAGRAPH"];

export type TemplateStructure = {
  markers: string[];
  blocks: BlockName[];
  warnings: string[];
};

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function getMergedText(paraXml: string): string {
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(paraXml)) !== null) parts.push(m[1]);
  return decodeXmlEntities(parts.join(""));
}

export function getMarkersFromText(text: string): string[] {
  const markers: string[] = [];
  const re = /\{\{([A-Z_]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) markers.push(m[1]);
  return markers;
}

export async function detectMarkers(
  buffer: Buffer,
  docType: "resume" | "cover_letter"
): Promise<TemplateStructure> {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";

  const paraRe = /<w:p\b[\s\S]*?<\/w:p>/g;
  const allMarkers = new Set<string>();
  const blocks = new Set<BlockName>();

  let pm: RegExpExecArray | null;
  while ((pm = paraRe.exec(docXml)) !== null) {
    const text = getMergedText(pm[0]);
    const found = getMarkersFromText(text);
    for (const marker of found) {
      for (const block of BLOCK_NAMES) {
        if (marker === `START_${block}` || marker === `END_${block}`) {
          blocks.add(block);
          break;
        }
      }
      if (!marker.startsWith("START_") && !marker.startsWith("END_")) {
        allMarkers.add(marker);
      }
    }
  }

  const criticalMarkers =
    docType === "resume" ? CRITICAL_RESUME_MARKERS : CRITICAL_COVER_LETTER_MARKERS;

  const warnings = criticalMarkers
    .filter((m) => !allMarkers.has(m))
    .map((m) => `Missing critical marker: {{${m}}}`);

  return {
    markers: Array.from(allMarkers),
    blocks: Array.from(blocks),
    warnings,
  };
}
