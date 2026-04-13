import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type IUsage = {
  userId: Types.ObjectId;
  period: string;
  aiSpendUSD: number;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const UsageSchema = new Schema<IUsage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    period: { type: String, required: true, index: true },
    aiSpendUSD: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

UsageSchema.index({ userId: 1, period: 1 }, { unique: true });

const Usage: Model<IUsage> =
  mongoose.models.Usage ?? mongoose.model<IUsage>("Usage", UsageSchema);

export default Usage;
