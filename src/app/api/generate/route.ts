import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import anthropic from "@/lib/anthropic";
import { callStructured } from "@/lib/ai";
import * as users from "@/lib/repositories/users";
import * as jobs from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import * as documents from "@/lib/repositories/documents";
import type { DocumentType } from "@/lib/repositories/documents";
import * as templates from "@/lib/repositories/templates";
import type { TemplateType } from "@/lib/repositories/templates";
import { computeSlotFill } from "@/lib/export/from-template";
import {
  checkBudget,
  addSpend,
  calculateCost,
  QuotaExceededError,
} from "@/lib/usage";
import {
  buildResumeTailorPrompt,
  buildCoverLetterPrompt,
  buildJDAnalysisPrompt,
} from "@/lib/prompts";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;

const jdAnalysisSchema = z.record(z.string(), z.unknown());

const requestSchema = z.object({
  jobId: z.string().min(1),
  type: z.enum(["resume", "cover_letter", "jd_analysis"]),
  resumeId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  // 1. Auth check
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  const { jobId, type, resumeId } = parseResult.data;

  // 3. Look up the user (Mongo, not Clerk)
  const user = await users.getByClerkId(clerkUserId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userIdStr = (user._id as { toString(): string }).toString();

  // 4. Look up the job (with userId scoping)
  const job = await jobs.getById(userIdStr, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // 5. Look up the resume (only for resume + cover_letter; jd_analysis does not need one)
  let resume: Awaited<ReturnType<typeof resumes.getById>> = null;
  if (type === "resume" || type === "cover_letter") {
    if (resumeId) {
      resume = await resumes.getById(userIdStr, resumeId);
      if (!resume) {
        return NextResponse.json(
          { error: "Selected resume not found" },
          { status: 404 }
        );
      }
    } else {
      resume = await resumes.getDefault(userIdStr);
      if (!resume) {
        return NextResponse.json(
          {
            error: "NO_RESUME",
            message: "Save a base resume first to use this feature.",
          },
          { status: 400 }
        );
      }
    }
  }

  // 6. Check budget before calling Anthropic.
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
    console.error("[generate] budget check failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // 7. Branch on type. Cost is recorded inside each handler after tokens are known.
  try {
    if (type === "jd_analysis") {
      return await handleJDAnalysis({ userIdStr, jobId, job });
    } else {
      // Resume tailor or cover letter — both stream
      return await handleStreamingGeneration({
        userIdStr,
        jobId,
        type,
        job,
        resume: resume!, // safe: we returned above if type needs resume and resume was null
      });
    }
  } catch (err) {
    console.error("[generate] generation failed:", err);
    return NextResponse.json(
      { error: "Generation failed." },
      { status: 500 }
    );
  }
}

// ─── JD analysis: non-streaming, structured JSON ──────────────────────

async function handleJDAnalysis(args: {
  userIdStr: string;
  jobId: string;
  job: { jobDescription?: string | null };
}) {
  const { userIdStr, jobId, job } = args;

  if (!job.jobDescription || job.jobDescription.trim().length < 50) {
    return NextResponse.json(
      {
        error: "NO_JOB_DESCRIPTION",
        message:
          "Save a job description on this job before running JD analysis.",
      },
      { status: 400 }
    );
  }

  const { system, userMessage } = buildJDAnalysisPrompt({
    jobDescription: job.jobDescription,
  });

  let parsed: Record<string, unknown>;
  let inputTokens: number;
  let outputTokens: number;

  try {
    const result = await callStructured(
      { system, userMessage, model: MODEL, maxTokens: MAX_TOKENS },
      jdAnalysisSchema
    );
    parsed = result.data;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
  } catch (err) {
    console.error("[generate] JD analysis parse failed:", err);
    return NextResponse.json(
      { error: "Failed to parse AI response as JSON. Please try again." },
      { status: 502 }
    );
  }

  const cost = calculateCost(MODEL, inputTokens, outputTokens);
  await addSpend(userIdStr, "aiGeneration", cost).catch((err) => console.error("[addSpend failed]", err));

  await documents.upsert(userIdStr, {
    jobId,
    type: "jd_analysis" as DocumentType,
    content: JSON.stringify(parsed),
    aiModel: MODEL,
    inputTokens,
    outputTokens,
  });

  return NextResponse.json({ analysis: parsed });
}

// ─── Streaming generation: resume tailor + cover letter ─────────────

async function handleStreamingGeneration(args: {
  userIdStr: string;
  jobId: string;
  type: "resume" | "cover_letter";
  job: {
    company: string;
    role: string;
    location?: string | null;
    jobDescription?: string | null;
  };
  resume: { _id: string; content: string };
}) {
  const { userIdStr, jobId, type, job, resume } = args;
  const resumeIdStr = resume._id;

  // Build the prompt
  const built =
    type === "resume"
      ? buildResumeTailorPrompt({
          baseResume: resume.content,
          job: {
            company: job.company,
            role: job.role,
            location: job.location,
            jobDescription: job.jobDescription,
          },
        })
      : buildCoverLetterPrompt({
          baseResume: resume.content,
          job: {
            company: job.company,
            role: job.role,
            location: job.location,
            jobDescription: job.jobDescription,
          },
        });

  // Open the Anthropic stream
  const anthropicStream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: built.system,
    messages: [{ role: "user", content: built.userMessage }],
  });

  // Build a ReadableStream that pipes text deltas to the client
  const encoder = new TextEncoder();
  let fullText = "";
  let streamErrored = false;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Listen for text deltas
        anthropicStream.on("text", (textDelta: string) => {
          fullText += textDelta;
          controller.enqueue(encoder.encode(textDelta));
        });

        // Wait for completion
        const finalMessage = await anthropicStream.finalMessage();
        const finalInputTokens = finalMessage.usage.input_tokens;
        const finalOutputTokens = finalMessage.usage.output_tokens;

        // Record actual cost now that we have token counts
        const cost = calculateCost(MODEL, finalInputTokens, finalOutputTokens);
        await addSpend(userIdStr, "aiGeneration", cost).catch((err) => console.error("[addSpend failed]", err));

        // Save the document AFTER streaming completes
        const savedDoc = await documents.upsert(userIdStr, {
          jobId,
          type,
          content: fullText,
          aiModel: MODEL,
          inputTokens: finalInputTokens,
          outputTokens: finalOutputTokens,
          resumeIdUsed: resumeIdStr,
        });

        // Fire-and-forget: pre-compute DOCX slot-fill while user reads the preview.
        // When the user clicks Download the cache will already be ready — zero AI latency.
        precomputeDocxCache(
          savedDoc._id,
          fullText,
          userIdStr,
          type as TemplateType
        ).catch((err) =>
          console.error("[generate] slot-fill pre-compute failed:", err)
        );

        controller.close();
      } catch (err) {
        streamErrored = true;
        console.error("[generate] streaming error:", err);
        // Cost is only recorded after finalMessage() resolves; if we errored
        // before that, no cost was recorded — nothing to refund.
        controller.error(err);
      }
    },
    cancel() {
      // Client disconnected mid-stream. Cost is recorded only after
      // finalMessage() resolves (inside start()), so if we cancel before
      // that, no cost is charged. No action needed here.
      void streamErrored; // suppress unused-variable lint
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ─── DOCX slot-fill pre-computation ──────────────────────────────────────────

/**
 * Runs in the background after generation completes.
 * Computes the DOCX slot-fill output (haiku call) and stores it on the Document
 * so the export route can apply it instantly without another AI call.
 */
async function precomputeDocxCache(
  docId: string,
  content: string,
  userId: string,
  type: TemplateType
): Promise<void> {
  const adminTemplate = await templates.get(type);
  if (!adminTemplate) return;

  const docType = type as "resume" | "cover_letter";
  const result = await computeSlotFill(adminTemplate.fileData as Buffer, content, docType);

  // Track cost of this background Haiku call regardless of whether the fill succeeded
  const haikuCost = calculateCost(
    "claude-haiku-4-5-20251001",
    result.inputTokens ?? 0,
    result.outputTokens ?? 0
  );
  await addSpend(userId, "aiGeneration", haikuCost).catch((err) => console.error("[addSpend failed]", err));

  if (!result.valid) return;

  await documents.setDocxCache(
    docId,
    (adminTemplate._id as { toString(): string }).toString(),
    result.output
  );
}
