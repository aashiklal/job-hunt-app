/**
 * Generates the resume DOCX template with {{MARKER}} placeholders.
 * Run: npx tsx scripts/generate-resume-template.ts
 * Then upload the output file at /admin -> Export Templates -> Resume Template.
 */

import fs from "fs";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  TabStopType,
} from "docx";

// ─── Brand colours (match the resume screenshots) ─────────────────────────────

const NAME_COLOR = "1F3864";    // dark navy
const SECTION_COLOR = "1F4E79"; // dark blue for section headers
const TITLE_COLOR = "2E74B5";   // medium blue for job/project titles

// ─── Layout constants ─────────────────────────────────────────────────────────

const BODY_SIZE = 20;   // half-points → 10 pt
const NAME_SIZE = 44;   // 22 pt

// A4 at 1-inch margins → text width ≈ 9020 twips (matches ensureRightTabStop)
const RIGHT_TAB = 9020;

// ─── Paragraph builders ───────────────────────────────────────────────────────

function nameBlock(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [
      new TextRun({
        text: "{{NAME}}",
        bold: true,
        size: NAME_SIZE,
        color: NAME_COLOR,
      }),
    ],
  });
}

function centeredMarkerLine(text: string, size = BODY_SIZE): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text, size })],
  });
}

function sectionHeader(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    border: {
      bottom: { color: SECTION_COLOR, style: BorderStyle.SINGLE, size: 6, space: 1 },
    },
    children: [
      new TextRun({ text: label, bold: true, size: 22, color: SECTION_COLOR }),
    ],
  });
}

/**
 * Delimiter paragraphs like {{START_EXPERIENCE}} / {{END_EXPERIENCE}}.
 * The fill engine strips these — they never appear in the output.
 */
function delimiter(marker: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `{{${marker}}}`, size: BODY_SIZE })],
  });
}

/**
 * Summary / body text — single run, plain.
 */
function bodyText(marker: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: `{{${marker}}}`, size: BODY_SIZE })],
  });
}

/**
 * TWO-RUN header with right-tab date.
 *
 * setParaText() sees 2 runs and detects the date pattern at the end of the
 * resolved string, then splits title (run[0] rPr) + tab + date (run[last] rPr).
 *
 * run1: title text with formatting (bold, color)
 * run2: date placeholder — any text; its rPr becomes the date run's style
 */
function twoRunHeader(
  run1Text: string,
  run1Bold: boolean,
  run1Color: string,
  run2Text: string,
  spacingBefore = 100
): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
    spacing: { before: spacingBefore, after: 40 },
    children: [
      new TextRun({ text: run1Text, bold: run1Bold, color: run1Color, size: BODY_SIZE }),
      // run2 must have a <w:t> element so extractRunTemplates picks it up
      new TextRun({ text: run2Text, size: BODY_SIZE }),
    ],
  });
}

/**
 * SKILL_LINE paragraph — two runs so setParaText applies "Label: value" split:
 *   run[0] rPr → bold category name
 *   run[last] rPr → normal items text
 */
function skillLineParagraph(): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: "{{SKILL_LINE}}", bold: true, size: BODY_SIZE }),
      // Space-only second run establishes normal (non-bold) rPr for the value half
      new TextRun({ text: " ", size: BODY_SIZE }),
    ],
  });
}

/**
 * Subtitle / promotion note below job title — italic.
 */
function subtitleParagraph(marker: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: `{{${marker}}}`, italics: true, size: BODY_SIZE })],
  });
}

/**
 * Bullet paragraph — the fill engine clones this once per bullet.
 * Text starts with "• " so isBulletPara() recognises it as a bullet.
 */
function bulletParagraph(): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    indent: { left: 360, hanging: 180 },
    children: [new TextRun({ text: "• {{BULLET}}", size: BODY_SIZE })],
  });
}

