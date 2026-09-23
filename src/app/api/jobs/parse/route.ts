import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { callMeteredStructured } from "@/lib/ai-execution";
import * as users from "@/lib/repositories/users";
import * as resumes from "@/lib/repositories/resumes";
import { QuotaExceededError } from "@/lib/usage";
import { buildJobParsePrompt } from "@/lib/prompts";
import { computeFitScore } from "@/lib/fit-score";
import { jdAnalysisSchema, type JDAnalysis } from "@/lib/job-analysis";
import { consume, rateLimitResponseInit } from "@/lib/rate-limit";
import { isDemoUser, withDemoLatency } from "@/lib/demo";
import { demoAnalysis, demoParsedJob } from "@/lib/demo-fixtures";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 3072;

const requestSchema = z.object({
  text: z.string().min(50, "Paste at least 50 characters of job posting text.").max(50000),
});

export type ParsedJobFields = {
  company: string | null;
  role: string | null;
  location: string | null;
  salary: string | null;
  description: string | null;
};

const parsedSchema = z.object({
  company: z.string().nullable(),
  role: z.string().nullable(),
  location: z.string().nullable(),
  salary: z.string().nullable(),
  description: z.string().nullable(),
  analysis: jdAnalysisSchema,
});

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

  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0].message },
      { status: 400 }
    );
  }
  const { text } = parseResult.data;

  const user = await users.getByClerkId(clerkUserId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userIdStr = (user._id as { toString(): string }).toString();

  const limit = await consume(userIdStr, "jobs-parse");
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many imports in a row. Try again shortly." },
      rateLimitResponseInit(limit.retryAfterSeconds)
    );
  }

  if (isDemoUser(user)) {
    const fields = demoParsedJob();
    const analysis = demoAnalysis({
      _id: "demo",
      company: fields.company ?? "Example Corp",
      role: fields.role ?? "Senior Full Stack Engineer",
    });
    const defaultResume = await resumes.getDefault(userIdStr);
    const fitScore = defaultResume
      ? computeFitScore({
          resumeText: defaultResume.content,
          requiredSkills: analysis.requiredSkills,
          niceToHaves: analysis.niceToHaves,
          keywordsForResume: analysis.keywordsForResume,
        })
      : null;

    return NextResponse.json(
      await withDemoLatency({
        fields,
        analysis: analysis satisfies JDAnalysis,
        fitScore,
        hasDefaultResume: !!defaultResume,
      })
    );
  }

  const { system, userMessage } = buildJobParsePrompt({ text });

  try {
    const result = await callMeteredStructured({
      userId: userIdStr,
      system,
      userMessage,
      model: MODEL,
      maxTokens: MAX_TOKENS,
      schema: parsedSchema,
      feature: "jobs_parse",
    });
    const { analysis, ...fields } = result.data;
    const defaultResume = await resumes.getDefault(userIdStr);
    const fitScore = defaultResume
      ? computeFitScore({
          resumeText: defaultResume.content,
          requiredSkills: analysis.requiredSkills,
          niceToHaves: analysis.niceToHaves,
          keywordsForResume: analysis.keywordsForResume,
        })
      : null;

    return NextResponse.json({
      fields,
      analysis: analysis satisfies JDAnalysis,
      fitScore,
      hasDefaultResume: !!defaultResume,
    });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: err.message },
        { status: 429 }
      );
    }
    console.error("[jobs/parse] parse failed:", err);
    return NextResponse.json(
      { error: "Failed to parse the job posting. Please try again." },
      { status: 502 }
    );
  }
}
