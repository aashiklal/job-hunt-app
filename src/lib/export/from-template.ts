import "server-only";
import JSZip from "jszip";
import anthropic from "@/lib/anthropic";

// ─── XML helper ───────────────────────────────────────────────────────────────

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Paragraph extraction ─────────────────────────────────────────────────────

type TemplateParagraph = {
  index: number;
  text: string;
  xml: string;
  isBullet: boolean;
  hasSectPr: boolean;
};

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getParaText(paraXml: string): string {
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(paraXml)) !== null) parts.push(m[1]);
  // Decode XML entities so the AI schema shows plain text (e.g. "&" not "&amp;"),
  // and join with a space so multi-run paragraphs (e.g. title + date) don't concatenate.
  return decodeXmlEntities(parts.join(" ").replace(/\s{2,}/g, " ").trim());
}

function isBulletPara(paraXml: string): boolean {
  if (paraXml.includes("<w:numPr>")) return true;
  const t = getParaText(paraXml).trimStart();
  return t.startsWith("•") || t.startsWith("·");
}

function extractParagraphs(docXml: string): TemplateParagraph[] {
  const re = /<w:p\b[\s\S]*?<\/w:p>/g;
  const result: TemplateParagraph[] = [];
  let m: RegExpExecArray | null;
  let index = 0;
  while ((m = re.exec(docXml)) !== null) {
    const xml = m[0];
    result.push({
      index,
      text: getParaText(xml),
      xml,
      isBullet: isBulletPara(xml),
      hasSectPr: xml.includes("<w:sectPr"),
    });
    index++;
  }
  return result;
}

// ─── Text replacement ─────────────────────────────────────────────────────────

// Matches a date range at the end of a string — same pattern as in to-docx.ts
const H3_DATE_RE =
  /\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Present|\d{4})$/i;

// Inject a right-aligned tab stop into a pPr block if one isn't already present.
function ensureRightTabStop(pPr: string): string {
  if (pPr.includes("<w:tabs>")) return pPr;
  const tabXml = '<w:tabs><w:tab w:val="right" w:pos="9020"/></w:tabs>';
  if (!pPr) return `<w:pPr>${tabXml}</w:pPr>`;
  return pPr.replace("</w:pPr>", `${tabXml}</w:pPr>`);
}

type RunTemplate = { rPr: string };

// Extract all text-bearing runs from a template paragraph, preserving their rPr.
function extractRunTemplates(paraXml: string): RunTemplate[] {
  const runs: RunTemplate[] = [];
  const runRe = /<w:r\b[\s\S]*?<\/w:r>/g;
  let rm: RegExpExecArray | null;
  while ((rm = runRe.exec(paraXml)) !== null) {
    if (!rm[0].includes("<w:t")) continue;
    const rPrMatch = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(rm[0]);
    runs.push({ rPr: rPrMatch ? rPrMatch[0] : "" });
  }
  return runs;
}

/**
 * Replace a template paragraph's text while preserving its run formatting.
 *
 * The template's run structure is the source of truth for styling — we never
 * hard-code bold, color, or any other property. Instead:
 *
 * - 1 template run  → single replacement run with the same rPr
 * - 2+ template runs, text has a date at the end (h3 job-title pattern)
 *     → run[0].rPr for the title, run[last].rPr for the date (right-aligned)
 * - 2+ template runs, text has "Label: value" (skill-line pattern)
 *     → run[0].rPr for the label, run[last].rPr for the value
 * - 2+ template runs, no pattern matched → all text into run[0].rPr
 */
