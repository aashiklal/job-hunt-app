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

export class InvalidTransitionError extends Error {
  constructor(from: JobStatus, to: JobStatus) {
    super(`Cannot transition job from "${from}" to "${to}"`);
    this.name = "InvalidTransitionError";
  }
}

// Terminal states may only restart at "saved"; all other transitions are open.
export function isValidTransition(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  if ((from === "rejected" || from === "withdrawn") && to !== "saved") return false;
  return true;
}

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
  coverLetterGenerated?: boolean;
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
    coverLetterGenerated: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Job: Model<IJob> =
  mongoose.models.Job ?? mongoose.model<IJob>("Job", JobSchema);

export default Job;
