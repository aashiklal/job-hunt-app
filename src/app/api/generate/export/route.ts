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
import { generatePDF } from "@/lib/export/to-pdf";
import { generateDOCX } from "@/lib/export/to-docx";
import { extractDocxStyles } from "@/lib/export/extract-styles";
import { DEFAULT_STYLE_HINTS } from "@/lib/export/types";

const schema = z.object({
  content: z.string().min(1).max(100000),
  format: z.enum(["pdf", "docx"]),
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

  const { content, format, type, jobId, filename = "document" } = parsed.data;

  const user = await users.getByClerkId(clerkUserId);
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const userIdStr = (user._id as { toString(): string }).toString();
  const docType = type as TemplateType;

  // Fetch user template, admin template, and (if jobId provided) the stored document in parallel
  const [userTemplate, adminTemplate, storedDoc] = await Promise.all([
    templates.getForUser(userIdStr, docType),
    templates.getAdmin(docType),
    jobId
      ? documents.getLatestForJob(userIdStr, jobId, type as DocumentType)
      : Promise.resolve(null),
  ]);

  try {
    if (format === "docx") {
      let buffer: Buffer;
      let fallback: "none" | "admin" | "generic" = "none";

      // ── Try cache first ────────────────────────────────────────────────────
      const cache = storedDoc?.docxSlotCache;
      if (cache) {
        const cachedTemplate =
          userTemplate?._id?.toString() === cache.templateId
            ? userTemplate
            : adminTemplate?._id?.toString() === cache.templateId
            ? adminTemplate
            : null;

        if (cachedTemplate && cache.cachedAt >= cachedTemplate.uploadedAt) {
          // Cache hit — no AI call needed
          buffer = await applyToTemplate(cachedTemplate.fileData as Buffer, cache.output);

          // If the cache was built from the admin template but user has their own,
          // the user template was invalid — surface the fallback notification
          if (cachedTemplate === adminTemplate && userTemplate) fallback = "admin";

          const headers: Record<string, string> = {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="${filename}.docx"`,
            "Cache-Control": "no-store",
          };
          if (fallback !== "none") headers["X-Template-Fallback"] = fallback;
          return new Response(new Uint8Array(buffer), { headers });
        }
      }

      // ── Cache miss — compute fresh ─────────────────────────────────────────
      if (userTemplate) {
        const result = await injectContent(
          userTemplate.fileData as Buffer,
          content,
          type as "resume" | "cover_letter"
        );

        if (result.valid) {
          buffer = result.buffer;
        } else if (adminTemplate) {
          const adminResult = await injectContent(
            adminTemplate.fileData as Buffer,
            content,
            type as "resume" | "cover_letter"
          );
          buffer = adminResult.buffer;
          fallback = "admin";
        } else {
          buffer = await generateDOCX(content);
          fallback = "generic";
        }
      } else if (adminTemplate) {
        const result = await injectContent(
          adminTemplate.fileData as Buffer,
          content,
          type as "resume" | "cover_letter"
        );
        buffer = result.buffer;
      } else {
        buffer = await generateDOCX(content);
      }

      const headers: Record<string, string> = {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
        "Cache-Control": "no-store",
      };
      if (fallback !== "none") headers["X-Template-Fallback"] = fallback;
      return new Response(new Uint8Array(buffer), { headers });
    } else {
      // PDF export — use best available template for style hints
      const pdfTemplate = userTemplate ?? adminTemplate;
      let buffer: Buffer;

      if (pdfTemplate) {
        const hints = await extractDocxStyles(pdfTemplate.fileData as Buffer).catch(
          () => DEFAULT_STYLE_HINTS
        );
        buffer = await generatePDF(content, hints);
      } else {
        buffer = await generatePDF(content);
      }

      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
  } catch (err) {
    console.error("[generate/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
