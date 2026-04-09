import connectDB from "@/lib/db/connect";
import Plan, { IPlan } from "@/lib/models/Plan";

export type { IPlan };

export async function getByKey(key: string): Promise<IPlan | null> {
  await connectDB();
  return Plan.findOne({ key });
}
