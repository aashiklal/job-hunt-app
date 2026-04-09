import connectDB from "@/lib/db/connect";
import User, { IUser } from "@/lib/models/User";

export type { IUser };

export type UserListItem = {
  _id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "pending" | "approved" | "rejected";
  isAdmin: boolean;
  createdAt: string;
};

export function toUserListItem(doc: IUser): UserListItem {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    clerkId: doc.clerkId,
    email: doc.email,
    firstName: doc.firstName ?? null,
    lastName: doc.lastName ?? null,
    status: doc.status,
    isAdmin: doc.isAdmin,
    createdAt: doc.createdAt.toISOString(),
  };
}

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
  return User.findByIdAndUpdate(id, { status }, { returnDocument: "after" });
}

export async function setAdmin(
  id: string,
  isAdmin: boolean
): Promise<IUser | null> {
  await connectDB();
  return User.findByIdAndUpdate(id, { isAdmin }, { returnDocument: "after" });
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
    { upsert: true, returnDocument: "after" }
  );
}

/**
 * Merges a Clerk user into an existing bootstrap placeholder found by email.
 * Sets clerkId and profile fields only — does NOT touch status or isAdmin.
 * Used by the user.created webhook when a pre-provisioned record already exists.
 */
export async function claimByEmail(
  email: string,
  clerkId: string,
  args: { firstName?: string; lastName?: string }
): Promise<IUser | null> {
  await connectDB();
  const update: Record<string, unknown> = { clerkId };
  if (args.firstName !== undefined) update.firstName = args.firstName;
  if (args.lastName !== undefined) update.lastName = args.lastName;
  return User.findOneAndUpdate({ email }, { $set: update }, { returnDocument: "after" });
}

export async function deleteByClerkId(clerkId: string): Promise<boolean> {
  await connectDB();
  const result = await User.findOneAndDelete({ clerkId });
  return result !== null;
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
  return User.findOneAndUpdate({ clerkId }, { $set: update }, { returnDocument: "after" });
}
