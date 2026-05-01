import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import anthropic from "@/lib/anthropic";
import * as users from "@/lib/repositories/users";
import * as jobs from "@/lib/repositories/jobs";
import * as templates from "@/lib/repositories/templates";
import * as documents from "@/lib/repositories/documents";
import type { DocumentType } from "@/lib/repositories/documents";
import { exportDocument } from "@/lib/export";
import { checkBudget, addSpend, calculateCost, QuotaExceededError } from "@/lib/usage";
import {
  buildResumeExtractionPrompt,
  buildCoverLetterExtractionPrompt,
} from "@/lib/prompts";

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

  const cachedTemplateData =
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

  // Template path — always uses fillTemplate (marker-based).
  // Budget check guards the Haiku extraction call needed when cache is cold.
  if (!cachedTemplateData) {
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

  // On-demand extraction when the precomputed cache is cold.
  // The marker-based fillTemplate cannot work without structured data —
  // falling through to injectContent would leave {{MARKER}} text visible.
  let templateData = cachedTemplateData;
  if (!templateData) {
    const HAIKU_MODEL = "claude-haiku-4-5-20251001";
    try {
      let system: string;
      let userMessage: string;

      if (type === "resume") {
        ({ system, userMessage } = buildResumeExtractionPrompt({ markdown: content }));
      } else {
        const candidateName =
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.email.split("@")[0];
        let company = "";
        let role = "";
        if (jobId) {
          const job = await jobs.getById(userIdStr, jobId);
          if (job) { company = job.company; role = job.role; }
        }
        ({ system, userMessage } = buildCoverLetterExtractionPrompt({
          markdown: content,
          company,
          role,
          candidateName,
        }));
      }

      const response = await anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: userMessage }],
      });

      const cost = calculateCost(
        HAIKU_MODEL,
        response.usage.input_tokens,
        response.usage.output_tokens
      );
      await addSpend(userIdStr, "aiGeneration", cost).catch((err) =>
        console.error("[addSpend failed]", err)
      );

      const raw =
        response.content[0].type === "text" ? response.content[0].text.trim() : "";
      const jsonMatch = /\{[\s\S]*\}/.exec(raw);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        templateData = data;
        // Cache for future exports (fire-and-forget)
        if (storedDoc && templateId) {
          documents
            .setTemplateData(storedDoc._id, templateId, data)
            .catch((err) => console.error("[export] setTemplateData failed:", err));
        }
      }
    } catch (err) {
      console.error("[generate/export] on-demand extraction failed:", err);
      // templateData stays null — exportDocument falls back to injectContent
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