function setParaText(paraXml: string, newText: string): string {
  const openTagMatch = /^<w:p(?:\s[^>]*)?>/.exec(paraXml);
  const openTag = openTagMatch ? openTagMatch[0] : "<w:p>";
  const pPrMatch = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(paraXml);
  const pPr = pPrMatch ? pPrMatch[0] : "";

  const runs = extractRunTemplates(paraXml);
  const firstRpr = runs[0]?.rPr ?? "";
  const lastRpr = runs[runs.length - 1]?.rPr ?? firstRpr;

  // Multi-run paragraphs: use the template's run formatting to drive the split
  if (runs.length >= 2) {
    // Date at end → title (run[0] rPr) + tab + date (run[last] rPr)
    const dateMatch = H3_DATE_RE.exec(newText);
    if (dateMatch && dateMatch.index > 0) {
      const titleText = newText.slice(0, dateMatch.index).trimEnd();
      const dateText = dateMatch[0].trim();
      const pPrWithTab = ensureRightTabStop(pPr);
      return (
        `${openTag}${pPrWithTab}` +
        `<w:r>${firstRpr}<w:t xml:space="preserve">${escapeXml(titleText)}</w:t></w:r>` +
        `<w:r>${lastRpr}<w:t xml:space="preserve">\t${escapeXml(dateText)}</w:t></w:r>` +
        `</w:p>`
      );
    }

    // "Label: value" → label (run[0] rPr) + value (run[last] rPr)
    const colonIdx = newText.indexOf(": ");
    if (colonIdx > 0 && colonIdx < newText.length - 2) {
      const labelEscaped = escapeXml(newText.slice(0, colonIdx + 1));
      const valueEscaped = escapeXml(newText.slice(colonIdx + 1));
      return (
        `${openTag}${pPr}` +
        `<w:r>${firstRpr}<w:t xml:space="preserve">${labelEscaped}</w:t></w:r>` +
        `<w:r>${lastRpr}<w:t xml:space="preserve">${valueEscaped}</w:t></w:r>` +
        `</w:p>`
      );
    }
  }

  // Single run or no pattern matched — one run with the first rPr
  return `${openTag}${pPr}<w:r>${firstRpr}<w:t xml:space="preserve">${escapeXml(newText)}</w:t></w:r></w:p>`;
}

// ─── ZIP helpers ──────────────────────────────────────────────────────────────

