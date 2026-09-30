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
   * Marks a per-visitor demo account. Demo users get full CRUD but their
   * AI requests are served from fixtures instead of calling Anthropic, and
   * the account is deleted when it expires. See src/lib/demo-accounts.ts.
   */
  isDemo: boolean;
  /**
   * When a per-visitor demo account stops working and becomes eligible for
   * deletion. Null for real users. A demo without it is a legacy shared demo
   * account and is swept immediately. See src/lib/demo-accounts.ts.
   */
  demoExpiresAt: Date | null;
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
    demoExpiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: false }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
