import { auth } from "@clerk/nextjs/server";
import connectDB from "@/lib/db/connect";
import User, { IUser } from "@/lib/models/User";

export async function getCurrentUser(): Promise<IUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  await connectDB();
  return User.findOne({ clerkId: userId });
}
