import "server-only";
import type { GeneratedDocument } from "@/lib/generated-documents";
import {
  generatedDocumentBlocks,
  type GeneratedDocumentBlockRole,
} from "@/lib/generated-document-blocks";
import { getParagraphText } from "@/lib/export/analyze-docx-theme";
import { loadTemplate, setParaText } from "@/lib/export/docx-template-io";
import { escapeXml, textToXmlTextRuns } from "@/lib/export/docx-xml";
import type { PixelThemeMap } from "@/lib/export/map-pixel-theme";
import type { PixelThemeContract } from "@/lib/export/pixel-theme-contract";
import type { StyleRole, StyleRoleMap } from "@/lib/export/map-styles-to-roles";

type BuildResult = {
  buffer: Buffer;
  usedTheme: boolean;
};

function roleStyle(map: StyleRoleMap, role: StyleRole): string | null {
  return map.roleStyles[role] ?? map.roleStyles.body_paragraph ?? null;
}

function paragraphXml(text: string, styleId: string | null): string {
  const pPr = styleId ? `<w:pPr><w:pStyle w:val="${escapeXml(styleId)}"/></w:pPr>` : "";
  return `<w:p>${pPr}<w:r>${textToXmlTextRuns(text)}</w:r></w:p>`;
}

function toStyleRole(role: GeneratedDocumentBlockRole): StyleRole {
  return role;
}

type TemplateParagraph = {
  xml: string;
  hasSectPr: boolean;
};

type RoleParagraphTemplates = Partial<Record<StyleRole, string>>;

function isDecorativeParagraph(paragraph: TemplateParagraph): boolean {
  if (paragraph.hasSectPr) return false;
  if (getParagraphText(paragraph.xml).trim()) return false;
  return paragraph.xml.includes("<w:drawing") || paragraph.xml.includes("<w:pict");
}

function decorativeBodyParagraphs(paragraphs: TemplateParagraph[]) {
  const textIndexes = paragraphs
    .map((paragraph, index) =>
      !paragraph.hasSectPr && getParagraphText(paragraph.xml).trim() ? index : -1
    )
    .filter((index) => index >= 0);
  const firstTextIndex = textIndexes[0] ?? Number.POSITIVE_INFINITY;
  const lastTextIndex = textIndexes.at(-1) ?? -1;

  return {
    prefix: paragraphs
      .slice(0, firstTextIndex)
      .filter(isDecorativeParagraph)
      .map((paragraph) => paragraph.xml),
    suffix: paragraphs
      .slice(lastTextIndex + 1)
      .filter(isDecorativeParagraph)
      .map((paragraph) => paragraph.xml),
  };
}

function buildRoleParagraphTemplates(
  paragraphs: TemplateParagraph[],
  pixelThemeMap?: PixelThemeMap | null
): RoleParagraphTemplates {
  const templates: RoleParagraphTemplates = {};
  if (!pixelThemeMap) return templates;

  for (const region of pixelThemeMap.regions) {
    if (region.role === "decorative_sample") continue;
    if (region.id.startsWith("word/header") || region.id.startsWith("word/footer")) continue;
    const match = /^word\/document\.xml#(\d+)$/.exec(region.id);
    if (!match) continue;

    const paragraph = paragraphs[Number.parseInt(match[1], 10)];
    if (!paragraph || paragraph.hasSectPr) continue;
    if (!templates[region.role]) templates[region.role] = paragraph.xml;
  }
  return templates;
}

function paragraphForSpec(
  spec: { role: GeneratedDocumentBlockRole; text: string },
  styleRoleMap: StyleRoleMap,
  roleTemplates: RoleParagraphTemplates
): string {
  const role = toStyleRole(spec.role);
  const template = roleTemplates[role];
  if (template) return setParaText(template, spec.text);
  return paragraphXml(spec.text, roleStyle(styleRoleMap, role));
}

export async function buildDOCXFromStyles(
  templateBuffer: Buffer,
  doc: GeneratedDocument,
  contract?: PixelThemeContract | null
): Promise<BuildResult> {
  if (!contract || contract.docType !== doc.kind) {
    return { buffer: Buffer.alloc(0), usedTheme: false };
  }

  const { pixelThemeMap, styleRoleMap } = contract;
  const { zip, paragraphs, header, sectPrParas, directSectPr } =
    await loadTemplate(templateBuffer);
  const specs = generatedDocumentBlocks(doc, {
    sectionHeadingCase: styleRoleMap.sectionHeadingCase,
  });
  if (!specs.length) return { buffer: Buffer.alloc(0), usedTheme: false };

  const roleTemplates = buildRoleParagraphTemplates(paragraphs, pixelThemeMap);
  const decorative = decorativeBodyParagraphs(paragraphs);
  const bodyParagraphs = [
    ...decorative.prefix,
    ...specs.map((spec) =>
      paragraphForSpec(spec, styleRoleMap, roleTemplates)
    ),
    ...decorative.suffix,
  ];

  const docXml = [
    header,
    bodyParagraphs.join("\n"),
    sectPrParas,
    directSectPr,
    "</w:body>",
    "</w:document>",
  ]
    .filter(Boolean)
    .join("\n");

  zip.file("word/document.xml", docXml);

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { buffer: buffer as Buffer, usedTheme: true };
}
