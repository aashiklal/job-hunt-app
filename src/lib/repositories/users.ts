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

export async function listAdmins(): Promise<IUser[]> {
  await connectDB();
  return User.find({ isAdmin: true }, { email: 1 }).lean() as Promise<IUser[]>;
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

/**
 * Flags a user as the shared public demo account. Demo users keep full CRUD
 * but never reach Anthropic, and their data is reset on a schedule.
 */
export async function setDemo(
  id: string,
  isDemo: boolean
): Promise<IUser | null> {
  await connectDB();
  return User.findByIdAndUpdate(id, { isDemo }, { returnDocument: "after" });
}

export async function getDemoUser(): Promise<IUser | null> {
  await connectDB();
  return User.findOne({ isDemo: true });
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
 * Sets clerkId and profile fields only. Does not touch status or isAdmin.
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

export async function countApproved(): Promise<number> {
  await connectDB();
  return User.countDocuments({ status: "approved" });
}

export async function countByStatus(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
}> {
  await connectDB();
  const [pending, approved, rejected] = await Promise.all([
    User.countDocuments({ status: "pending" }),
    User.countDocuments({ status: "approved" }),
    User.countDocuments({ status: "rejected" }),
  ]);
  return { pending, approved, rejected };
}

export async function countNewSince(date: Date): Promise<number> {
  await connectDB();
  return User.countDocuments({ createdAt: { $gte: date } });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function countByStatusWithSearch(search?: string): Promise<{
  pending: number;
  approved: number;
  rejected: number;
}> {
  await connectDB();
  const filter = search
    ? {
        $or: [
          { email: { $regex: escapeRegex(search), $options: "i" } },
          { firstName: { $regex: escapeRegex(search), $options: "i" } },
          { lastName: { $regex: escapeRegex(search), $options: "i" } },
        ],
      }
    : {};
  const [pending, approved, rejected] = await Promise.all([
    User.countDocuments({ ...filter, status: "pending" }),
    User.countDocuments({ ...filter, status: "approved" }),
    User.countDocuments({ ...filter, status: "rejected" }),
  ]);
  return { pending, approved, rejected };
}

export async function listPaginated(opts: {
  status: "pending" | "approved" | "rejected";
  search?: string;
  page: number;
  limit: number;
}): Promise<{ users: IUser[]; total: number }> {
  await connectDB();
  const filter: Record<string, unknown> = { status: opts.status };
  if (opts.search) {
    filter["$or"] = [
      { email: { $regex: escapeRegex(opts.search), $options: "i" } },
      { firstName: { $regex: escapeRegex(opts.search), $options: "i" } },
      { lastName: { $regex: escapeRegex(opts.search), $options: "i" } },
    ];
  }
  const skip = (opts.page - 1) * opts.limit;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(opts.limit),
    User.countDocuments(filter),
  ]);
  return { users, total };
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
