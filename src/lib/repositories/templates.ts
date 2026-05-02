import connectDB from "@/lib/db/connect";
import Template, { ITemplate, type TemplateType } from "@/lib/models/Template";
import type { DocumentThemeAnalysis } from "@/lib/export/analyze-docx-theme";
import type { PixelThemeMap } from "@/lib/export/map-pixel-theme";
import type { StyleRoleMap } from "@/lib/export/map-styles-to-roles";
import { buildPixelThemeContract, type ThemeCapacity } from "@/lib/export/pixel-theme-contract";

export type { TemplateType };

export type TemplateMeta = {
  _id: string;
  type: TemplateType;
  fileName: string;
  analysisWarnings?: string[];
  mappedRegionCount?: number;
  mappedStyleCount?: number;
  themeCapacity?: ThemeCapacity | null;
  uploadedAt: string;
};

function toMeta(doc: ITemplate): TemplateMeta {
  const contract = buildPixelThemeContract({
    docType: doc.type,
    themeAnalysis: doc.themeAnalysis ?? null,
    pixelThemeMap: doc.pixelThemeMap ?? null,
    styleRoleMap: doc.styleRoleMap ?? null,
  });
  return {
    _id: (doc._id as { toString(): string }).toString(),
    type: doc.type,
    fileName: doc.fileName,
    analysisWarnings: doc.analysisWarnings ?? [],
    mappedRegionCount: doc.pixelThemeMap?.regions.length ?? 0,
    mappedStyleCount: doc.styleRoleMap
      ? Object.values(doc.styleRoleMap.roleStyles).filter(Boolean).length
      : 0,
    themeCapacity: contract?.capacity ?? null,
    uploadedAt: doc.uploadedAt.toISOString(),
  };
}

/** Upsert the global (admin) template for the given type. */
export async function upsert(
  type: TemplateType,
  fileData: Buffer,
  fileName: string,
  themeAnalysis?: DocumentThemeAnalysis,
  pixelThemeMap?: PixelThemeMap,
  styleRoleMap?: StyleRoleMap,
  mappingModel?: string
): Promise<ITemplate> {
  await connectDB();
  const result = await Template.findOneAndUpdate(
    { type },
    {
      $set: {
        fileData,
        fileName,
        themeAnalysis,
        pixelThemeMap,
        styleRoleMap,
        mappingModel,
        mappingVersion: styleRoleMap?.version ?? pixelThemeMap?.version,
        analysisWarnings:
          styleRoleMap?.warnings ??
          pixelThemeMap?.warnings ??
          themeAnalysis?.warnings ??
          [],
        uploadedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) throw new Error("Template upsert failed");
  return result;
}

/** Get the global (admin) template for the given type. */
export async function get(type: TemplateType): Promise<ITemplate | null> {
  await connectDB();
  return Template.findOne({ type });
}

/** Delete the global (admin) template for the given type. */
export async function deleteTemplate(type: TemplateType): Promise<boolean> {
  await connectDB();
  const result = await Template.deleteOne({ type });
  return result.deletedCount > 0;
}

/** List meta (no fileData) for all global templates. */
export async function list(): Promise<TemplateMeta[]> {
  await connectDB();
  const docs = await Template.find({}, { fileData: 0 });
  return docs.map(toMeta);
}
