import "server-only";
import { callMeteredText } from "@/lib/ai-execution";
import type { GeneratedResume, GeneratedCoverLetter } from "@/lib/generated-documents";
import { buildLatexBodyPrompt, buildCoverLetterLatexBodyPrompt } from "@/lib/prompts";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

type LatexTemplate = {
  texFullTemplate?: string;
  texPreamble?: string;
};

/**
 * LaTeX export used to call the Anthropic SDK directly, which meant it was
 * invisible to metering: the spend was real but never recorded, and it cost
 * the user no credits. It also
 * bypassed the demo guard, so a public demo visitor exporting a document
 * billed the account owner.
 *
 * Routing through callMeteredText fixes both at once. It charges the user's
 * credits before the call, records the real cost afterwards, and refuses
 * outright for the demo account.
 */
async function renderLatex(
  userId: string,
  prompt: string,
  preamble: string
): Promise<{ tex: string; inputTokens: number; outputTokens: number }> {
  const { content: raw, inputTokens, outputTokens } = await callMeteredText({
    userId,
    model: HAIKU_MODEL,
    maxTokens: 4096,
    system: "",
    userMessage: prompt,
    feature: "latex_export",
  });

  const body = raw
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```\s*$/i, "")
    .replace(/\\begin\{document\}/g, "")
    .replace(/\\end\{document\}/g, "")
    .trim();

  const tex = `${preamble}\n\\begin{document}\n${body}\n\\end{document}`;

  return { tex, inputTokens, outputTokens };
}

export async function renderThemedLatex(
  userId: string,
  resume: GeneratedResume,
  template: LatexTemplate
): Promise<{ tex: string; inputTokens: number; outputTokens: number }> {
  const fullTemplate = template.texFullTemplate ?? "";
  const preamble = template.texPreamble ?? "";
  const prompt = buildLatexBodyPrompt(fullTemplate, resume as unknown as Record<string, unknown>);
  return renderLatex(userId, prompt, preamble);
}

export async function renderThemedCoverLetterLatex(
  userId: string,
  coverLetter: GeneratedCoverLetter,
  template: LatexTemplate
): Promise<{ tex: string; inputTokens: number; outputTokens: number }> {
  const fullTemplate = template.texFullTemplate ?? "";
  const preamble = template.texPreamble ?? "";
  const prompt = buildCoverLetterLatexBodyPrompt(fullTemplate, coverLetter as unknown as Record<string, unknown>);
  return renderLatex(userId, prompt, preamble);
}
