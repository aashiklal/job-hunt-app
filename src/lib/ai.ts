import "server-only";
import { z } from "zod";
import anthropic from "@/lib/anthropic";

type StructuredCallParams = {
  system: string;
  userMessage: string;
  model: string;
  maxTokens: number;
};

export type StructuredCallResult<T> = {
  data: T;
  inputTokens: number;
  outputTokens: number;
};

function stripCodeFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function callStructured<T>(
  params: StructuredCallParams,
  schema: z.ZodType<T>
): Promise<StructuredCallResult<T>> {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    const system =
      attempt === 0
        ? params.system
        : params.system +
          "\n\nIMPORTANT: Respond with ONLY the JSON object, no markdown, no code fences, no commentary.";

    const response = await anthropic.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system,
      messages: [{ role: "user", content: params.userMessage }],
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    const raw =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const stripped = stripCodeFences(raw);

    try {
      const parsed = JSON.parse(stripped);
      const result = schema.safeParse(parsed);
      if (result.success) {
        return {
          data: result.data,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        };
      }
    } catch {
      // try next attempt
    }
  }

  throw new Error(
    "AI response could not be parsed as valid JSON after 2 attempts."
  );
}
