import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import anthropic from "@/lib/anthropic";
import * as users from "@/lib/repositories/users";
import * as jobs from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import * as documents from "@/lib/repositories/documents";
import type { DocumentType } from "@/lib/repositories/documents";
import {
  checkAndIncrementUsage,
  decrementUsage,
  QuotaExceededError,
} from "@/lib/usage";
import {
  buildResumeTailorPrompt,
  buildCoverLetterPrompt,
  buildJDAnalysisPrompt,
} from "@/lib/prompts";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;

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

  // 6. Check and increment usage. This is the gate. After this point, the user is "charged".
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
    console.error("[generate] usage check failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // 7. Branch on type
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
    // If anything fails AFTER the increment, refund the user.
    await decrementUsage(userIdStr, "aiGeneration").catch(() => {
      // best-effort; if decrement fails, log and move on
    });
    console.error("[generate] generation failed:", err);
    return NextResponse.json(
      { error: "Generation failed. Your usage has been refunded." },
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
    // Refund and return — JD analysis on an empty JD is pointless
    await decrementUsage(userIdStr, "aiGeneration").catch(() => {});
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

  // Try once, retry once on JSON parse failure with a stricter reminder
  let parsed: unknown = null;
  let inputTokens = 0;
  let outputTokens = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system:
        attempt === 0
          ? system
          : `${system}\n\nIMPORTANT: Your previous response was not valid JSON. Respond with ONLY the JSON object, no markdown, no code fences, no commentary.`,
      messages: [{ role: "user", content: userMessage }],
    });

    // Sum tokens across both attempts (we charge for both even if first fails)
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    // Extract text from the response
    const textBlock = response.content.find((c) => c.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      continue;
    }
    const lastRawResponse = textBlock.text;

    // Try to parse, stripping any code fences just in case
    const cleaned = lastRawResponse
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "");

    try {
      parsed = JSON.parse(cleaned);
      break;
    } catch {
      // try again with stricter reminder
      continue;
    }
  }

  if (!parsed) {
    // Both attempts failed. Refund and surface error.
    await decrementUsage(userIdStr, "aiGeneration").catch(() => {});
    return NextResponse.json(
      { error: "Failed to parse AI response as JSON. Please try again." },
      { status: 502 }
    );
  }

  // Save the document
  await documents.create(userIdStr, {
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
  resume: { _id: unknown; content: string };
}) {
  const { userIdStr, jobId, type, job, resume } = args;
  const resumeIdStr = (resume._id as { toString(): string }).toString();

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

        // Save the document AFTER streaming completes
        await documents.create(userIdStr, {
          jobId,
          type,
          content: fullText,
          aiModel: MODEL,
          inputTokens: finalInputTokens,
          outputTokens: finalOutputTokens,
          resumeIdUsed: resumeIdStr,
        });

        controller.close();
      } catch (err) {
        streamErrored = true;
        console.error("[generate] streaming error:", err);
        // Refund the user since the generation failed
        await decrementUsage(userIdStr, "aiGeneration").catch(() => {});
        controller.error(err);
      }
    },
    cancel() {
      // Client disconnected mid-stream. Refund the user.
      // Note: this fires when the client aborts (e.g. user closes the tab).
      // The fullText accumulated so far is partial and we do NOT save it.
      if (!streamErrored) {
        decrementUsage(userIdStr, "aiGeneration").catch(() => {});
      }
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
