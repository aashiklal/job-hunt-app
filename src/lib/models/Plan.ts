import mongoose, { Document, Model, Schema } from "mongoose";

export type IPlan = {
  key: string;
  name: string;
  /** Monthly credit allowance. -1 for unlimited. The only limit users hit. */
  monthlyCredits: number;
  /** What this plan charges per month. Drives the margin view. */
  monthlyPriceUSD: number;
  maxResumes: number;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const PlanSchema = new Schema<IPlan>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    // No default: a plan without an allowance must fail closed (0 credits),
    // not quietly hand out a guessed one. See resolveCreditLimit in usage.ts.
    monthlyCredits: { type: Number, required: true },
    monthlyPriceUSD: { type: Number, required: true, default: 0 },
    maxResumes: { type: Number, required: true },
  },
  { timestamps: true }
);

const Plan: Model<IPlan> =
  mongoose.models.Plan ?? mongoose.model<IPlan>("Plan", PlanSchema);

export default Plan;
