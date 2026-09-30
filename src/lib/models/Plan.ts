import mongoose, { Document, Model, Schema } from "mongoose";

export type IPlan = {
  key: string;
  name: string;
  /** Monthly credit allowance. -1 for unlimited. The only limit users hit. */
  monthlyCredits: number;
  /** What this plan charges per month. Drives the margin view. */
  monthlyPriceUSD: number;
  maxResumes: number;
  pdfParsingEnabled: boolean;
  docxParsingEnabled: boolean;
  pdfExportEnabled: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const PlanSchema = new Schema<IPlan>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    monthlyCredits: { type: Number, required: true, default: 500 },
    monthlyPriceUSD: { type: Number, required: true, default: 0 },
    maxResumes: { type: Number, required: true },
    pdfParsingEnabled: { type: Boolean, default: true },
    docxParsingEnabled: { type: Boolean, default: true },
    pdfExportEnabled: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Plan: Model<IPlan> =
  mongoose.models.Plan ?? mongoose.model<IPlan>("Plan", PlanSchema);

export default Plan;
