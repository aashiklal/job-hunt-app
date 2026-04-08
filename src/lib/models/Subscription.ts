import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type ISubscription = {
  userId: Types.ObjectId;
  planKey: string;
  status: "active" | "canceled" | "past_due" | "trialing";
  customLimits?: {
    aiGenerationsPerMonth?: number;
  };
  currentPeriodEnd?: Date | null;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    planKey: { type: String, required: true, default: "personal" },
    status: {
      type: String,
      enum: ["active", "canceled", "past_due", "trialing"],
      default: "active",
    },
    customLimits: {
      type: new Schema(
        { aiGenerationsPerMonth: { type: Number, required: false } },
        { _id: false }
      ),
      required: false,
    },
    currentPeriodEnd: { type: Date, default: null },
  },
  { timestamps: true }
);

const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ??
  mongoose.model<ISubscription>("Subscription", SubscriptionSchema);

export default Subscription;
