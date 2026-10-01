import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callMeteredStructured, chargeFixtureCredits } from "@/lib/ai-execution";
import { requireApprovedApiUser } from "@/lib/api-access";
import * as resumes from "@/lib/repositories/resumes";
import { aiLimitResponse } from "@/lib/ai-limit-response";
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
  const access = await requireApprovedApiUser();
  if (!access.ok) return access.response;
  const { user } = access;

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

  const userIdStr = (user._id as { toString(): string }).toString();

  const limit = await consume(userIdStr, "jobs-parse");
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many imports in a row. Try again shortly." },
      rateLimitResponseInit(limit.retryAfterSeconds)
    );
  }

  if (isDemoUser(user)) {
    // Fixture output, but charged like the live import so the demo's balance
    // behaves like the real app.
    try {
      const result = await chargeFixtureCredits(userIdStr, "jobs_parse", async () => {
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
        return {
          fields,
          analysis: analysis satisfies JDAnalysis,
          fitScore,
          hasDefaultResume: !!defaultResume,
        };
      });
      return NextResponse.json(await withDemoLatency(result));
    } catch (err) {
      const limited = aiLimitResponse(err);
      if (limited) return limited;
      console.error("[jobs/parse] demo parse failed:", err);
      return NextResponse.json(
        { error: "Failed to parse the job posting. Please try again." },
        { status: 502 }
      );
    }
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
    const limited = aiLimitResponse(err);
    if (limited) return limited;
    console.error("[jobs/parse] parse failed:", err);
    return NextResponse.json(
      { error: "Failed to parse the job posting. Please try again." },
      { status: 502 }
    );
  }
}
