import "server-only";
import { z } from "zod";
import { callStructured } from "@/lib/ai";
import type { DocxStyleCatalog } from "@/lib/export/extract-docx-styles";

const MODEL = "claude-haiku-4-5-20251001";

export const styleRoleSchema = z.enum([
  "applicant_name",
  "applicant_contact",
  "date",
  "recipient",
  "company",
  "role",
  "salutation",
  "summary",
  "section_heading",
  "experience_heading",
  "project_heading",
  "education_heading",
  "skill_line",
  "bullet",
  "body_paragraph",
  "closing",
  "signoff",
  "footer",
]);

const roleStyleMapSchema = z.object({
  version: z.literal(1),
  docType: z.enum(["resume", "cover_letter"]),
  roleStyles: z.record(z.string(), z.string().nullable()),
  sectionHeadingCase: z.enum(["preserve", "upper", "title"]),
  warnings: z.array(z.string()),
});

export type StyleRole = z.infer<typeof styleRoleSchema>;
export type StyleRoleMap = z.infer<typeof roleStyleMapSchema>;

const ROLES: StyleRole[] = [
  "applicant_name",
  "applicant_contact",
  "date",
  "recipient",
  "company",
  "role",
  "salutation",
  "summary",
  "section_heading",
  "experience_heading",
  "project_heading",
  "education_heading",
  "skill_line",
  "bullet",
  "body_paragraph",
  "closing",
  "signoff",
  "footer",
];

function emptyRoleStyles(): Record<StyleRole, string | null> {
  return Object.fromEntries(ROLES.map((role) => [role, null])) as Record<
    StyleRole,
    string | null
  >;
}

