import "server-only";
import { z } from "zod";
import anthropic from "@/lib/anthropic";
import { callStructured } from "@/lib/ai";
import {
  calculateCost,
  recordSpend,
  reserveCredits,
  releaseCredits,
} from "@/lib/usage";
import { assertNotDemoUser } from "@/lib/demo";
import { creditCost, type CreditFeature } from "@/lib/credits";
import * as usageEvents from "@/lib/repositories/usage-events";

type MeteredCallParams = {
  userId: string;
  model: string;
  /** Decides the credit price and how the call is attributed in reporting. */
  feature: CreditFeature;
};

type StructuredCallParams<T> = MeteredCallParams & {
  system: string;
  userMessage: string;
  maxTokens: number;
  schema: z.ZodType<T>;
};

type TextCallParams = MeteredCallParams & {
  system: string;
  userMessage: string;
  maxTokens: number;
};

/**
 * Runs a metered Anthropic call against the user's credit allowance.
 *
 * Credits are the only limit (docs/adr/0006): the feature's full price is
 * charged atomically before the call, so concurrent requests cannot overshoot
 * the allowance, and refunded if the call fails. The real USD cost is then
 * recorded for the admin margin view; it never refuses anyone.
 *
 * Recording failures are logged rather than thrown: the call already succeeded
 * and the caller is entitled to its result. The cost of that failure is a
 * missing reporting row, never an unpaid call.
 */
async function withReservation<T>(
  userId: string,
  model: string,
  feature: CreditFeature,
  run: () => Promise<{ value: T; inputTokens: number; outputTokens: number }>
): Promise<{ value: T; inputTokens: number; outputTokens: number }> {
  // Last line of defence for the public demo account. Guarding each route
  // individually is what failed before: four AI routes were added without
  // fixtures and quietly billed real calls. Everything metered passes through
  // here, so a new feature cannot leak spend by omission. Throwing rather than
  // substituting output keeps the mistake loud at development time.
  await assertNotDemoUser(userId);

  // A refusal here costs nothing: the price is exact and nothing has run.
  const credits = creditCost(feature);
  const reservation = await reserveCredits(userId, credits);

  let outcome: { value: T; inputTokens: number; outputTokens: number };
  try {
    outcome = await run();
  } catch (err) {
    await releaseCredits(userId, reservation.creditsCharged).catch((e) =>
      console.error("[releaseCredits failed]", e)
    );
    throw err;
  }

  const cost = calculateCost(model, outcome.inputTokens, outcome.outputTokens);

  // Reporting only, and deliberately off the charging path.
  await Promise.all([
    recordSpend(userId, cost).catch((err) =>
      console.error("[recordSpend failed]", err)
    ),
    usageEvents
      .record({
        userId,
        feature,
        aiModel: model,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        costUSD: cost,
        credits,
      })
      .catch((err) => console.error("[usageEvent record failed]", err)),
  ]);

  return outcome;
}

export async function callMeteredStructured<T>(
  params: StructuredCallParams<T>
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const { value, inputTokens, outputTokens } = await withReservation(
    params.userId,
    params.model,
    params.feature,
    async () => {
      const result = await callStructured(
        {
          system: params.system,
          userMessage: params.userMessage,
          model: params.model,
          maxTokens: params.maxTokens,
        },
        params.schema
      );
      return {
        value: result.data,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    }
  );

  return { data: value, inputTokens, outputTokens };
}

export async function callMeteredText(
  params: TextCallParams
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const { value, inputTokens, outputTokens } = await withReservation(
    params.userId,
    params.model,
    params.feature,
    async () => {
      const response = await anthropic.messages.create({
        model: params.model,
        max_tokens: params.maxTokens,
        system: params.system,
        messages: [{ role: "user", content: params.userMessage }],
      });
      const content =
        response.content[0]?.type === "text" ? response.content[0].text : "";
      return {
        value: content,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    }
  );

  return { content: value, inputTokens, outputTokens };
}
