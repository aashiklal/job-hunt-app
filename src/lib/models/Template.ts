import mongoose, { Document, Model, Schema } from "mongoose";

export type TemplateType = "resume" | "cover_letter";

export type ITemplate = {
  type: TemplateType;
  fileData: Buffer;
  fileName: string;
  uploadedAt: Date;
} & Document;

const TemplateSchema = new Schema<ITemplate>({
  type: { type: String, enum: ["resume", "cover_letter"], required: true },
  fileData: { type: Buffer, required: true },
  fileName: { type: String, required: true, trim: true },
  uploadedAt: { type: Date, default: () => new Date() },
});

// One global template per type
TemplateSchema.index({ type: 1 }, { unique: true });

const Template: Model<ITemplate> =
  mongoose.models.Template ?? mongoose.model<ITemplate>("Template", TemplateSchema);

export default Template;
