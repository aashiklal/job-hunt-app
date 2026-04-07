import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type IResume = {
  userId: Types.ObjectId;
  title: string;
  content: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const ResumeSchema = new Schema<IResume>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Resume: Model<IResume> =
  mongoose.models.Resume ?? mongoose.model<IResume>("Resume", ResumeSchema);

export default Resume;
