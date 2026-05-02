import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import * as users from "@/lib/repositories/users";
import * as templates from "@/lib/repositories/templates";
import * as documents from "@/lib/repositories/documents";
import { exportDocument } from "@/lib/export";

const querySchema = z.object({
  format: z.enum(["docx"]).default("docx"),
  filename: z.string().min(1).max(200).optional(),
});

function defaultFilename(type: string): string {
  return type === "cover_letter" ? "cover-letter" : "tailored-resume";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await users.getByClerkId(clerkUserId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;
  const userIdStr = (user._id as { toString(): string }).toString();
  const doc = await documents.getById(userIdStr, id);
  if (!doc || (doc.type !== "resume" && doc.type !== "cover_letter")) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const adminTemplate = await templates.get(doc.type);
  const templateId = adminTemplate
    ? (adminTemplate._id as { toString(): string }).toString()
    : null;
  const filename = parsed.data.filename ?? defaultFilename(doc.type);

  try {
    const { buffer, usedTheme } = await exportDocument({
      content: doc.content,
      type: doc.type,
      adminTemplate: adminTemplate && templateId
        ? {
            _id: templateId,
            fileData: adminTemplate.fileData as Buffer,
            uploadedAt: adminTemplate.uploadedAt,
            themeAnalysis: adminTemplate.themeAnalysis ?? null,
            pixelThemeMap: adminTemplate.pixelThemeMap ?? null,
            styleRoleMap: adminTemplate.styleRoleMap ?? null,
          }
        : null,
      structuredContent: doc.structuredContent ?? null,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
        "Cache-Control": "no-store",
        ...(usedTheme ? {} : { "X-Template-Fallback": "generic" }),
      },
    });
  } catch (err) {
    console.error("[documents/export] export failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
