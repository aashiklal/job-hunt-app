import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as users from "@/lib/repositories/users";
import { aiLimitResponse } from "@/lib/ai-limit-response";
import { consume, rateLimitResponseInit } from "@/lib/rate-limit";
import {
  generateForJob,
  JobGenerationError,
  jobGenerationRequestSchema,
} from "@/lib/job-ai-generation";
import { isDemoExpired } from "@/lib/demo";

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
  if (isDemoExpired(user)) {
    return NextResponse.json({ error: "This demo has ended." }, { status: 401 });
  }

  const limit = await consume(user._id.toString(), "generate");
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Too many generations in a row. Try again shortly.",
      },
      rateLimitResponseInit(limit.retryAfterSeconds)
    );
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
    const limited = aiLimitResponse(err);
    if (limited) return limited;
    if (err instanceof JobGenerationError) {
      return NextResponse.json(
        {
          error: err.code,
          message: err.message,
        },
        { status: err.status }
      );
    }
    console.error("[generate] generation failed:", err);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
