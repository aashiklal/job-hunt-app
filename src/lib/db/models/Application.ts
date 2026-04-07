import mongoose, { Document, Model, Schema } from "mongoose";

export type ApplicationStatus =
  | "Applied"
  | "Screening"
  | "Interview"
  | "Assessment"
  | "Offer"
  | "Rejected"
  | "Withdrawn";

export type IApplication = {
  userId: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  dateApplied: Date;
  url?: string;
  notes?: string;
  coverLetterGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const ApplicationSchema = new Schema<IApplication>(
  {
    userId: { type: String, required: true },
    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: [
        "Applied",
        "Screening",
        "Interview",
        "Assessment",
        "Offer",
        "Rejected",
        "Withdrawn",
      ],
      default: "Applied",
    },
    dateApplied: { type: Date, default: Date.now },
    url: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 500 },
    coverLetterGenerated: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

ApplicationSchema.pre("save", function () {
  this.updatedAt = new Date();
});

const Application: Model<IApplication> =
  mongoose.models.Application ??
  mongoose.model<IApplication>("Application", ApplicationSchema);

export default Application;
