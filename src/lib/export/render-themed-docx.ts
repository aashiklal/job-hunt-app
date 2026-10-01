import "server-only";
import type { GeneratedDocument } from "@/lib/generated-documents";
import { generatedDocumentBlocks } from "@/lib/generated-document-blocks";
import { extractDocxStructure, getParagraphXmls, type DocxTextRegion } from "@/lib/export/extract-docx-structure";
import { buildDOCXFromStyles } from "@/lib/export/build-from-styles";
import { loadTemplate, setParaText } from "@/lib/export/docx-template-io";
import { buildFallbackPixelThemeMap, type PixelThemeMap, type PixelThemeRegionRole } from "@/lib/export/map-pixel-theme";
import type { PixelThemeContract } from "@/lib/export/pixel-theme-contract";

type RenderResult = {
  buffer: Buffer;
  usedTheme: boolean;
};

export async function renderThemedDOCX(
  templateBuffer: Buffer,
  doc: GeneratedDocument,
  contract?: PixelThemeContract | null
): Promise<RenderResult> {
  const styled = await buildDOCXFromStyles(templateBuffer, doc, contract);
  if (styled.usedTheme) return styled;

  const structure = await extractDocxStructure(templateBuffer);
  const map =
    contract?.pixelThemeMap && contract.pixelThemeMap.docType === doc.kind
      ? contract.pixelThemeMap
      : buildFallbackPixelThemeMap(structure, doc.kind);

  const mapped = await renderMappedPixelTheme(templateBuffer, doc, structure.regions, map);
  if (mapped.usedTheme) return mapped;

  return { buffer: Buffer.alloc(0), usedTheme: false };
}

type RoleQueues = Partial<Record<PixelThemeRegionRole, string[]>>;
type RoleCounts = Partial<Record<PixelThemeRegionRole, number>>;

function push(queue: RoleQueues, role: PixelThemeRegionRole, values: Array<string | null | undefined>) {
  queue[role] = [...(queue[role] ?? []), ...values.filter((value): value is string => Boolean(value?.trim()))];
}

function buildRoleQueues(doc: GeneratedDocument, roleCounts: RoleCounts): RoleQueues {
  const queues: RoleQueues = {};
  const blocks = generatedDocumentBlocks(doc);
  const contactFields = blocks
    .filter((block) => block.role === "applicant_contact")
    .map((block) => block.text);

  for (const block of blocks) {
    if (block.role === "applicant_contact") continue;
    push(queues, block.role, [block.text]);
  }

  push(
    queues,
    "applicant_contact",
    (roleCounts.applicant_contact ?? 0) > 1 ? contactFields : [contactFields.join("\n")]
  );
  return queues;
}

const REUSABLE_ROLES = new Set<PixelThemeRegionRole>([
  "applicant_name",
  "date",
  "recipient",
  "company",
  "role",
  "salutation",
  "closing",
  "signoff",
  "footer",
]);

function nextValue(queues: RoleQueues, role: PixelThemeRegionRole): string | null {
  const values = queues[role] ?? [];
  if (REUSABLE_ROLES.has(role)) {
    return values[0] ?? null;
  }
  const next = values.shift();
  queues[role] = values;
  return next ?? null;
}

function fallbackValueForRole(queues: RoleQueues, role: PixelThemeRegionRole): string | null {
  if (role === "body_paragraph") return nextValue(queues, "body_paragraph");
  if (role === "bullet") return nextValue(queues, "bullet");
  return null;
}

function replaceParagraphAt(xml: string, paragraphIndex: number, newParagraphXml: string): string {
  let index = 0;
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    if (index === paragraphIndex) {
      index++;
      return newParagraphXml;
    }
    index++;
    return paragraphXml;
  });
}

function insertBeforeSectPr(xml: string, paragraphXmls: string[]): string {
  if (!paragraphXmls.length) return xml;
  const insert = paragraphXmls.join("\n");
  const sectPrMatch = /<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>|<w:sectPr(?:\s[^>]*)?\/>/.exec(xml);
  if (!sectPrMatch) {
    return xml.replace("</w:body>", `${insert}\n</w:body>`);
  }
  return `${xml.slice(0, sectPrMatch.index)}${insert}\n${xml.slice(sectPrMatch.index)}`;
}

async function renderMappedPixelTheme(
  templateBuffer: Buffer,
  doc: GeneratedDocument,
  regions: DocxTextRegion[],
  map: PixelThemeMap
): Promise<RenderResult> {
  const { zip } = await loadTemplate(templateBuffer);
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const regionMap = map.regions.filter((region) => region.role !== "decorative_sample");
  if (!regionMap.length) return { buffer: Buffer.alloc(0), usedTheme: false };

  const roleCounts = map.regions.reduce<RoleCounts>((acc, region) => {
    acc[region.role] = (acc[region.role] ?? 0) + 1;
    return acc;
  }, {});
  const queues = buildRoleQueues(doc, roleCounts);
  const replacements = new Map<string, Map<number, string>>();
  const repeatTemplates: Array<{ region: DocxTextRegion; role: PixelThemeRegionRole }> = [];

  for (const mapped of regionMap) {
    const region = regionById.get(mapped.id);
    if (!region) continue;
    const value = nextValue(queues, mapped.role);
    {
      const paragraphXml = getParagraphXmls((await zip.file(region.partName)?.async("string")) ?? "")[region.paragraphIndex];
      if (paragraphXml) {
        const byPart = replacements.get(region.partName) ?? new Map<number, string>();
        byPart.set(region.paragraphIndex, setParaText(paragraphXml, value ?? ""));
        replacements.set(region.partName, byPart);
      }
    }
    if (mapped.repeatable) {
      repeatTemplates.push({ region, role: mapped.role });
    }
  }

  for (const [partName, byPart] of replacements) {
    const entry = zip.file(partName);
    if (!entry) continue;
    let xml = await entry.async("string");
    for (const [paragraphIndex, paragraphXml] of [...byPart.entries()].sort((a, b) => a[0] - b[0])) {
      xml = replaceParagraphAt(xml, paragraphIndex, paragraphXml);
    }
    zip.file(partName, xml);
  }

  const overflowParagraphs: string[] = [];
  for (const template of repeatTemplates) {
    let value = fallbackValueForRole(queues, template.role);
    const entry = zip.file(template.region.partName);
    const xml = entry ? await entry.async("string") : "";
    const templateXml = getParagraphXmls(xml)[template.region.paragraphIndex];
    while (value && templateXml) {
      overflowParagraphs.push(setParaText(templateXml, value));
      value = fallbackValueForRole(queues, template.role);
    }
  }
  if (overflowParagraphs.length) {
    const entry = zip.file("word/document.xml");
    const xml = entry ? await entry.async("string") : "";
    zip.file("word/document.xml", insertBeforeSectPr(xml, overflowParagraphs));
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { buffer: buffer as Buffer, usedTheme: true };
}
