import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type TemplateType = "resume" | "cover_letter";

export type ITemplate = {
  userId: Types.ObjectId | null; // null = admin / global default
  type: TemplateType;
  fileData: Buffer;
  fileName: string;
  uploadedAt: Date;
} & Document;

const TemplateSchema = new Schema<ITemplate>({
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  type: { type: String, enum: ["resume", "cover_letter"], required: true },
  fileData: { type: Buffer, required: true },
  fileName: { type: String, required: true, trim: true },
  uploadedAt: { type: Date, default: () => new Date() },
});

// One template per (user, type) — also enforces only one admin template per type
TemplateSchema.index({ userId: 1, type: 1 }, { unique: true });

const Template: Model<ITemplate> =
  mongoose.models.Template ?? mongoose.model<ITemplate>("Template", TemplateSchema);

export default Template;
