import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type JobStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

export type IJob = {
  userId: Types.ObjectId;
  company: string;
  role: string;
  location?: string;
  jobDescription?: string;
  url?: string;
  salary?: string;
  status: JobStatus;
  notes?: string;
  appliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const JobSchema = new Schema<IJob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    jobDescription: { type: String },
    url: { type: String, trim: true },
    salary: { type: String, trim: true },
    status: {
      type: String,
      enum: ["saved", "applied", "interview", "offer", "rejected"],
      default: "saved",
    },
    notes: { type: String },
    appliedAt: { type: Date },
  },
  { timestamps: true }
);

const Job: Model<IJob> =
  mongoose.models.Job ?? mongoose.model<IJob>("Job", JobSchema);

export default Job;
