import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  TabStopType,
} from "docx";
import { parseMarkdown, type Segment } from "./parse-markdown";
import { DEFAULT_STYLE_HINTS, type StyleHints } from "./types";

// Convert points → half-points (docx TextRun size unit)
function halfPt(pt: number): number {
  return Math.round(pt * 2);
}

// Convert points → twentieths-of-a-point (docx spacing / margin unit)
function twip(pt: number): number {
  return Math.round(pt * 20);
}

// docx expects hex colors without the # prefix
function docxColor(hex: string): string {
  return hex.replace(/^#/, "").toUpperCase();
}

// Detect date ranges at the end of a string (e.g. "Jan 2020 - Dec 2021", "2020 – Present")
const DATE_RANGE_RE =
  /\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Present|\d{4})$/i;

function splitH3Date(
  segments: Segment[]
): { titleSegments: Segment[]; dateText: string | null } {
  const fullText = segments.map((s) => s.text).join("");
  const m = DATE_RANGE_RE.exec(fullText);
  if (!m) return { titleSegments: segments, dateText: null };
  const dateText = m[0].trim();
  const titleText = fullText.slice(0, m.index).trimEnd();
  const rebuilt: Segment[] = [];
  let remaining = titleText.length;
  for (const seg of segments) {
    if (remaining <= 0) break;
    if (seg.text.length <= remaining) {
      rebuilt.push(seg);
      remaining -= seg.text.length;
    } else {
      rebuilt.push({ ...seg, text: seg.text.slice(0, remaining) });
      remaining = 0;
    }
  }
  return { titleSegments: rebuilt, dateText };
}

// For skill text lines: un-bold everything after the first bold-colon segment.
function normalizeSkillSegments(segments: Segment[]): Segment[] {
  let passedBoldColon = false;
  return segments.flatMap((seg) => {
    if (passedBoldColon) return [{ ...seg, bold: false }];
    if (seg.bold && seg.text.includes(":")) {
      passedBoldColon = true;
      const colonIdx = seg.text.indexOf(":");
      const boldPart = seg.text.slice(0, colonIdx + 1);
      const rest = seg.text.slice(colonIdx + 1);
      const out: Segment[] = [{ text: boldPart, bold: true, italic: seg.italic }];
      if (rest) out.push({ text: rest, bold: false, italic: seg.italic });
      return out;
    }
    return [seg];
  });
}

function makeRuns(
  segments: Segment[],
  overrides: {
    font: string;
    size: number; // half-points
    color: string;
    bold?: boolean;
  }
): TextRun[] {
  return segments.map(
    (seg) =>
      new TextRun({
        text: seg.text,
        bold: seg.bold || overrides.bold,
        italics: seg.italic,
        size: overrides.size,
        color: overrides.color,
        font: overrides.font,
      })
  );
}

export async function generateDOCX(
  content: string,
  hints: StyleHints = DEFAULT_STYLE_HINTS
): Promise<Buffer> {
  const rawLines = parseMarkdown(content);

  // Drop blank lines that immediately follow a heading — the heading already
  // has built-in `after` spacing, and the extra empty paragraph creates a
  // visible gap in the exported document.
  const lines = rawLines.filter((line, i) => {
    if (line.kind !== "blank") return true;
    const prev = rawLines[i - 1];
    return !prev || !["h1", "h2", "h3"].includes(prev.kind);
  });

  const paragraphs: Paragraph[] = lines.map((line): Paragraph => {
    if (line.kind === "blank") {
      return new Paragraph({ text: "", spacing: { after: 0 } });
    }

    if (line.kind === "h1") {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: twip(4) },
        children: makeRuns(line.segments, {
          font: hints.h1Font,
          size: halfPt(hints.h1SizePt),
          color: docxColor(hints.h1Color),
          bold: true,
        }),
      });
    }

    if (line.kind === "h2") {
      const borderColor =
        docxColor(hints.h2Color) === "000000" ? "444444" : docxColor(hints.h2Color);
      return new Paragraph({
        spacing: { before: twip(10), after: twip(3) },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
        },
        children: makeRuns(line.segments, {
          font: hints.h2Font,
          size: halfPt(hints.h2SizePt),
          color: docxColor(hints.h2Color),
          bold: true,
        }),
      });
    }

    if (line.kind === "h3") {
      const { titleSegments, dateText } = splitH3Date(line.segments);
      const h3RunOpts = {
        font: hints.h3Font,
        size: halfPt(hints.h3SizePt),
        color: docxColor(hints.h3Color),
        bold: true as const,
      };
      if (dateText) {
        // A4 page = 595pt; right tab at text-area width in twips
        const textWidthTwips = twip(595 - hints.marginLeftPt - hints.marginRightPt);
        return new Paragraph({
          spacing: { before: twip(5), after: twip(2) },
          tabStops: [{ type: TabStopType.RIGHT, position: textWidthTwips }],
          children: [
            ...makeRuns(titleSegments, h3RunOpts),
            new TextRun({ text: "\t", ...h3RunOpts }),
            new TextRun({ text: dateText, ...h3RunOpts }),
          ],
        });
      }
      return new Paragraph({
        spacing: { before: twip(5), after: twip(2) },
        children: makeRuns(line.segments, h3RunOpts),
      });
    }

    if (line.kind === "bullet") {
      return new Paragraph({
        bullet: { level: 0 },
        spacing: { after: twip(1.5) },
        indent: { left: twip(hints.marginLeftPt > 36 ? 14 : 18) },
        children: makeRuns(line.segments, {
          font: hints.bodyFont,
          size: halfPt(hints.bodyFontSizePt),
          color: "000000",
        }),
      });
    }

    // plain text
    return new Paragraph({
      spacing: { after: twip(2) },
      children: makeRuns(normalizeSkillSegments(line.segments), {
        font: hints.bodyFont,
        size: halfPt(hints.bodyFontSizePt),
        color: "000000",
      }),
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: twip(hints.marginTopPt),
              bottom: twip(hints.marginBottomPt),
              left: twip(hints.marginLeftPt),
              right: twip(hints.marginRightPt),
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
