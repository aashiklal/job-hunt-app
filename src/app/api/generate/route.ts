import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as users from "@/lib/repositories/users";
import { QuotaExceededError } from "@/lib/usage";
import {
  generateForJob,
  JobGenerationError,
  jobGenerationRequestSchema,
  STREAMED_TYPES,
} from "@/lib/job-ai-generation";

type ErrorPayload = {
  status: number;
  body: Record<string, unknown>;
};

/** Maps a generation failure to the status and body both response modes share. */
function toErrorPayload(err: unknown): ErrorPayload {
  if (err instanceof QuotaExceededError) {
    return {
      status: 429,
      body: {
        error: "QUOTA_EXCEEDED",
        message: err.message,
        limit: err.limit,
        used: err.used,
        periodEndsAt: err.periodEndsAt.toISOString(),
        budgetScope: err.budgetScope,
      },
    };
  }
  if (err instanceof JobGenerationError) {
    return { status: err.status, body: { error: err.code, message: err.message } };
  }
  console.error("[generate] generation failed:", err);
  return { status: 500, body: { error: "Generation failed." } };
}

/**
 * Streams a resume or cover letter as newline-delimited JSON:
 *   {"type":"partial","markdown":...}   repeated as the document fills in
 *   {"type":"done",documentId,content,structuredContent}
 *   {"type":"error",status,error,message,...}   if generation fails mid-stream
 * The HTTP status is always 200 once the stream opens; errors travel in-band.
 */
function streamGeneration(
  req: NextRequest,
  user: Parameters<typeof generateForJob>[0],
  input: Parameters<typeof generateForJob>[1]
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };

      try {
        const result = await generateForJob(user, input, {
          signal: req.signal,
          onPartial: (markdown) => send({ type: "partial", markdown }),
        });
        if (result.kind === "structured_document") {
          send({
            type: "done",
            documentId: result.documentId,
            content: result.content,
            structuredContent: result.structuredContent,
          });
        }
      } catch (err) {
        if (!req.signal.aborted) {
          const { status, body } = toErrorPayload(err);
          send({ type: "error", status, ...body });
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // Client already disconnected.
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parseResult = jobGenerationRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const user = await users.getByClerkId(clerkUserId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (STREAMED_TYPES.has(parseResult.data.type)) {
    return streamGeneration(req, user, parseResult.data);
  }

  try {
    const result = await generateForJob(user, parseResult.data);
    if (result.kind === "jd_analysis") {
      return NextResponse.json({ analysis: result.analysis });
    }
    if (result.kind === "interview_prep") {
      return NextResponse.json({ prep: result.prep });
    }
    if (result.kind === "outreach") {
      return NextResponse.json({ content: result.content });
    }
    return NextResponse.json({
      documentId: result.documentId,
      content: result.content,
      structuredContent: result.structuredContent,
    });
  } catch (err) {
    const { status, body: errorBody } = toErrorPayload(err);
    return NextResponse.json(errorBody, { status });
  }
}