function sampleRole(text: string, docType: "resume" | "cover_letter"): StyleRole | null {
  const normalized = text.toLowerCase();

  if (docType === "cover_letter") {
    if (/\b\d{1,2}(st|nd|rd|th)?\s+[a-z]+\s+\d{4}\b/i.test(text)) return "date";
    if (normalized.startsWith("dear ")) return "salutation";
    if (normalized.includes("sincerely") || normalized.includes("regards")) return "signoff";
    if (normalized.includes("@") || /\+?\d[\d\s().-]{6,}/.test(text)) return "applicant_contact";
    if (text.length < 45 && /^[A-Z][A-Za-z.' -]+$/.test(text)) return "applicant_name";
    return "body_paragraph";
  }

  if (normalized.includes("@") || /\+?\d[\d\s().-]{6,}/.test(text)) return "applicant_contact";
  if (/^(summary|profile|professional summary|technical skills|skills|experience|professional experience|projects|education|certifications)$/i.test(text)) {
    return "section_heading";
  }
  if (/^[•●\-*]\s+/.test(text.trim()) || text.length > 110) return "bullet";
  if (/\b(present|\d{4})\b/i.test(text) && text.includes(",")) return "experience_heading";
  if (text.includes(":") && text.length < 180) return "skill_line";
  return null;
}

function buildFallbackStyleRoleMap(
  catalog: DocxStyleCatalog,
  docType: "resume" | "cover_letter"
): StyleRoleMap {
  const roleStyles = emptyRoleStyles();
  for (const sample of catalog.samples) {
    if (!sample.styleId) continue;
    const role = sampleRole(sample.text, docType);
    if (role && !roleStyles[role]) roleStyles[role] = sample.styleId;
  }

  const normalStyle =
    catalog.styles.find((style) => style.isDefault)?.styleId ??
    catalog.styles.find((style) => /normal/i.test(style.name))?.styleId ??
    catalog.styles[0]?.styleId ??
    null;

  const bodyStyle = roleStyles.body_paragraph ?? normalStyle;
  roleStyles.summary ??= bodyStyle;
  roleStyles.body_paragraph ??= bodyStyle;
  roleStyles.closing ??= bodyStyle;
  roleStyles.footer ??= bodyStyle;
  roleStyles.skill_line ??= bodyStyle;
  roleStyles.bullet ??= roleStyles.bullet ?? bodyStyle;
  roleStyles.section_heading ??=
    catalog.styles.find((style) => /heading|section/i.test(style.name))?.styleId ??
    bodyStyle;

  return {
    version: 1,
    docType,
    roleStyles,
    sectionHeadingCase: "upper",
    warnings: [
      ...catalog.warnings,
      "AI style mapping was unavailable; used heuristic style mapping.",
    ],
  };
}

export async function mapStylesToRoles(
  catalog: DocxStyleCatalog,
  docType: "resume" | "cover_letter"
): Promise<{ map: StyleRoleMap; inputTokens: number; outputTokens: number }> {
  if (catalog.styles.length < 1) {
    return {
      map: buildFallbackStyleRoleMap(catalog, docType),
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  const styleSummary = catalog.styles
    .slice(0, 80)
    .map((style) =>
      [
        `styleId=${style.styleId}`,
        `name=${style.name}`,
        style.isDefault ? "default" : null,
        style.basedOn ? `basedOn=${style.basedOn}` : null,
        style.summary.fontFamily ? `font=${style.summary.fontFamily}` : null,
        style.summary.fontSizeHalfPoints
          ? `sizeHalfPoints=${style.summary.fontSizeHalfPoints}`
          : null,
        style.summary.color ? `color=${style.summary.color}` : null,
        style.summary.bold ? "bold" : null,
        style.summary.italic ? "italic" : null,
        style.summary.allCaps ? "allCaps" : null,
        style.summary.hasNumbering ? "numberedOrBullet" : null,
        style.summary.leftIndent ? `leftIndent=${style.summary.leftIndent}` : null,
        style.summary.hangingIndent ? `hanging=${style.summary.hangingIndent}` : null,
        style.summary.justification ? `align=${style.summary.justification}` : null,
      ]
        .filter(Boolean)
        .join(" | ")
    )
    .join("\n");

  const samples = catalog.samples
    .slice(0, 80)
    .map((sample, index) =>
      [
        `index=${index}`,
        sample.styleId ? `styleId=${sample.styleId}` : "styleId=null",
        `text=${JSON.stringify(sample.text.slice(0, 180))}`,
      ].join(" | ")
    )
    .join("\n");

  const system = `You map DOCX paragraph styles to generated job-application content roles.

Return ONLY JSON matching this schema:
{
  "version": 1,
  "docType": "${docType}",
  "roleStyles": { "role": "styleId or null" },
  "sectionHeadingCase": "preserve" | "upper" | "title",
  "warnings": ["string"]
}

Allowed roles:
${ROLES.join(", ")}.

Rules:
- Use only styleId values present in the supplied style list.
- Prefer styles by visual meaning: size, bold, color, all-caps, indentation, numbering, and style name.
- A role may be null when no suitable style exists.
- Reuse a style for multiple roles when the template clearly does.
- For resumes, section_heading should be the blue/bold/all-caps style used for labels like PROFESSIONAL SUMMARY and TECHNICAL SKILLS.
- For resumes, bullet should be the indented bullet/list paragraph style.
- For resumes, experience_heading should be the style used for job title/company/date lines, not the section heading style.
- For cover letters, body_paragraph should be the main justified paragraph style; applicant_name and applicant_contact should use the header styles.
- sectionHeadingCase should be "upper" if the template samples use all-caps section headings; otherwise "preserve".
- Add a warning only for genuine uncertainty.`;

  const userMessage = `Document type: ${docType}

Paragraph styles:
${styleSummary}

Sample paragraph usage:
${samples}

Map style IDs to roles.`;

  try {
    const result = await callStructured(
      { system, userMessage, model: MODEL, maxTokens: 4096 },
      roleStyleMapSchema
    );
    const validStyleIds = new Set(catalog.styles.map((style) => style.styleId));
    const roleStyles = emptyRoleStyles();
    for (const role of ROLES) {
      const styleId = result.data.roleStyles[role];
      roleStyles[role] = styleId && validStyleIds.has(styleId) ? styleId : null;
    }
    return {
      map: {
        version: 1,
        docType,
        roleStyles,
        sectionHeadingCase: result.data.sectionHeadingCase,
        warnings: [...catalog.warnings, ...result.data.warnings],
      },
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  } catch {
    return {
      map: buildFallbackStyleRoleMap(catalog, docType),
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
