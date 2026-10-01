import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { assertZipWithinLimits, ZipLimitError } from "@/lib/zip-limits";

async function zip(files: Record<string, string | Uint8Array>): Promise<Buffer> {
  const z = new JSZip();
  for (const [name, data] of Object.entries(files)) z.file(name, data);
  return z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("assertZipWithinLimits", () => {
  it("accepts an ordinary small archive", async () => {
    const buf = await zip({ "word/document.xml": "<w:document/>" });
    expect(() => assertZipWithinLimits(buf)).not.toThrow();
  });

  it("rejects an archive that inflates past the limit", async () => {
    // 25 MB of zeros compresses to a few tens of KB: the classic bomb shape
    // that passes an upload size check.
    const buf = await zip({ "word/document.xml": new Uint8Array(25 * 1024 * 1024) });
    expect(buf.length).toBeLessThan(1024 * 1024);
    expect(() => assertZipWithinLimits(buf)).toThrow(ZipLimitError);
  });

  it("counts the total across entries, not just the largest", async () => {
    const part = new Uint8Array(8 * 1024 * 1024);
    const buf = await zip({ a: part, b: part, c: part });
    expect(() => assertZipWithinLimits(buf)).toThrow(ZipLimitError);
  });

  it("rejects too many entries", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 20; i++) files[`f${i}`] = "x";
    const buf = await zip(files);
    expect(() => assertZipWithinLimits(buf, 1024 * 1024, 10)).toThrow(ZipLimitError);
  });

  it("rejects something that is not a ZIP", () => {
    expect(() => assertZipWithinLimits(Buffer.from("not a zip at all, just text"))).toThrow(
      ZipLimitError
    );
  });
});
