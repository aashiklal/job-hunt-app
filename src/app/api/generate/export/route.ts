import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import * as users from "@/lib/repositories/users";
import * as templates from "@/lib/repositories/templates";
import * as documents from "@/lib/repositories/documents";
import type { DocumentType } from "@/lib/repositories/documents";
import { exportDocument } from "@/lib/export";
import { checkBudget, addSpend, calculateCost, QuotaExceededError } from "@/lib/usage";

const schema = z.object({
  content: z.string().min(1).max(100000),
  format: z.enum(["docx"]),
  type: z.enum(["resume", "cover_letter"]).default("resume"),
  jobId: z.string().min(1).optional(),
  resumeId: z.string().min(1).optional(),
  filename: z.string().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { content, type, jobId, filename = "document" } = parsed.data;

  const user = await users.getByClerkId(clerkUserId);
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const userIdStr = (user._id as { toString(): string }).toString();

  const [adminTemplate, storedDoc] = await Promise.all([
    templates.get(type),
    jobId
      ? documents.getLatestForJob(userIdStr, jobId, type as DocumentType)
      : Promise.resolve(null),
  ]);

  const templateId = adminTemplate
    ? (adminTemplate._id as { toString(): string }).toString()
    : null;

  const templateData =
    adminTemplate && storedDoc && templateId
      ? await documents.getValidTemplateData(
          storedDoc._id,
          templateId,
          adminTemplate.uploadedAt
        )
      : null;

  const docsBinaryHeaders = {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${filename}.docx"`,
    "Cache-Control": "no-store",
  };

  // No template — generic DOCX, no AI call, no quota check
  if (!adminTemplate) {
    try {
      const { buffer } = await exportDocument({
        content,
        type,
        docId: storedDoc?._id ?? null,
        adminTemplate: null,
      });
      return new Response(new Uint8Array(buffer), {
        headers: { ...docsBinaryHeaders, "X-Template-Fallback": "generic" },
      });
    } catch (err) {
      console.error("[generate/export] export failed:", err);
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
  }

  // Template path — quota check only needed when AI will be called (no templateData cache)
  if (!templateData) {
    try {
      await checkBudget(userIdStr, "aiGeneration");
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            error: "QUOTA_EXCEEDED",
            message: err.message,
            limit: err.limit,
            used: err.used,
            periodEndsAt: err.periodEndsAt.toISOString(),
          },
          { status: 429 }
        );
      }
      console.error("[generate/export] budget check failed:", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }

  try {
    const { buffer, aiUsage } = await exportDocument({
      content,
      type,
      docId: storedDoc?._id ?? null,
      adminTemplate: {
        _id: templateId!,
        fileData: adminTemplate.fileData as Buffer,
        uploadedAt: adminTemplate.uploadedAt,
      },
      templateData,
    });

    if (aiUsage) {
      const cost = calculateCost(aiUsage.model, aiUsage.inputTokens, aiUsage.outputTokens);
      await addSpend(userIdStr, "aiGeneration", cost).catch((err) =>
        console.error("[addSpend failed]", err)
      );
    }

    return new Response(new Uint8Array(buffer), { headers: docsBinaryHeaders });
  } catch (err) {
    console.error("[generate/export] export failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
