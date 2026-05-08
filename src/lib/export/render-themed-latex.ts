import "server-only";
import anthropic from "@/lib/anthropic";
import type { GeneratedResume, GeneratedCoverLetter } from "@/lib/generated-documents";
import { buildLatexBodyPrompt, buildCoverLetterLatexBodyPrompt } from "@/lib/prompts";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

type LatexTemplate = {
  texFullTemplate?: string;
  texPreamble?: string;
};

async function renderLatex(
  prompt: string,
  preamble: string
): Promise<{ tex: string; inputTokens: number; outputTokens: number }> {
  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("");

  const body = raw
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```\s*$/i, "")
    .replace(/\\begin\{document\}/g, "")
    .replace(/\\end\{document\}/g, "")
    .trim();

  const tex = `${preamble}\n\\begin{document}\n${body}\n\\end{document}`;

  return {
    tex,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export async function renderThemedLatex(
  resume: GeneratedResume,
  template: LatexTemplate
): Promise<{ tex: string; inputTokens: number; outputTokens: number }> {
  const fullTemplate = template.texFullTemplate ?? "";
  const preamble = template.texPreamble ?? "";
  const prompt = buildLatexBodyPrompt(fullTemplate, resume as unknown as Record<string, unknown>);
  return renderLatex(prompt, preamble);
}

export async function renderThemedCoverLetterLatex(
  coverLetter: GeneratedCoverLetter,
  template: LatexTemplate
): Promise<{ tex: string; inputTokens: number; outputTokens: number }> {
  const fullTemplate = template.texFullTemplate ?? "";
  const preamble = template.texPreamble ?? "";
  const prompt = buildCoverLetterLatexBodyPrompt(fullTemplate, coverLetter as unknown as Record<string, unknown>);
  return renderLatex(prompt, preamble);
}
