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

/** Upsert the global (admin) template for the given type. */
export async function upsert(
  type: TemplateType,
  fileData: Buffer,
  fileName: string
): Promise<ITemplate> {
  await connectDB();
  const result = await Template.findOneAndUpdate(
    { type },
    { $set: { fileData, fileName, uploadedAt: new Date() } },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) throw new Error("Template upsert failed");
  return result;
}

/** Get the global (admin) template for the given type. */
export async function get(type: TemplateType): Promise<ITemplate | null> {
  await connectDB();
  return Template.findOne({ type });
}

/** Delete the global (admin) template for the given type. */
export async function deleteTemplate(type: TemplateType): Promise<boolean> {
  await connectDB();
  const result = await Template.deleteOne({ type });
  return result.deletedCount > 0;
}

/** List meta (no fileData) for all global templates. */
export async function list(): Promise<TemplateMeta[]> {
  await connectDB();
  const docs = await Template.find({}, { fileData: 0 });
  return docs.map(toMeta);
}
