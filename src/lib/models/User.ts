import mongoose, { Document, Model, Schema } from "mongoose";

export type IUser = {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  status: "pending" | "approved" | "rejected";
  isAdmin: boolean;
  /** Set when the user dismisses the getting-started tour. Null/undefined = still show it. */
  onboardingDismissedAt?: Date | null;
} & Document;

const UserSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    isAdmin: { type: Boolean, default: false },
    onboardingDismissedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
