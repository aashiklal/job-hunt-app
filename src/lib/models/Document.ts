import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type DocumentType = "resume" | "cover_letter";

export type IDocument = {
  userId: Types.ObjectId;
  jobId: Types.ObjectId;
  type: DocumentType;
  content: string;
  aiModel: string;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const DocumentSchema = new Schema<IDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    type: {
      type: String,
      enum: ["resume", "cover_letter"],
      required: true,
    },
    content: { type: String, required: true },
    aiModel: { type: String, required: true },
  },
  { timestamps: true }
);

const Doc: Model<IDocument> =
  mongoose.models.Document ??
  mongoose.model<IDocument>("Document", DocumentSchema);

export default Doc;
