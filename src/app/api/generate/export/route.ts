import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import * as users from "@/lib/repositories/users";
import * as templates from "@/lib/repositories/templates";
import * as documents from "@/lib/repositories/documents";
import type { TemplateType } from "@/lib/repositories/templates";
import type { DocumentType } from "@/lib/repositories/documents";
import { applyToTemplate, injectContent } from "@/lib/export/from-template";
import { generateDOCX } from "@/lib/export/to-docx";
import { checkAndIncrementUsage, decrementUsage, QuotaExceededError } from "@/lib/usage";

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
  const docType = type as TemplateType;

  const [adminTemplate, storedDoc] = await Promise.all([
    templates.get(docType),
    jobId
      ? documents.getLatestForJob(userIdStr, jobId, type as DocumentType)
      : Promise.resolve(null),
  ]);

  // ── Try cache first ──────────────────────────────────────────────────────
  const cache = storedDoc?.docxSlotCache;
  if (cache && adminTemplate && adminTemplate._id?.toString() === cache.templateId) {
    if (cache.cachedAt >= adminTemplate.uploadedAt) {
      try {
        const buffer = await applyToTemplate(adminTemplate.fileData as Buffer, cache.output);
        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="${filename}.docx"`,
            "Cache-Control": "no-store",
          },
        });
      } catch (err) {
        console.error("[generate/export] cache hit apply failed:", err);
        // Fall through to fresh generation below
      }
    }
  }

  // ── Cache miss ────────────────────────────────────────────────────────────
  if (!adminTemplate) {
    // No template at all — generic DOCX, no AI call, no quota
    try {
      const buffer = await generateDOCX(content);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${filename}.docx"`,
          "Cache-Control": "no-store",
          "X-Template-Fallback": "generic",
        },
      });
    } catch (err) {
      console.error("[generate/export] generateDOCX failed:", err);
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
  }

  // Admin template exists — this path calls Anthropic; gate behind quota
  try {
    await checkAndIncrementUsage(userIdStr, "aiGeneration");
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
    console.error("[generate/export] usage check failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  try {
    const result = await injectContent(
      adminTemplate.fileData as Buffer,
      content,
      type as "resume" | "cover_letter"
    );
    const buffer = result.buffer;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    await decrementUsage(userIdStr, "aiGeneration").catch(() => {});
    console.error("[generate/export] injectContent failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
