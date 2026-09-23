import connectDB from "@/lib/db/connect";
import Offer, { IOffer } from "@/lib/models/Offer";

export type OfferItem = {
  _id: string;
  userId: string;
  company: string;
  role: string;
  baseSalary: number;
  currency: string;
  equity: string | null;
  bonus: string | null;
  leaveDays: number | null;
  location: string;
  remotePolicy: "fully_remote" | "hybrid" | "onsite";
  roleLevel: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function toOfferItem(doc: IOffer): OfferItem {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    userId: (doc.userId as unknown as { toString(): string }).toString(),
    company: doc.company,
    role: doc.role,
    baseSalary: doc.baseSalary,
    currency: doc.currency,
    equity: doc.equity ?? null,
    bonus: doc.bonus ?? null,
    leaveDays: doc.leaveDays ?? null,
    location: doc.location,
    remotePolicy: doc.remotePolicy,
    roleLevel: doc.roleLevel,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function list(userId: string): Promise<OfferItem[]> {
  await connectDB();
  const docs = await Offer.find({ userId }).sort({ createdAt: -1 });
  return docs.map(toOfferItem);
}

export async function getById(
  userId: string,
  id: string
): Promise<OfferItem | null> {
  await connectDB();
  const doc = await Offer.findOne({ _id: id, userId });
  return doc ? toOfferItem(doc) : null;
}

export async function create(
  userId: string,
  data: {
    company: string;
    role: string;
    baseSalary: number;
    currency: string;
    equity?: string;
    bonus?: string;
    leaveDays?: number;
    location: string;
    remotePolicy: "fully_remote" | "hybrid" | "onsite";
    roleLevel: string;
    notes?: string;
  }
): Promise<OfferItem> {
  await connectDB();
  const doc = await Offer.create({ userId, ...data });
  return toOfferItem(doc);
}

export async function update(
  userId: string,
  id: string,
  data: Partial<Omit<OfferItem, "_id" | "userId" | "createdAt" | "updatedAt">>
): Promise<OfferItem | null> {
  await connectDB();
  const doc = await Offer.findOneAndUpdate(
    { _id: id, userId },
    { $set: data },
    { returnDocument: "after" }
  );
  return doc ? toOfferItem(doc) : null;
}

export async function deleteOffer(
  userId: string,
  id: string
): Promise<boolean> {
  await connectDB();
  const doc = await Offer.findOneAndDelete({ _id: id, userId });
  return doc !== null;
}

export async function deleteAllForUser(userId: string): Promise<number> {
  await connectDB();
  const result = await Offer.deleteMany({ userId });
  return result.deletedCount ?? 0;
}