async function loadTemplate(templateBuffer: Buffer) {
  const zip = await JSZip.loadAsync(templateBuffer);
  const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const paragraphs = extractParagraphs(docXml);

  const bodyOpenIdx = docXml.indexOf("<w:body>");
  const header =
    bodyOpenIdx >= 0
      ? docXml.slice(0, bodyOpenIdx + "<w:body>".length)
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`;

  const sectPrParas = paragraphs
    .filter((p) => p.hasSectPr)
    .map((p) => p.xml)
    .join("\n");

  let directSectPr = "";
  if (!paragraphs.some((p) => p.hasSectPr)) {
    const re = /<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>|<w:sectPr(?:\s[^>]*)?\/>/g;
    let sm: RegExpExecArray | null;
    while ((sm = re.exec(docXml)) !== null) directSectPr = sm[0];
  }

  return { zip, paragraphs, header, sectPrParas, directSectPr };
}

function buildDocXml(
  header: string,
  paragraphs: TemplateParagraph[],
  output: Array<[number, string | null]>,
  sectPrParas: string,
  directSectPr: string
): string {
  const bodyContent = output
    .map(([sourceIdx, text]) => {
      const para = paragraphs[sourceIdx];
      if (!para) return "";
      return text === null ? para.xml : setParaText(para.xml, text);
    })
    .filter(Boolean)
    .join("\n");

  return [header, bodyContent, sectPrParas, directSectPr, "</w:body>", "</w:document>"]
    .filter(Boolean)
    .join("\n");
}

// ─── AI slot-fill ─────────────────────────────────────────────────────────────

export type SlotFillOutput =
  | { valid: true; output: Array<[number, string | null]> }
  | { valid: false; reason: string };

/**
 * Ask Claude Haiku to map the generated content onto the template's paragraph
 * slots and return the ordered output sequence.
 *
 * This is the AI-only step — it does NOT read or write any files.
 * Exported separately so the generate route can pre-compute and cache it.
 */
export async function computeSlotFill(
  templateBuffer: Buffer,
  content: string,
  docType: "resume" | "cover_letter"
): Promise<SlotFillOutput> {
  const { paragraphs } = await loadTemplate(templateBuffer);
  const contentParas = paragraphs.filter((p) => !p.hasSectPr);

  const schema = contentParas
    .map((p) => {
      const label = p.isBullet ? " [bullet]" : "";
      const display = p.text.trim() ? `"${p.text.trim()}"` : "(blank)";
      return `${p.index}: ${display}${label}`;
    })
    .join("\n");

  const docLabel = docType.replace("_", " ");

  const prompt = `You are inserting tailored ${docLabel} content into a DOCX template.

TEMPLATE PARAGRAPHS (index → current text):
${schema}

CONTENT TO INSERT:
${content}

Return JSON describing the complete final document as an ordered sequence:
{"valid":true,"output":[[sourceIndex,textOrNull],...]}

Each entry is [sourceIndex, text]:
- sourceIndex — which template paragraph's formatting (font, size, colour, alignment, borders) to use
- text — null = keep that paragraph's original text; string = replace with this text

You control the entire output sequence:
- Keep unchanged:        [4, null]
- Replace text:          [4, "New text"]
- Clone for extra items: repeat the same sourceIndex with different text
  e.g. three bullets from template bullet at index 7: [7,"item 1"],[7,"item 2"],[7,"item 3"]
- Omit unneeded template paragraphs by not including them

Rules:
1. Section headers (EXPERIENCE, EDUCATION, SKILLS, etc.) → always [N, null]
2. Blank/spacer paragraphs → [N, null]
3. For multiple job/education entries: use the first entry's paragraph indices as source, clone them for additional entries
4. For bullet points: clone the template bullet as many times as needed
5. Omit template entries that have no matching content
6. Preserve the template's section order

Set "valid":false with "reason" if template has <6 non-blank paragraphs or doesn't resemble a ${docLabel}.

Example — adding a second job (first job at indices 5–9):
[[5,"Engineer"],[6,"TechCorp | NYC"],[7,"2022–Present"],[8,"Built X"],[8,"Did Y"],[9,null],[5,"Analyst"],[6,"Co | LA"],[7,"2020–2022"],[8,"Task A"],[9,null]]

Respond with ONLY valid JSON, no markdown.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
  const jsonMatch = /\{[\s\S]*\}/.exec(raw);
  if (!jsonMatch) return { valid: false, reason: "AI returned no valid JSON" };

  const parsed = JSON.parse(jsonMatch[0]) as {
    valid: boolean;
    reason?: string;
    output?: Array<[number, string | null]>;
  };

  if (!parsed.valid) return { valid: false, reason: parsed.reason ?? "Template deemed unsuitable" };
  if (!Array.isArray(parsed.output) || parsed.output.length === 0)
    return { valid: false, reason: "AI returned empty output" };

  return { valid: true, output: parsed.output };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply a pre-computed slot-fill output to a template buffer.
 * No AI calls — pure XML manipulation. Used when the cache hits.
 */
export async function applyToTemplate(
  templateBuffer: Buffer,
  output: Array<[number, string | null]>
): Promise<Buffer> {
  const { zip, paragraphs, header, sectPrParas, directSectPr } =
    await loadTemplate(templateBuffer);

  zip.file(
    "word/document.xml",
    buildDocXml(header, paragraphs, output, sectPrParas, directSectPr)
  );

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  }) as Promise<Buffer>;
}

export type InjectResult = {
  buffer: Buffer;
  valid: boolean;
};

/**
 * Compute slot-fill and immediately apply it to the template.
 * Used as the fallback path when there is no pre-computed cache.
 */
export async function injectContent(
  templateBuffer: Buffer,
  content: string,
  docType: "resume" | "cover_letter" = "resume"
): Promise<InjectResult> {
  const slotFill = await computeSlotFill(templateBuffer, content, docType);
  if (!slotFill.valid) return { buffer: Buffer.alloc(0), valid: false };

  const buffer = await applyToTemplate(templateBuffer, slotFill.output);
  return { buffer, valid: true };
}
