import "server-only";

export type DocxParagraphXml = {
  xml: string;
  hasSectPr: boolean;
};

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function textToXmlTextRuns(text: string): string {
  return text
    .split("\n")
    .map((part, index) => {
      const textXml = `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`;
      return index === 0 ? textXml : `<w:br/>${textXml}`;
    })
    .join("");
}

export function getParagraphXmls(xml: string): string[] {
  return xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
}

export function extractParagraphs(docXml: string): DocxParagraphXml[] {
  return getParagraphXmls(docXml).map((xml) => ({
    xml,
    hasSectPr: xml.includes("<w:sectPr"),
  }));
}

export function getParagraphText(paraXml: string): string {
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  const parts: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(paraXml)) !== null) {
    parts.push(match[1]);
  }
  return decodeXmlEntities(parts.join("").replace(/\s{2,}/g, " ").trim());
}

const H3_DATE_RE =
  /\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Present|\d{4})$/i;

function ensureRightTabStop(pPr: string): string {
  if (pPr.includes("<w:tabs>")) return pPr;
  const tabXml = '<w:tabs><w:tab w:val="right" w:pos="9020"/></w:tabs>';
  if (!pPr) return `<w:pPr>${tabXml}</w:pPr>`;
  return pPr.replace("</w:pPr>", `${tabXml}</w:pPr>`);
}

function extractRunTemplates(paraXml: string): Array<{ rPr: string }> {
  const runs: Array<{ rPr: string }> = [];
  const runRe = /<w:r\b[\s\S]*?<\/w:r>/g;
  let match: RegExpExecArray | null;
  while ((match = runRe.exec(paraXml)) !== null) {
    if (!match[0].includes("<w:t")) continue;
    const rPrMatch = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(match[0]);
    runs.push({ rPr: rPrMatch ? rPrMatch[0] : "" });
  }
  return runs;
}

export function cloneParagraphWithText(paraXml: string, newText: string): string {
  const openTagMatch = /^<w:p(?:\s[^>]*)?>/.exec(paraXml);
  const openTag = openTagMatch ? openTagMatch[0] : "<w:p>";
  const pPrMatch = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(paraXml);
  const pPr = pPrMatch ? pPrMatch[0] : "";

  const runs = extractRunTemplates(paraXml);
  const firstRpr = runs[0]?.rPr ?? "";
  const lastRpr = runs[runs.length - 1]?.rPr ?? firstRpr;

  if (runs.length >= 2) {
    const dateMatch = H3_DATE_RE.exec(newText);
    if (dateMatch && dateMatch.index > 0) {
      const titleText = newText.slice(0, dateMatch.index).trimEnd();
      const dateText = dateMatch[0].trim();
      const pPrWithTab = ensureRightTabStop(pPr);
      return `${openTag}${pPrWithTab}<w:r>${firstRpr}${textToXmlTextRuns(titleText)}</w:r><w:r>${lastRpr}<w:t xml:space="preserve">\t${escapeXml(dateText)}</w:t></w:r></w:p>`;
    }

    const colonIdx = newText.indexOf(": ");
    if (colonIdx > 0 && colonIdx < newText.length - 2) {
      const labelEscaped = escapeXml(newText.slice(0, colonIdx + 1));
      const valueEscaped = escapeXml(newText.slice(colonIdx + 1));
      return `${openTag}${pPr}<w:r>${firstRpr}<w:t xml:space="preserve">${labelEscaped}</w:t></w:r><w:r>${lastRpr}<w:t xml:space="preserve">${valueEscaped}</w:t></w:r></w:p>`;
    }
  }

  return `${openTag}${pPr}<w:r>${firstRpr}${textToXmlTextRuns(newText)}</w:r></w:p>`;
}
