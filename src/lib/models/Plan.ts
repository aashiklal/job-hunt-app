import mongoose, { Document, Model, Schema } from "mongoose";

export type IPlan = {
  key: string;
  name: string;
  /** Monthly AI spend budget in USD (e.g. 5.00 = $5.00). -1 = unlimited. */
  aiSpendLimitUSD: number;
  /** "monthly" resets each calendar month; "lifetime" is a one-time total budget, never reset. */
  budgetScope: "monthly" | "lifetime";
  maxResumes: number;
  maxJobs: number;
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
    aiSpendLimitUSD: { type: Number, required: true, default: 5.0 },
    budgetScope: { type: String, enum: ["monthly", "lifetime"], required: true, default: "monthly" },
    maxResumes: { type: Number, required: true },
    maxJobs: { type: Number, required: true },
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
