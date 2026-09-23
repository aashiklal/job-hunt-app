import connectDB from "@/lib/db/connect";
import Plan, { IPlan } from "@/lib/models/Plan";

export type { IPlan };

export type IPlanListItem = {
  _id: string;
  key: string;
  name: string;
  aiSpendLimitUSD: number;
  monthlyCredits: number;
  monthlyPriceUSD: number;
  maxResumes: number;
  active: boolean;
};

export function toPlanListItem(doc: IPlan): IPlanListItem {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    key: doc.key,
    name: doc.name,
    aiSpendLimitUSD: doc.aiSpendLimitUSD,
    monthlyCredits: doc.monthlyCredits,
    monthlyPriceUSD: doc.monthlyPriceUSD ?? 0,
    maxResumes: doc.maxResumes,
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
  fields: {
    aiSpendLimitUSD: number;
    monthlyCredits: number;
  monthlyPriceUSD: number;
    maxResumes: number;
  }
): Promise<IPlan | null> {
  await connectDB();
  return Plan.findByIdAndUpdate(id, { $set: fields }, { returnDocument: "after" });
}
