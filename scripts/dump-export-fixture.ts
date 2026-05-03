import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { mkdir, writeFile } from "fs/promises";
import mongoose from "mongoose";

const documentId = process.argv[2];
const outDir = process.argv[3] ?? `tmp/fixtures/${documentId ?? "missing"}`;

if (!documentId) {
  console.error("Error: documentId argument is required.");
  console.error("Usage: npx tsx scripts/dump-export-fixture.ts <documentId> [outDir]");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is not set in .env.local");
  process.exit(1);
}

const DocumentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId },
    jobId: { type: mongoose.Schema.Types.ObjectId },
    type: { type: String },
    content: { type: String },
    structuredContent: { type: mongoose.Schema.Types.Mixed },
    aiModel: { type: String },
    inputTokens: { type: Number },
    outputTokens: { type: Number },
    resumeIdUsed: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true, strict: false }
);

const TemplateSchema = new mongoose.Schema(
  {
    type: { type: String },
    fileData: { type: Buffer },
    fileName: { type: String },
    themeAnalysis: { type: mongoose.Schema.Types.Mixed },
    pixelThemeMap: { type: mongoose.Schema.Types.Mixed },
    styleRoleMap: { type: mongoose.Schema.Types.Mixed },
    mappingModel: { type: String },
    mappingVersion: { type: Number },
    analysisWarnings: { type: [String] },
    uploadedAt: { type: Date },
  },
  { strict: false }
);

const DocModel =
  mongoose.models.Document ?? mongoose.model("Document", DocumentSchema);
const TemplateModel =
  mongoose.models.Template ?? mongoose.model("Template", TemplateSchema);

async function main() {
  await mongoose.connect(MONGODB_URI as string, { dbName: "jobhunt" });

  const doc = await DocModel.findById(documentId).lean();
  if (!doc) {
    console.error(`Document ${documentId} not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const docType = (doc as { type?: string }).type;
  if (docType !== "resume" && docType !== "cover_letter") {
    console.error(
      `Document type "${docType}" is not exportable. Expected "resume" or "cover_letter".`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const template = await TemplateModel.findOne({ type: docType }).lean();
  if (!template) {
    console.warn(`No admin template for type "${docType}" — fixture will lack template.`);
  }

  await mkdir(resolve(process.cwd(), outDir), { recursive: true });

  const docPayload = {
    _id: String((doc as { _id: { toString(): string } })._id),
    userId: String((doc as { userId: { toString(): string } }).userId ?? ""),
    jobId: String((doc as { jobId: { toString(): string } }).jobId ?? ""),
    type: docType,
    content: (doc as { content?: string }).content ?? "",
    structuredContent: (doc as { structuredContent?: unknown }).structuredContent ?? null,
    aiModel: (doc as { aiModel?: string }).aiModel ?? null,
    createdAt: (doc as { createdAt?: Date }).createdAt ?? null,
    updatedAt: (doc as { updatedAt?: Date }).updatedAt ?? null,
  };
  await writeFile(
    resolve(process.cwd(), outDir, "document.json"),
    JSON.stringify(docPayload, null, 2)
  );

  if (template) {
    const fileData = (template as { fileData?: unknown }).fileData;
    let written = false;
    if (fileData && Buffer.isBuffer(fileData)) {
      await writeFile(resolve(process.cwd(), outDir, "template.docx"), fileData);
      written = true;
    } else if (
      fileData &&
      Buffer.isBuffer((fileData as { buffer?: Buffer }).buffer)
    ) {
      const inner = (fileData as { buffer: Buffer }).buffer;
      await writeFile(resolve(process.cwd(), outDir, "template.docx"), inner);
      written = true;
    } else if (fileData && fileData instanceof Uint8Array) {
      await writeFile(
        resolve(process.cwd(), outDir, "template.docx"),
        Buffer.from(fileData)
      );
      written = true;
    }
    if (!written) {
      console.warn(
        `Template fileData missing or unrecognized; type=${(fileData as { _bsontype?: string })?._bsontype ?? typeof fileData}`
      );
    }

    const meta = {
      _id: String((template as { _id: { toString(): string } })._id),
      type: (template as { type?: string }).type,
      fileName: (template as { fileName?: string }).fileName,
      uploadedAt: (template as { uploadedAt?: Date }).uploadedAt,
      mappingModel: (template as { mappingModel?: string }).mappingModel,
      mappingVersion: (template as { mappingVersion?: number }).mappingVersion,
      analysisWarnings: (template as { analysisWarnings?: string[] }).analysisWarnings ?? [],
      themeAnalysis: (template as { themeAnalysis?: unknown }).themeAnalysis ?? null,
      pixelThemeMap: (template as { pixelThemeMap?: unknown }).pixelThemeMap ?? null,
      styleRoleMap: (template as { styleRoleMap?: unknown }).styleRoleMap ?? null,
    };
    await writeFile(
      resolve(process.cwd(), outDir, "template-meta.json"),
      JSON.stringify(meta, null, 2)
    );
  }

  await mongoose.disconnect();
  console.log(`Fixture written to ${outDir}/`);
  console.log(`  document.json  (type=${docType})`);
  if (template) {
    console.log(`  template.docx`);
    console.log(`  template-meta.json`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
