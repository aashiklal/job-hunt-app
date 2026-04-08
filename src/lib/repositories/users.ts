import connectDB from "@/lib/db/connect";
import User, { IUser } from "@/lib/models/User";

export async function getById(id: string): Promise<IUser | null> {
  await connectDB();
  return User.findById(id);
}

export async function getByClerkId(clerkId: string): Promise<IUser | null> {
  await connectDB();
  return User.findOne({ clerkId });
}

export async function getByEmail(email: string): Promise<IUser | null> {
  await connectDB();
  return User.findOne({ email });
}

export async function listByStatus(
  status: "pending" | "approved" | "rejected"
): Promise<IUser[]> {
  await connectDB();
  return User.find({ status }).sort({ createdAt: -1 });
}

export async function listAll(): Promise<IUser[]> {
  await connectDB();
  return User.find().sort({ createdAt: -1 });
}

export async function setStatus(
  id: string,
  status: "pending" | "approved" | "rejected"
): Promise<IUser | null> {
  await connectDB();
  return User.findByIdAndUpdate(id, { status }, { new: true });
}

export async function setAdmin(
  id: string,
  isAdmin: boolean
): Promise<IUser | null> {
  await connectDB();
  return User.findByIdAndUpdate(id, { isAdmin }, { new: true });
}

export async function createFromClerk(args: {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<IUser> {
  await connectDB();
  return User.create({
    clerkId: args.clerkId,
    email: args.email,
    firstName: args.firstName,
    lastName: args.lastName,
    status: "pending",
    isAdmin: false,
  });
}

export async function upsertFromClerk(args: {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<IUser | null> {
  await connectDB();
  return User.findOneAndUpdate(
    { clerkId: args.clerkId },
    {
      $setOnInsert: {
        clerkId: args.clerkId,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        status: "pending",
        isAdmin: false,
      },
    },
    { upsert: true, new: true }
  );
}

export async function updateProfileFromClerk(
  clerkId: string,
  args: { email?: string; firstName?: string; lastName?: string }
): Promise<IUser | null> {
  await connectDB();
  const update: Partial<Pick<IUser, "email" | "firstName" | "lastName">> = {};
  if (args.email !== undefined) update.email = args.email;
  if (args.firstName !== undefined) update.firstName = args.firstName;
  if (args.lastName !== undefined) update.lastName = args.lastName;
  return User.findOneAndUpdate({ clerkId }, { $set: update }, { new: true });
}
