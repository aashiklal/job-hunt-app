import "server-only";
import { z } from "zod";
import anthropic from "@/lib/anthropic";
import { callStructured } from "@/lib/ai";
import {
  calculateCost,
  estimateCallCost,
  reconcileSpend,
  releaseSpend,
  reserveSpend,
} from "@/lib/usage";
import { assertNotDemoUser } from "@/lib/demo";

type MeteredCallParams = {
  userId: string;
  model: string;
  feature?: "aiGeneration";
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
 * Runs a metered Anthropic call under a budget reservation.
 *
 * The reservation is taken atomically before the call and corrected to the
 * true cost afterwards, so concurrent requests cannot all pass a stale budget
 * check and overshoot the cap. A failed call refunds its reservation in full.
 *
 * Reconciliation failures are logged rather than thrown: the API call already
 * succeeded and the caller is entitled to its result. The consequence is an
 * over-charge equal to the unreconciled reservation, which is the safe
 * direction to fail in.
 */
async function withReservation<T>(
  userId: string,
  model: string,
  maxTokens: number,
  run: () => Promise<{ value: T; inputTokens: number; outputTokens: number }>
): Promise<{ value: T; inputTokens: number; outputTokens: number }> {
  // Last line of defence for the public demo account. Guarding each route
  // individually is what failed before: four AI routes were added without
  // fixtures and quietly billed real calls. Everything metered passes through
  // here, so a new feature cannot leak spend by omission. Throwing rather than
  // substituting output keeps the mistake loud at development time.
  await assertNotDemoUser(userId);

  const { reservedUSD } = await reserveSpend(
    userId,
    "aiGeneration",
    estimateCallCost(model, maxTokens)
  );

  let outcome: { value: T; inputTokens: number; outputTokens: number };
  try {
    outcome = await run();
  } catch (err) {
    await releaseSpend(userId, reservedUSD).catch((releaseErr) =>
      console.error("[releaseSpend failed]", releaseErr)
    );
    throw err;
  }

  const cost = calculateCost(model, outcome.inputTokens, outcome.outputTokens);
  await reconcileSpend(userId, reservedUSD, cost).catch((err) =>
    console.error("[reconcileSpend failed]", err)
  );

  return outcome;
}

export async function callMeteredStructured<T>(
  params: StructuredCallParams<T>
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const { value, inputTokens, outputTokens } = await withReservation(
    params.userId,
    params.model,
    params.maxTokens,
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
    params.maxTokens,
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
