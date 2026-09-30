import mongoose, { Document, Model, Schema, Types } from "mongoose";

/**
 * One row per AI call, for analytics only.
 *
 * The Usage document is a running counter per month, which is what makes quota
 * enforcement a single atomic update. It cannot answer "what did last Tuesday
 * cost" or "which feature is most expensive", because it has no timestamps and
 * no per-feature breakdown.
 *
 * This collection carries that detail. It is written after the call completes
 * and is never on the enforcement path, so a failure here degrades reporting
 * rather than letting spend through.
 */
export type IUsageEvent = {
  userId: Types.ObjectId;
  /** Credit feature key, e.g. "resume", "cover_letter". */
  feature: string;
  /** Named aiModel, not model: Document already defines a model() method. */
  aiModel: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const UsageEventSchema = new Schema<IUsageEvent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    feature: { type: String, required: true, index: true },
    aiModel: { type: String, required: true },
    inputTokens: { type: Number, required: true, default: 0 },
    outputTokens: { type: Number, required: true, default: 0 },
    costUSD: { type: Number, required: true, default: 0 },
    credits: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

// Supports the admin's time-bucketed queries, overall and per user.
UsageEventSchema.index({ createdAt: -1 });
UsageEventSchema.index({ userId: 1, createdAt: -1 });

// Deliberately no TTL. Spend history is the point of this collection, and the
// rows are small enough that keeping them indefinitely costs little.

const UsageEvent: Model<IUsageEvent> =
  mongoose.models.UsageEvent ??
  mongoose.model<IUsageEvent>("UsageEvent", UsageEventSchema);

export default UsageEvent;
