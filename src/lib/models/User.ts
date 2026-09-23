import mongoose, { Document, Model, Schema } from "mongoose";

export type IUser = {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  status: "pending" | "approved" | "rejected";
  isAdmin: boolean;
  /**
   * Marks the shared public demo account. Demo users get full CRUD but their
   * AI requests are served from fixtures instead of calling Anthropic, and
   * their data is reset on a schedule. See src/lib/demo.ts.
   */
  isDemo: boolean;
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
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: false }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
