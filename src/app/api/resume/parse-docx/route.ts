import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import mammoth from "mammoth";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
        { status: 413 }
      );
    }

    if (file.type !== DOCX_MIME && !file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json(
        { error: "File must be a .docx file." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // convertToMarkdown preserves headings and bullets, which helps AI tailoring.
    // The type declaration omits it (stale types), so cast through unknown to call it.
    // Fallback to raw text if markdown conversion fails on a malformed docx.
    const mammothAny = mammoth as unknown as {
      convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    let text: string;
    try {
      const result = await mammothAny.convertToMarkdown({ buffer });
      text = result.value;
    } catch {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    }

    const cleaned = text.trim();
    if (cleaned.length < 50) {
      return NextResponse.json(
        {
          error:
            "Could not extract meaningful text from this DOCX. Try pasting your resume instead.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: cleaned });
  } catch (err) {
    console.error("[parse-docx]", err);
    return NextResponse.json(
      {
        error:
          "Failed to parse DOCX. The file may be corrupted. Try pasting your resume instead.",
      },
      { status: 500 }
    );
  }
}
