import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { callStructured } from "@/lib/ai";
import { checkBudget, addSpend, calculateCost, QuotaExceededError } from "@/lib/usage";
import { buildSkillsGapPrompt } from "@/lib/prompts";
import * as users from "@/lib/repositories/users";
import * as jobs from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import * as documents from "@/lib/repositories/documents";

const MODEL = "claude-sonnet-4-5";

const skillsGapSchema = z.object({
  summary: z.string(),
  highPriority: z.array(
    z.object({ skill: z.string(), why: z.string(), howToLearn: z.string(), timeEstimate: z.string() })
  ),
  mediumPriority: z.array(
    z.object({ skill: z.string(), why: z.string(), howToLearn: z.string(), timeEstimate: z.string() })
  ),
  lowPriority: z.array(
    z.object({ skill: z.string(), why: z.string(), howToLearn: z.string(), timeEstimate: z.string() })
  ),
  quickWins: z.array(z.string()),
});

function skillInResume(skill: string, resumeText: string): boolean {
  return resumeText.toLowerCase().includes(skill.toLowerCase().trim());
}

export async function POST() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await users.getByClerkId(clerkUserId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userIdStr = (user._id as { toString(): string }).toString();

  const jobList = await jobs.list(userIdStr);

  const analysisDocs = await Promise.all(
    jobList.map((j) => documents.getLatestForJob(userIdStr, j._id, "jd_analysis"))
  );

  type Analysis = { requiredSkills?: string[]; niceToHaves?: string[] };
  const analyses: Analysis[] = [];
  for (const doc of analysisDocs) {
    if (!doc) continue;
    try {
      const parsed = JSON.parse(doc.content) as Analysis;
      if (Array.isArray(parsed.requiredSkills) || Array.isArray(parsed.niceToHaves)) {
        analyses.push(parsed);
      }
    } catch {
      // skip unparseable docs
    }
  }

  if (analyses.length < 2) {
    return NextResponse.json(
      { error: "Run JD Analysis on at least 2 jobs first." },
      { status: 400 }
    );
  }

  const resumeList = await resumes.list(userIdStr);
  const defaultResume = resumeList.find((r) => r.isDefault) ?? resumeList[0] ?? null;
  const resumeText = defaultResume?.content ?? "";

  const allRequired = [...new Set(analyses.flatMap((a) => a.requiredSkills ?? []))];
  const allNiceToHave = [...new Set(analyses.flatMap((a) => a.niceToHaves ?? []))];

  const missingRequired = allRequired.filter((s) => !skillInResume(s, resumeText));
  const missingNiceToHave = allNiceToHave.filter((s) => !skillInResume(s, resumeText));
  const appliedRoles = [...new Set(jobList.map((j) => j.role))];

  try {
    await checkBudget(userIdStr, "aiGeneration");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: err.message, limit: err.limit, used: err.used, periodEndsAt: err.periodEndsAt.toISOString() },
        { status: 429 }
      );
    }
    throw err;
  }

  try {
    const { system, userMessage } = buildSkillsGapPrompt({
      missingRequired,
      missingNiceToHave,
      resumeSkillsText: resumeText.slice(0, 1500),
      appliedRoles,
    });

    const { data, inputTokens, outputTokens } = await callStructured(
      { system, userMessage, model: MODEL, maxTokens: 2048 },
      skillsGapSchema
    );

    const cost = calculateCost(MODEL, inputTokens, outputTokens);
    await addSpend(userIdStr, "aiGeneration", cost).catch((err) =>
      console.error("[addSpend failed]", err)
    );

    return NextResponse.json({ gap: data });
  } catch (err) {
    console.error("[skills-gap] generation failed:", err);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
