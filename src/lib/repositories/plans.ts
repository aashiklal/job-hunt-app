import connectDB from "@/lib/db/connect";
import Plan, { IPlan } from "@/lib/models/Plan";

export type { IPlan };

export type IPlanListItem = {
  _id: string;
  key: string;
  name: string;
  monthlyCredits: number;
  monthlyPriceUSD: number;
  maxResumes: number;
};

export function toPlanListItem(doc: IPlan): IPlanListItem {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    key: doc.key,
    name: doc.name,
    monthlyCredits: doc.monthlyCredits,
    monthlyPriceUSD: doc.monthlyPriceUSD ?? 0,
    maxResumes: doc.maxResumes,
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
    monthlyCredits: number;
    monthlyPriceUSD: number;
    maxResumes: number;
  }
): Promise<IPlan | null> {
  await connectDB();
  return Plan.findByIdAndUpdate(id, { $set: fields }, { returnDocument: "after" });
}
