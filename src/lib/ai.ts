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

const STRICT_JSON_SUFFIX =
  "\n\nIMPORTANT: Respond with ONLY the JSON object, no markdown, no code fences, no commentary.";

function stripCodeFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function tryParse<T>(raw: string, schema: z.ZodType<T>): T | null {
  try {
    const parsed = JSON.parse(stripCodeFences(raw));
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

async function attemptOnce(params: StructuredCallParams) {
  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: [{ role: "user", content: params.userMessage }],
  });
  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  return {
    raw,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/**
 * Non-streaming structured call. Retries once with a stricter instruction
 * when the first response is not valid JSON for the schema.
 */
export async function callStructured<T>(
  params: StructuredCallParams,
  schema: z.ZodType<T>
): Promise<StructuredCallResult<T>> {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    const system = attempt === 0 ? params.system : params.system + STRICT_JSON_SUFFIX;
    const result = await attemptOnce({ ...params, system });
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;

    const data = tryParse(result.raw, schema);
    if (data !== null) {
      return { data, inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
    }
  }

  throw new Error("AI response could not be parsed as valid JSON after 2 attempts.");
}

/**
 * Streaming structured call. `onText` receives the full text received so far
 * after every delta, so callers can render a progressive preview. The final
 * message is validated against the schema exactly like `callStructured`; if
 * it fails, one non-streaming retry runs with the stricter instruction (no
 * partials are emitted during the retry).
 */
export async function streamStructured<T>(
  params: StructuredCallParams & { signal?: AbortSignal },
  schema: z.ZodType<T>,
  onText: (snapshot: string) => void
): Promise<StructuredCallResult<T>> {
  const stream = anthropic.messages.stream(
    {
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: [{ role: "user", content: params.userMessage }],
    },
    { signal: params.signal }
  );

  stream.on("text", (_delta, snapshot) => onText(snapshot));

  const final = await stream.finalMessage();
  const raw = final.content[0]?.type === "text" ? final.content[0].text : "";
  let inputTokens = final.usage.input_tokens;
  let outputTokens = final.usage.output_tokens;

  const data = tryParse(raw, schema);
  if (data !== null) {
    return { data, inputTokens, outputTokens };
  }

  const retry = await attemptOnce({ ...params, system: params.system + STRICT_JSON_SUFFIX });
  inputTokens += retry.inputTokens;
  outputTokens += retry.outputTokens;
  const retried = tryParse(retry.raw, schema);
  if (retried !== null) {
    return { data: retried, inputTokens, outputTokens };
  }

  throw new Error("AI response could not be parsed as valid JSON after 2 attempts.");
}
