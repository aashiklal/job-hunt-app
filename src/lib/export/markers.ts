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
  "JOB_TITLE", "COMPANY", "DATE_RANGE", "JOB_SUBTITLE",
  "BULLET", "PROJECT_NAME", "PROJECT_TECH_STACK",
  "DEGREE", "SCHOOL", "GRAD_DATE", "EDU_NOTES",
  "CERT", "SKILL_LINE",
] as const;

export const FIXED_COVER_LETTER_MARKERS = [
  "NAME", "DATE", "RECIPIENT", "COMPANY", "ROLE", "CLOSING",
  "BODY_PARAGRAPH",
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
  const entry = zip.file("word/document.xml");
  if (!entry) {
    throw new Error("Invalid DOCX: word/document.xml not found in archive");
  }
  const docXml = await entry.async("string");

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

  // Check for mismatched START/END delimiter pairs
  const startsSeen = new Set<string>();
  const endsSeen = new Set<string>();
  // Re-scan for delimiters only
  const delimRe = /<w:p\b[\s\S]*?<\/w:p>/g;
  let dm: RegExpExecArray | null;
  while ((dm = delimRe.exec(docXml)) !== null) {
    const t = getMergedText(dm[0]);
    for (const m of getMarkersFromText(t)) {
      for (const block of BLOCK_NAMES) {
        if (m === `START_${block}`) startsSeen.add(block);
        if (m === `END_${block}`) endsSeen.add(block);
      }
    }
  }
  for (const block of BLOCK_NAMES) {
    const hasStart = startsSeen.has(block);
    const hasEnd = endsSeen.has(block);
    if (hasStart && !hasEnd) warnings.push(`Block {{START_${block}}} has no matching {{END_${block}}}`);
    if (!hasStart && hasEnd) warnings.push(`Block {{END_${block}}} has no matching {{START_${block}}}`);
  }

  return {
    markers: Array.from(allMarkers),
    blocks: Array.from(blocks),
    warnings,
  };
}
