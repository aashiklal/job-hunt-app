import "server-only";
import { getMergedText, getMarkersFromText, BLOCK_NAMES, type BlockName } from "@/lib/export/markers";
import { setParaText, loadTemplate } from "@/lib/export/from-template";
import type { ResumeTemplateData, CoverLetterTemplateData } from "@/lib/export/template-data";

// ─── Marker → data field mapping ─────────────────────────────────────────────

function resolveFixedMarker(
  marker: string,
  data: ResumeTemplateData | CoverLetterTemplateData
): string | null {
  if ("experience" in data) {
    const r = data as ResumeTemplateData;
    const map: Record<string, string | null | undefined> = {
      NAME: r.name,
      LOCATION: r.location,
      PHONE: r.phone,
      EMAIL: r.email,
      LINKEDIN: r.linkedin,
      GITHUB: r.github,
      WEBSITE: r.website,
      WORK_RIGHTS: r.workRights,
      SUMMARY: r.summary,
      FOOTER: r.footer,
    };
    return marker in map ? (map[marker] ?? null) : null;
  } else {
    const c = data as CoverLetterTemplateData;
    const map: Record<string, string | null | undefined> = {
      NAME: c.name,
      DATE: c.date,
      RECIPIENT: c.recipient,
      COMPANY: c.company,
      ROLE: c.role,
      CLOSING: c.closing,
    };
    return marker in map ? (map[marker] ?? null) : null;
  }
}

type BlockItem = Record<string, string | string[] | null | undefined>;

function resolveBlockMarker(marker: string, item: BlockItem): string | string[] | null {
  const val = item[markerToCamel(marker)];
  return val !== undefined ? (val as string | string[] | null) : null;
}

function markerToCamel(marker: string): string {
  return marker
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function getBlockItems(
  block: BlockName,
  data: ResumeTemplateData | CoverLetterTemplateData
): BlockItem[] {
  if (!("experience" in data)) return [];
  const r = data as ResumeTemplateData;
  switch (block) {
    case "EXPERIENCE":     return r.experience as unknown as BlockItem[];
    case "PROJECTS":       return r.projects as unknown as BlockItem[];
    case "EDUCATION":      return r.education as unknown as BlockItem[];
    case "CERTIFICATIONS": return r.certifications.map((c) => ({ cert: c }));
    case "SKILLS":         return r.skills as unknown as BlockItem[];
    default:               return [];
  }
}

function resolveParaText(
  text: string,
  resolve: (marker: string) => string | null
): string | null {
  const markers = getMarkersFromText(text);
  if (markers.length === 0) return text;

  let result = text;
  for (const marker of markers) {
    const value = resolve(marker);
    if (value === null) return null;
    result = result.replace(`{{${marker}}}`, value);
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fillTemplate(
  templateBuffer: Buffer,
  data: ResumeTemplateData | CoverLetterTemplateData,
  _type: "resume" | "cover_letter"
): Promise<Buffer> {
  const { zip, paragraphs, header, sectPrParas, directSectPr } =
    await loadTemplate(templateBuffer);

  const outputXmls: string[] = [];
  let i = 0;

  while (i < paragraphs.length) {
    const para = paragraphs[i];
    if (para.hasSectPr) { i++; continue; }

    const text = getMergedText(para.xml);
    const markers = getMarkersFromText(text);

    // ── Delimiter: START_X ────────────────────────────────────────────────────
    const startMarker = markers.find((m) => m.startsWith("START_"));
    if (startMarker) {
      const blockName = startMarker.replace("START_", "") as BlockName;
      const endMarker = `END_${blockName}`;

      const blockTemplate: typeof paragraphs = [];
      i++;
      while (i < paragraphs.length) {
        const bp = paragraphs[i];
        const bt = getMergedText(bp.xml);
        if (getMarkersFromText(bt).includes(endMarker)) { i++; break; }
        blockTemplate.push(bp);
        i++;
      }

      const items = getBlockItems(blockName, data);
      for (const item of items) {
        for (const bpara of blockTemplate) {
          const btext = getMergedText(bpara.xml);
          const bmarkers = getMarkersFromText(btext);

          if (bmarkers.includes("BULLET")) {
            const bullets = (item["bullets"] as string[] | undefined) ?? [];
            for (const bullet of bullets) {
              const resolved = btext.replace("{{BULLET}}", bullet);
              outputXmls.push(setParaText(bpara.xml, resolved));
            }
            continue;
          }

          if (bmarkers.includes("BODY_PARAGRAPH")) {
            const paras =
              "bodyParagraphs" in data
                ? (data as CoverLetterTemplateData).bodyParagraphs
                : [];
            for (const p of paras) {
              outputXmls.push(setParaText(bpara.xml, p));
            }
            continue;
          }

          const resolved = resolveParaText(btext, (m) => resolveBlockMarker(m, item) as string | null);
          if (resolved !== null) {
            outputXmls.push(setParaText(bpara.xml, resolved));
          }
        }
      }
      continue;
    }

    // ── Fixed marker paragraph ────────────────────────────────────────────────
    if (markers.length > 0) {
      const resolved = resolveParaText(text, (m) => resolveFixedMarker(m, data));
      if (resolved !== null) {
        outputXmls.push(setParaText(para.xml, resolved));
      }
      i++;
      continue;
    }

    // ── Static paragraph (no markers) ────────────────────────────────────────
    outputXmls.push(para.xml);
    i++;
  }

  const docXml = [
    header,
    outputXmls.join("\n"),
    sectPrParas,
    directSectPr,
    "</w:body>",
    "</w:document>",
  ]
    .filter(Boolean)
    .join("\n");

  zip.file("word/document.xml", docXml);

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  }) as Promise<Buffer>;
}
