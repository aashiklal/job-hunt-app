import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
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
  const lines = parseMarkdown(content);

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
      return new Paragraph({
        spacing: { before: twip(5), after: twip(2) },
        children: makeRuns(line.segments, {
          font: hints.h3Font,
          size: halfPt(hints.h3SizePt),
          color: docxColor(hints.h3Color),
          bold: true,
        }),
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
      children: makeRuns(line.segments, {
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
