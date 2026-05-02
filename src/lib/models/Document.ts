import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type DocumentType =
  | "resume"
  | "cover_letter"
  | "jd_analysis"
  | "linkedin_note"
  | "linkedin_dm"
  | "followup_email"
  | "thankyou_email"
  | "interview_prep"
  | "linkedin_followup_dm"
  | "cold_email"
  | "checkin_email"
  | "salary_negotiation";

export type IDocument = {
  userId: Types.ObjectId;
  jobId: Types.ObjectId;
  type: DocumentType;
  content: string;
  structuredContent?: Record<string, unknown>;
  aiModel: string;
  inputTokens?: number;
  outputTokens?: number;
  resumeIdUsed?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const DocumentSchema = new Schema<IDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    type: {
      type: String,
      enum: [
        "resume",
        "cover_letter",
        "jd_analysis",
        "linkedin_note",
        "linkedin_dm",
        "followup_email",
        "thankyou_email",
        "interview_prep",
        "linkedin_followup_dm",
        "cold_email",
        "checkin_email",
        "salary_negotiation",
      ],
      required: true,
    },
    content: { type: String, required: true },
    structuredContent: { type: Schema.Types.Mixed },
    aiModel: { type: String, required: true },
    inputTokens: { type: Number },
    outputTokens: { type: Number },
    resumeIdUsed: { type: Schema.Types.ObjectId, ref: "Resume" },
  },
  { timestamps: true }
);

// One row per (user, job, type) — new generations overwrite previous ones via upsert
DocumentSchema.index({ userId: 1, jobId: 1, type: 1 }, { unique: true });

const Doc: Model<IDocument> =
  mongoose.models.Document ??
  mongoose.model<IDocument>("Document", DocumentSchema);

export default Doc;
