"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import connectDB from "@/lib/db/connect";
import User from "@/lib/models/User";
import Subscription from "@/lib/models/Subscription";
import { requireAdmin } from "@/lib/auth-helpers";

const userIdSchema = z.string().min(1, "userId is required");

export async function approveUser(
  userId: string
): Promise<{ success: true }> {
  await requireAdmin();
  const id = userIdSchema.parse(userId);

  await connectDB();
  await User.findByIdAndUpdate(id, { status: "approved" });

  try {
    await Subscription.findOneAndUpdate(
      { userId: id },
      { $setOnInsert: { userId: id, planKey: "personal", status: "active" } },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(`[approveUser] Failed to upsert subscription for user ${id}:`, err);
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function rejectUser(
  userId: string
): Promise<{ success: true }> {
  const admin = await requireAdmin();
  const id = userIdSchema.parse(userId);

  if (admin._id.toString() === id) {
    throw new Error("You cannot reject your own account.");
  }

  await connectDB();
  await User.findByIdAndUpdate(id, { status: "rejected" });
  revalidatePath("/admin");
  return { success: true };
}
