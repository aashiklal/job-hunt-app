import type { DocumentThemeAnalysis } from "@/lib/export/analyze-docx-theme";
import type { StyleRoleMap } from "@/lib/export/map-styles-to-roles";
import type { PixelThemeMap } from "@/lib/export/map-pixel-theme";
import mongoose, { Document, Model, Schema } from "mongoose";

export type TemplateType = "resume" | "cover_letter";

export type ITemplate = {
  type: TemplateType;
  fileData: Buffer;
  fileName: string;
  themeAnalysis?: DocumentThemeAnalysis;
  pixelThemeMap?: PixelThemeMap;
  styleRoleMap?: StyleRoleMap;
  mappingModel?: string;
  mappingVersion?: number;
  analysisWarnings?: string[];
  uploadedAt: Date;
} & Document;

const TemplateSchema = new Schema<ITemplate>({
  type: { type: String, enum: ["resume", "cover_letter"], required: true },
  fileData: { type: Buffer, required: true },
  fileName: { type: String, required: true, trim: true },
  themeAnalysis: { type: Schema.Types.Mixed },
  pixelThemeMap: { type: Schema.Types.Mixed },
  styleRoleMap: { type: Schema.Types.Mixed },
  mappingModel: { type: String },
  mappingVersion: { type: Number },
  analysisWarnings: { type: [String], default: [] },
  uploadedAt: { type: Date, default: () => new Date() },
});

// One global template per type
TemplateSchema.index({ type: 1 }, { unique: true });

const Template: Model<ITemplate> =
  mongoose.models.Template ?? mongoose.model<ITemplate>("Template", TemplateSchema);

export default Template;
