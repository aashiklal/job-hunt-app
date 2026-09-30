import mongoose, { Document, Model, Schema, Types } from "mongoose";

/**
 * One counter per user, route and fixed time window.
 *
 * Serverless instances share no memory, so the counter has to live somewhere
 * both can see. This uses the database the app already runs rather than adding
 * Redis: one extra round-trip is negligible next to a multi-second model call,
 * and it means no second external service to keep alive.
 */
export type IRateLimit = {
  userId: Types.ObjectId;
  route: string;
  /** Unix timestamp (seconds) of the start of this fixed window. */
  windowStart: number;
  count: number;
  /** When this counter becomes eligible for TTL deletion. */
  expiresAt: Date;
} & Document;

const RateLimitSchema = new Schema<IRateLimit>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  route: { type: String, required: true },
  windowStart: { type: Number, required: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
});

// The atomic upsert in src/lib/rate-limit.ts depends on this being unique.
RateLimitSchema.index(
  { userId: 1, route: 1, windowStart: 1 },
  { unique: true }
);

// Counters are useless once their window has passed; let Mongo reap them.
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit ??
  mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);

export default RateLimit;
