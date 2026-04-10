import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import anthropic from "@/lib/anthropic";
import * as users from "@/lib/repositories/users";
import { checkAndIncrementUsage, decrementUsage, QuotaExceededError } from "@/lib/usage";
import { buildJobParsePrompt } from "@/lib/prompts";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 1024;

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

  try {
    await checkAndIncrementUsage(userIdStr, "aiGeneration");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: err.message },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { system, userMessage } = buildJobParsePrompt({ text });

  let parsed: ParsedJobFields | null = null;

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system:
          attempt === 0
            ? system
            : `${system}\n\nIMPORTANT: Your previous response was not valid JSON. Respond with ONLY the JSON object.`,
        messages: [{ role: "user", content: userMessage }],
      });

      const textBlock = response.content.find((c) => c.type === "text");
      if (!textBlock || textBlock.type !== "text") continue;

      const cleaned = textBlock.text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "");

      try {
        const raw = JSON.parse(cleaned);
        const validated = parsedSchema.safeParse(raw);
        if (validated.success) {
          parsed = validated.data;
          break;
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.error("[jobs/parse] anthropic error:", err);
    await decrementUsage(userIdStr, "aiGeneration").catch(() => {});
    return NextResponse.json(
      { error: "AI service error. Please try again." },
      { status: 502 }
    );
  }

  if (!parsed) {
    await decrementUsage(userIdStr, "aiGeneration").catch(() => {});
    return NextResponse.json(
      { error: "Failed to parse the job posting. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ fields: parsed });
}
