import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

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

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "File must be a PDF." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const cleaned = text.trim();

    if (cleaned.length < 50) {
      return NextResponse.json(
        {
          error:
            "Could not extract meaningful text from this PDF. It may be a scanned image. Try pasting your resume instead.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: cleaned });
  } catch (err) {
    console.error("[parse-pdf]", err);
    return NextResponse.json(
      {
        error:
          "Failed to parse PDF. The file may be corrupted or password protected. Try pasting your resume instead.",
      },
      { status: 500 }
    );
  }
}
