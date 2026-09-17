import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { callMeteredStructured } from "@/lib/ai-execution";
import { QuotaExceededError } from "@/lib/usage";
import { buildOfferComparisonPrompt } from "@/lib/prompts";
import * as users from "@/lib/repositories/users";
import * as offers from "@/lib/repositories/offers";

const MODEL = "claude-sonnet-4-5";

const offerComparisonSchema = z.object({
  comparisonTable: z.array(
    z.object({ dimension: z.string(), winner: z.string(), notes: z.string() })
  ),
  prosAndCons: z.record(
    z.string(),
    z.object({ pros: z.array(z.string()), cons: z.array(z.string()) })
  ),
  recommendation: z.object({ pick: z.string(), reasoning: z.string() }),
  negotiationOpportunities: z.array(z.string()),
});

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

  const offerList = await offers.list(userIdStr);

  if (offerList.length < 2) {
    return NextResponse.json(
      { error: "Add at least 2 offers to compare." },
      { status: 400 }
    );
  }

  try {
    const normalizedOffers = offerList.map((o) => ({
      ...o,
      equity: o.equity ?? undefined,
      bonus: o.bonus ?? undefined,
      leaveDays: o.leaveDays ?? undefined,
      notes: o.notes ?? undefined,
    }));
    const { system, userMessage } = buildOfferComparisonPrompt({ offers: normalizedOffers });

    const { data } = await callMeteredStructured({
      userId: userIdStr,
      system,
      userMessage,
      model: MODEL,
      maxTokens: 2048,
      schema: offerComparisonSchema,
    });

    return NextResponse.json({ comparison: data });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: err.message, limit: err.limit, used: err.used, periodEndsAt: err.periodEndsAt.toISOString(), budgetScope: err.budgetScope },
        { status: 429 }
      );
    }
    console.error("[offers/compare] generation failed:", err);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
