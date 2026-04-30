import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type IOffer = {
  userId: Types.ObjectId;
  company: string;
  role: string;
  baseSalary: number;
  currency: string;
  equity?: string;
  bonus?: string;
  leaveDays?: number;
  location: string;
  remotePolicy: "fully_remote" | "hybrid" | "onsite";
  roleLevel: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
} & Document;

const OfferSchema = new Schema<IOffer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: String, required: true, trim: true, maxlength: 200 },
    role: { type: String, required: true, trim: true, maxlength: 200 },
    baseSalary: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD", maxlength: 10 },
    equity: { type: String, maxlength: 500 },
    bonus: { type: String, maxlength: 500 },
    leaveDays: { type: Number },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    remotePolicy: {
      type: String,
      required: true,
      enum: ["fully_remote", "hybrid", "onsite"],
    },
    roleLevel: { type: String, required: true, trim: true, maxlength: 100 },
    notes: { type: String, maxlength: 5000 },
  },
  { timestamps: true }
);

OfferSchema.index({ userId: 1, createdAt: -1 });

const Offer: Model<IOffer> =
  mongoose.models.Offer ?? mongoose.model<IOffer>("Offer", OfferSchema);

export default Offer;
