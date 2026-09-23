import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type ISubscription = {
  userId: Types.ObjectId;
  planKey: string;
  /**
   * Billing state, in Stripe's own vocabulary so a webhook can set it directly
   * once payments exist. Only "active" counts as paying revenue; "comped" is
   * free access granted deliberately, such as the demo account.
   */
  status: "active" | "canceled" | "past_due" | "trialing" | "comped";
  customLimits?: {
    /** Admin-set per-user monthly AI budget override in USD. */
    aiSpendLimitUSD?: number;
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
      enum: ["active", "canceled", "past_due", "trialing", "comped"],
      default: "trialing",
    },
    customLimits: {
      type: new Schema(
        { aiSpendLimitUSD: { type: Number, required: false } },
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
