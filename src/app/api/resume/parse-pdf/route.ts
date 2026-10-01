import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireApprovedApiUser } from "@/lib/api-access";
import { consume, rateLimitResponseInit } from "@/lib/rate-limit";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const access = await requireApprovedApiUser();
  if (!access.ok) return access.response;

  // formData() buffers the whole body, so refuse an oversized upload from its
  // declared length first. The file.size check below still covers a missing
  // or false header.
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_FILE_SIZE + 64 * 1024) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 5 MB." },
      { status: 413 }
    );
  }

  const limit = await consume(access.user._id.toString(), "resume-parse");
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads in a row. Try again shortly." },
      rateLimitResponseInit(limit.retryAfterSeconds)
    );
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
