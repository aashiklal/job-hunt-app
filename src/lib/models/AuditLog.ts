import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AuditAction =
  | "user.approved"
  | "user.rejected"
  | "user.admin_granted"
  | "user.admin_revoked"
  | "user.custom_limit_set"
  | "user.custom_limit_cleared";

export type IAuditLog = {
  adminId: Types.ObjectId;
  adminEmail: string;
  targetUserId: Types.ObjectId;
  targetUserEmail: string;
  action: AuditAction;
  details?: Record<string, unknown>;
  createdAt: Date;
} & Document;

const AuditLogSchema = new Schema<IAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    adminEmail: { type: String, required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetUserEmail: { type: String, required: true },
    action: {
      type: String,
      enum: [
        "user.approved",
        "user.rejected",
        "user.admin_granted",
        "user.admin_revoked",
        "user.custom_limit_set",
        "user.custom_limit_cleared",
      ],
      required: true,
    },
    details: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: false }
);

// 90-day rolling retention via MongoDB TTL index.
// Documents are auto-deleted by Mongo's background TTL monitor 90 days
// after createdAt. No application-side cron needed.
// 90 days = 60 * 60 * 24 * 90 = 7776000 seconds
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ?? mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
