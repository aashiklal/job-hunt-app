import connectDB from "@/lib/db/connect";
import Plan, { IPlan } from "@/lib/models/Plan";

export type { IPlan };

export type IPlanListItem = {
  _id: string;
  key: string;
  name: string;
  aiSpendLimitUSD: number;
  budgetScope: "monthly" | "lifetime";
  maxResumes: number;
  maxJobs: number;
  active: boolean;
};

export function toPlanListItem(doc: IPlan): IPlanListItem {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    key: doc.key,
    name: doc.name,
    aiSpendLimitUSD: doc.aiSpendLimitUSD,
    budgetScope: doc.budgetScope,
    maxResumes: doc.maxResumes,
    maxJobs: doc.maxJobs,
    active: doc.active,
  };
}

export async function getByKey(key: string): Promise<IPlan | null> {
  await connectDB();
  return Plan.findOne({ key });
}

export async function listAll(): Promise<IPlan[]> {
  await connectDB();
  return Plan.find().sort({ key: 1 });
}

export async function update(
  id: string,
  fields: { aiSpendLimitUSD: number; maxResumes: number; maxJobs: number }
): Promise<IPlan | null> {
  await connectDB();
  return Plan.findByIdAndUpdate(id, { $set: fields }, { returnDocument: "after" });
}
