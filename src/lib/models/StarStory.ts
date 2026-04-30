import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type IStarStory = {
  userId: Types.ObjectId;
  title: string;
  tags: string[];
  roughDraft: string;
  polishedOutput?: string;
  maxWords?: number;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const StarStorySchema = new Schema<IStarStory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    tags: { type: [String], default: [] },
    roughDraft: { type: String, required: true, maxlength: 10000 },
    polishedOutput: { type: String, maxlength: 10000 },
    maxWords: { type: Number },
  },
  { timestamps: true }
);

StarStorySchema.index({ userId: 1, createdAt: -1 });

const StarStory: Model<IStarStory> =
  mongoose.models.StarStory ?? mongoose.model<IStarStory>("StarStory", StarStorySchema);

export default StarStory;
