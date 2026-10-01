import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { startTestMongo, stopTestMongo, clearTestMongo } from "@/test/mongo";
import Doc from "@/lib/models/Document";
import { setLatexCache, getLatexCache } from "@/lib/repositories/documents";

/**
 * The export route reuses the cached LaTeX only while latexBodyCachedAt is
 * newer than the document's updatedAt. Writing the cache used to bump
 * updatedAt as well (timestamps: true), so the cache could never be valid:
 * every .tex download and copy called the model again and charged credits.
 */

beforeAll(async () => {
  await startTestMongo();
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  await clearTestMongo();
});

describe("setLatexCache", () => {
  it("leaves the cache newer than the document so the export can reuse it", async () => {
    const userId = new mongoose.Types.ObjectId();
    const doc = await Doc.create({
      userId,
      jobId: new mongoose.Types.ObjectId(),
      type: "resume",
      content: "# Resume",
      aiModel: "claude-sonnet-4-5",
    });

    await new Promise((r) => setTimeout(r, 5));
    await setLatexCache(userId.toString(), doc._id.toString(), "\\section{x}");

    const cache = await getLatexCache(userId.toString(), doc._id.toString());
    const stored = await Doc.findById(doc._id).lean();

    expect(cache?.latexBodyCache).toBe("\\section{x}");
    expect(cache!.latexBodyCachedAt!.getTime()).toBeGreaterThan(
      new Date(stored!.updatedAt).getTime()
    );
  });
});
