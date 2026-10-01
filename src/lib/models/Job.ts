import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type JobStatus =
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "assessment"
  | "offer"
  | "rejected"
  | "withdrawn";

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
  contactName?: string;
  contactTitle?: string;
  deletedAt?: Date | null;
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
      enum: ["saved", "applied", "screening", "interview", "assessment", "offer", "rejected", "withdrawn"],
      default: "saved",
    },
    notes: { type: String },
    appliedAt: { type: Date },
    contactName: { type: String, trim: true },
    contactTitle: { type: String, trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Job: Model<IJob> =
  mongoose.models.Job ?? mongoose.model<IJob>("Job", JobSchema);

export default Job;
