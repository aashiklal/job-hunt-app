import "server-only";
import { z } from "zod";
import anthropic from "@/lib/anthropic";
import { callStructured } from "@/lib/ai";
import { addSpend, calculateCost, checkBudget } from "@/lib/usage";

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

async function recordSpend(args: {
  userId: string;
  feature: "aiGeneration";
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const cost = calculateCost(args.model, args.inputTokens, args.outputTokens);
  await addSpend(args.userId, args.feature, cost).catch((err) =>
    console.error("[addSpend failed]", err)
  );
}

export async function callMeteredStructured<T>(
  params: StructuredCallParams<T>
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const feature = params.feature ?? "aiGeneration";
  await checkBudget(params.userId, feature);

  const result = await callStructured(
    {
      system: params.system,
      userMessage: params.userMessage,
      model: params.model,
      maxTokens: params.maxTokens,
    },
    params.schema
  );

  await recordSpend({
    userId: params.userId,
    feature,
    model: params.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return result;
}

export async function callMeteredText(
  params: TextCallParams
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const feature = params.feature ?? "aiGeneration";
  await checkBudget(params.userId, feature);

  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: [{ role: "user", content: params.userMessage }],
  });
  const content =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  await recordSpend({
    userId: params.userId,
    feature,
    model: params.model,
    inputTokens,
    outputTokens,
  });

  return { content, inputTokens, outputTokens };
}
