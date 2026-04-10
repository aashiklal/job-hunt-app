import mongoose from "mongoose";
import connectDB from "@/lib/db/connect";
import Template, { ITemplate, type TemplateType } from "@/lib/models/Template";

export type { TemplateType };

export type TemplateMeta = {
  _id: string;
  type: TemplateType;
  fileName: string;
  uploadedAt: string;
};

function toMeta(doc: ITemplate): TemplateMeta {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    type: doc.type,
    fileName: doc.fileName,
    uploadedAt: doc.uploadedAt.toISOString(),
  };
}

/** Upsert a template for a user (or admin when userId is null). */
export async function upsert(
  userId: string | null,
  type: TemplateType,
  fileData: Buffer,
  fileName: string
): Promise<ITemplate> {
  await connectDB();
  const filter = {
    userId: userId ? new mongoose.Types.ObjectId(userId) : null,
    type,
  };
  const result = await Template.findOneAndUpdate(
    filter,
    { $set: { fileData, fileName, uploadedAt: new Date() } },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) throw new Error("Template upsert failed");
  return result;
}

/** Get the user's own template for the given type. */
export async function getForUser(
  userId: string,
  type: TemplateType
): Promise<ITemplate | null> {
  await connectDB();
  return Template.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    type,
  });
}

/** Get the admin (global) template for the given type. */
export async function getAdmin(type: TemplateType): Promise<ITemplate | null> {
  await connectDB();
  return Template.findOne({ userId: null, type });
}

/**
 * Resolve the template to use for a given user + type.
 * Priority: user template → admin template → null (no template).
 */
export async function resolve(
  userId: string,
  type: TemplateType
): Promise<ITemplate | null> {
  const user = await getForUser(userId, type);
  if (user) return user;
  return getAdmin(type);
}

/** Remove a user's own template (or admin template when userId is null). */
export async function deleteTemplate(
  userId: string | null,
  type: TemplateType
): Promise<boolean> {
  await connectDB();
  const result = await Template.deleteOne({
    userId: userId ? new mongoose.Types.ObjectId(userId) : null,
    type,
  });
  return result.deletedCount > 0;
}

/** List meta (no fileData) for a user's templates. */
export async function listForUser(userId: string): Promise<TemplateMeta[]> {
  await connectDB();
  const docs = await Template.find(
    { userId: new mongoose.Types.ObjectId(userId) },
    { fileData: 0 }
  );
  return docs.map(toMeta);
}

/** List meta for admin (global) templates. */
export async function listAdmin(): Promise<TemplateMeta[]> {
  await connectDB();
  const docs = await Template.find({ userId: null }, { fileData: 0 });
  return docs.map(toMeta);
}