/**
 * Tech Stack line — two runs for the "Label: value" split:
 *   "Tech Stack: " (bold) + "{{PROJECT_TECH_STACK}}" (normal)
 */
function techStackParagraph(): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: "Tech Stack: ", bold: true, size: BODY_SIZE }),
      new TextRun({ text: "{{PROJECT_TECH_STACK}}", size: BODY_SIZE }),
    ],
  });
}

/**
 * Certification bullet — uses {{CERT}} (not {{BULLET}}) because certifications
 * are stored as plain strings, not as arrays of bullets.
 */
function certBulletParagraph(): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    indent: { left: 360, hanging: 180 },
    children: [new TextRun({ text: "• {{CERT}}", size: BODY_SIZE })],
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            // A4, 1-inch margins
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [
          // ── Header ──────────────────────────────────────────────────────────
          nameBlock(),
          centeredMarkerLine("{{LOCATION}} | {{PHONE}} | {{EMAIL}}"),
          centeredMarkerLine("{{LINKEDIN}} | {{GITHUB}} | {{WEBSITE}}"),
          centeredMarkerLine("{{WORK_RIGHTS}}"),

          // ── Professional Summary ─────────────────────────────────────────────
          sectionHeader("PROFESSIONAL SUMMARY"),
          bodyText("SUMMARY"),

          // ── Technical Skills ─────────────────────────────────────────────────
          sectionHeader("TECHNICAL SKILLS"),
          delimiter("START_SKILLS"),
          skillLineParagraph(),
          delimiter("END_SKILLS"),

          // ── Professional Experience ──────────────────────────────────────────
          sectionHeader("PROFESSIONAL EXPERIENCE"),
          delimiter("START_EXPERIENCE"),
          //
          // TWO-RUN: "{{JOB_TITLE}} | {{COMPANY}}" (blue bold) + "{{DATE_RANGE}}" (normal)
          // setParaText detects the date at the end and inserts a right-aligned tab.
          //
          twoRunHeader(
            "{{JOB_TITLE}} | {{COMPANY}}",
            true,
            TITLE_COLOR,
            "{{DATE_RANGE}}"
          ),
          subtitleParagraph("JOB_SUBTITLE"),
          bulletParagraph(),
          delimiter("END_EXPERIENCE"),

          // ── Projects ────────────────────────────────────────────────────────
          sectionHeader("PROJECTS"),
          delimiter("START_PROJECTS"),
          // Project name — bold, single run
          new Paragraph({
            spacing: { before: 80, after: 20 },
            children: [
              new TextRun({ text: "{{PROJECT_NAME}}", bold: true, size: BODY_SIZE }),
            ],
          }),
          techStackParagraph(),
          bulletParagraph(),
          delimiter("END_PROJECTS"),

          // ── Education ───────────────────────────────────────────────────────
          sectionHeader("EDUCATION"),
          delimiter("START_EDUCATION"),
          //
          // TWO-RUN: "{{DEGREE}} | {{SCHOOL}}" (bold) + "{{GRAD_DATE}}" (normal)
          //
          twoRunHeader("{{DEGREE}} | {{SCHOOL}}", true, "000000", "{{GRAD_DATE}}"),
          subtitleParagraph("EDU_NOTES"),
          delimiter("END_EDUCATION"),

          // ── Certifications ───────────────────────────────────────────────────
          sectionHeader("CERTIFICATIONS"),
          delimiter("START_CERTIFICATIONS"),
          certBulletParagraph(),
          delimiter("END_CERTIFICATIONS"),

          // ── Footer ──────────────────────────────────────────────────────────
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120 },
            children: [new TextRun({ text: "{{FOOTER}}", size: 18, italics: true })],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(process.cwd(), "resume-template.docx");
  fs.writeFileSync(outPath, buffer);
  console.log(`\nTemplate written to: ${outPath}`);
  console.log("Next step: go to /admin -> Export Templates -> Upload this file under Resume Template.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
