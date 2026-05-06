import "server-only";
import * as templates from "@/lib/repositories/templates";
import type { TemplateType } from "@/lib/repositories/templates";
import { analyzeDocxTheme } from "@/lib/export/analyze-docx-theme";
import { extractDocxStructure } from "@/lib/export/extract-docx-structure";
import { extractDocxStyles } from "@/lib/export/extract-docx-styles";
import { mapPixelTheme } from "@/lib/export/map-pixel-theme";
import { mapStylesToRoles } from "@/lib/export/map-styles-to-roles";
import { buildPixelThemeContract } from "@/lib/export/pixel-theme-contract";

const MAPPING_MODEL = "claude-haiku-4-5-20251001";

export async function uploadGlobalTemplate(args: {
  type: TemplateType;
  fileName: string;
  fileData: Buffer;
}) {
  const docType = args.type as "resume" | "cover_letter";
  const themeAnalysis = await analyzeDocxTheme(args.fileData, docType);
  const structure = await extractDocxStructure(args.fileData);
  const styles = await extractDocxStyles(args.fileData);
  const mapped = await mapPixelTheme(structure, docType);
  const styleMapped = await mapStylesToRoles(styles, docType);
  const contract = buildPixelThemeContract({
    docType,
    themeAnalysis,
    pixelThemeMap: mapped.map,
    styleRoleMap: styleMapped.map,
  });

  await templates.upsert(
    args.type,
    args.fileData,
    args.fileName,
    themeAnalysis,
    mapped.map,
    styleMapped.map,
    MAPPING_MODEL
  );

  return {
    response: {
      ok: true,
      themeAnalysis,
      pixelThemeMap: {
        regionCount: mapped.map.regions.length,
        roles: mapped.map.regions.map((region) => region.role),
      },
      styleRoleMap: {
        mappedStyleCount: Object.values(styleMapped.map.roleStyles).filter(Boolean).length,
        sectionHeadingCase: styleMapped.map.sectionHeadingCase,
      },
      themeCapacity: contract?.capacity ?? null,
      warnings: contract?.warnings ?? [...mapped.map.warnings, ...styleMapped.map.warnings],
    },
    auditDetails: {
      themeAnalysis,
      mappedRegions: mapped.map.regions.length,
      mappedStyles: Object.values(styleMapped.map.roleStyles).filter(Boolean).length,
      mappingInputTokens: mapped.inputTokens,
      mappingOutputTokens: mapped.outputTokens,
      styleMappingInputTokens: styleMapped.inputTokens,
      styleMappingOutputTokens: styleMapped.outputTokens,
    },
  };
}
