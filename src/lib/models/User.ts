import mongoose, { Document, Model, Schema } from "mongoose";

export type IUser = {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
} & Document;

const UserSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
