import "server-only";
import type { GeneratedDocument } from "@/lib/generated-documents";
import type { DocumentThemeAnalysis } from "@/lib/export/analyze-docx-theme";
import type { PixelThemeMap } from "@/lib/export/map-pixel-theme";
import type { StyleRoleMap } from "@/lib/export/map-styles-to-roles";

export type ThemeCapacityLevel = "compact" | "standard" | "expanded";

export type ThemeCapacity = {
  level: ThemeCapacityLevel;
  textParagraphCount: number;
  mappedRegionCount: number;
  mappedStyleCount: number;
  suggestedBodyParagraphs: number | null;
  targetResumePages: 1 | 2;
  guidance: string;
};

export type PixelThemeContract = {
  version: 1;
  docType: GeneratedDocument["kind"];
  themeAnalysis: DocumentThemeAnalysis | null;
  pixelThemeMap: PixelThemeMap | null;
  styleRoleMap: StyleRoleMap;
  capacity: ThemeCapacity;
  warnings: string[];
};

export type PixelThemeContractInput = {
  docType: GeneratedDocument["kind"];
  themeAnalysis?: DocumentThemeAnalysis | null;
  pixelThemeMap?: PixelThemeMap | null;
  styleRoleMap?: StyleRoleMap | null;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function countMappedStyles(styleRoleMap: StyleRoleMap): number {
  return Object.values(styleRoleMap.roleStyles).filter(Boolean).length;
}

function bodyParagraphRegionCount(pixelThemeMap?: PixelThemeMap | null): number {
  return (
    pixelThemeMap?.regions.filter((region) => region.role === "body_paragraph").length ??
    0
  );
}

function capacityLevel(
  docType: GeneratedDocument["kind"],
  textParagraphCount: number,
  mappedRegionCount: number
): ThemeCapacityLevel {
  if (docType === "cover_letter") {
    if (mappedRegionCount >= 12 || textParagraphCount >= 10) return "standard";
    return "compact";
  }

  if (mappedRegionCount >= 48 || textParagraphCount >= 42) return "expanded";
  if (mappedRegionCount >= 28 || textParagraphCount >= 24) return "standard";
  return "compact";
}

function capacityGuidance(args: {
  docType: GeneratedDocument["kind"];
  level: ThemeCapacityLevel;
  suggestedBodyParagraphs: number | null;
  targetResumePages: 1 | 2;
}): string {
  if (args.docType === "cover_letter") {
    const paragraphs = args.suggestedBodyParagraphs ?? 3;
    return `Target ${paragraphs} body paragraph${paragraphs === 1 ? "" : "s"} and keep the full letter to one page. Prefer concise paragraphs over adding extra proof points.`;
  }

  if (args.targetResumePages === 2) {
    return "Target a polished two-page resume when the base resume has enough relevant signal. Preserve role-relevant content, but keep bullets tight.";
  }

  return "Target a polished one-page resume. Include only the strongest role-relevant content because this Pixel Theme has compact capacity.";
}

export function estimateThemeCapacity(input: {
  docType: GeneratedDocument["kind"];
  themeAnalysis?: DocumentThemeAnalysis | null;
  pixelThemeMap?: PixelThemeMap | null;
  styleRoleMap: StyleRoleMap;
}): ThemeCapacity {
  const textParagraphCount = input.themeAnalysis?.textParagraphCount ?? 0;
  const mappedRegionCount = input.pixelThemeMap?.regions.length ?? 0;
  const mappedStyleCount = countMappedStyles(input.styleRoleMap);
  const level = capacityLevel(input.docType, textParagraphCount, mappedRegionCount);
  const suggestedBodyParagraphs =
    input.docType === "cover_letter"
      ? Math.min(4, Math.max(2, bodyParagraphRegionCount(input.pixelThemeMap) || 3))
      : null;
  const targetResumePages: 1 | 2 =
    input.docType === "resume" && level === "compact" ? 1 : 2;

  return {
    level,
    textParagraphCount,
    mappedRegionCount,
    mappedStyleCount,
    suggestedBodyParagraphs,
    targetResumePages,
    guidance: capacityGuidance({
      docType: input.docType,
      level,
      suggestedBodyParagraphs,
      targetResumePages,
    }),
  };
}

export function buildPixelThemeContract(
  input: PixelThemeContractInput
): PixelThemeContract | null {
  if (!input.styleRoleMap || input.styleRoleMap.docType !== input.docType) {
    return null;
  }

  const pixelThemeMap =
    input.pixelThemeMap?.docType === input.docType ? input.pixelThemeMap : null;
  const themeAnalysis =
    input.themeAnalysis?.docType === input.docType ? input.themeAnalysis : null;
  const capacity = estimateThemeCapacity({
    docType: input.docType,
    themeAnalysis,
    pixelThemeMap,
    styleRoleMap: input.styleRoleMap,
  });

  return {
    version: 1,
    docType: input.docType,
    themeAnalysis,
    pixelThemeMap,
    styleRoleMap: input.styleRoleMap,
    capacity,
    warnings: unique([
      ...(themeAnalysis?.warnings ?? []),
      ...(pixelThemeMap?.warnings ?? []),
      ...input.styleRoleMap.warnings,
    ]),
  };
}

export function themeCapacityPrompt(capacity?: ThemeCapacity | null): string {
  if (!capacity) {
    return "No Pixel Theme Capacity is available. Write concise, role-relevant content that can render cleanly in a DOCX.";
  }

  return [
    `Pixel Theme Capacity: ${capacity.level}.`,
    capacity.guidance,
    `Template signals: ${capacity.textParagraphCount} text paragraphs, ${capacity.mappedRegionCount} mapped regions, ${capacity.mappedStyleCount} mapped styles.`,
  ].join(" ");
}
