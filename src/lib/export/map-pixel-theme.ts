import "server-only";
import { z } from "zod";
import { callStructured } from "@/lib/ai";
import type { DocxStructure } from "@/lib/export/extract-docx-structure";

const MODEL = "claude-haiku-4-5-20251001";

export const pixelThemeRegionRoleSchema = z.enum([
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
  "decorative_sample",
]);

export const pixelThemeRegionSchema = z.object({
  id: z.string(),
  role: pixelThemeRegionRoleSchema,
  repeatable: z.boolean(),
});

export const pixelThemeMapSchema = z.object({
  version: z.literal(1),
  docType: z.enum(["resume", "cover_letter"]),
  regions: z.array(pixelThemeRegionSchema),
  warnings: z.array(z.string()),
});

export type PixelThemeMap = z.infer<typeof pixelThemeMapSchema>;
export type PixelThemeRegionRole = z.infer<typeof pixelThemeRegionRoleSchema>;

function fallbackRole(
  text: string,
  docType: "resume" | "cover_letter",
  index: number
): PixelThemeRegionRole {
  const normalized = text.toLowerCase();
  if (docType === "cover_letter") {
    if (index === 0 || normalized.includes("name")) return "applicant_name";
    if (normalized.includes("@") || /\b\d{6,}\b/.test(normalized)) return "applicant_contact";
    if (/\b\d{1,2}\s+[a-z]+\s+\d{4}\b/i.test(text)) return "date";
    if (normalized.includes("dear")) return "salutation";
    if (normalized.includes("sincerely") || normalized.includes("regards")) return "signoff";
    return "body_paragraph";
  }

  if (index === 0) return "applicant_name";
  if (normalized.includes("@") || /\b\d{6,}\b/.test(normalized)) return "applicant_contact";
  if (/summary|profile|objective/.test(normalized)) return "section_heading";
  if (/experience|employment|work history/.test(normalized)) return "section_heading";
  if (/education|skills|projects|certifications/.test(normalized)) return "section_heading";
  if (/^[•\-]/.test(text.trim()) || text.length > 80) return "bullet";
  return "decorative_sample";
}

export function buildFallbackPixelThemeMap(
  structure: DocxStructure,
  docType: "resume" | "cover_letter"
): PixelThemeMap {
  return {
    version: 1,
    docType,
    regions: structure.regions.map((region, index) => {
      const role = fallbackRole(region.text, docType, index);
      return {
        id: region.id,
        role,
        repeatable: role === "body_paragraph" || role === "bullet",
      };
    }),
    warnings: [
      ...structure.warnings,
      "AI mapping was unavailable; used heuristic Pixel Theme mapping.",
    ],
  };
}

export async function mapPixelTheme(
  structure: DocxStructure,
  docType: "resume" | "cover_letter"
): Promise<{ map: PixelThemeMap; inputTokens: number; outputTokens: number }> {
  if (structure.regions.length < 2) {
    return {
      map: buildFallbackPixelThemeMap(structure, docType),
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  const regionSummary = structure.regions
    .slice(0, 80)
    .map((region, index) =>
      [
        `index=${index}`,
        `id=${region.id}`,
        `part=${region.partName}`,
        region.inHeader ? "header" : null,
        region.inFooter ? "footer" : null,
        region.inTable ? "table" : null,
        region.inTextBox ? "textbox" : null,
        `text=${JSON.stringify(region.text.slice(0, 220))}`,
      ]
        .filter(Boolean)
        .join(" | ")
    )
    .join("\n");

  const system = `You map DOCX visual reference text regions to generated job-application document fields.

Return ONLY JSON matching this schema:
{
  "version": 1,
  "docType": "${docType}",
  "regions": [{"id":"string","role":"role","repeatable":true}],
  "warnings": ["string"]
}

Allowed roles:
applicant_name, applicant_contact, date, recipient, company, role, salutation, summary, section_heading, experience_heading, project_heading, education_heading, skill_line, bullet, body_paragraph, closing, signoff, footer, decorative_sample.

General rules:
- Existing text is sample content only - do not treat it as real data.
- Map applicant header/name/contact dynamically; never leave sample header text static.
- Mark regions that should receive repeated content as repeatable: true.
- Decorative text, blank spacers, visual dividers, and horizontal rules should use decorative_sample.
- Include every region id exactly once.

For RESUME documents:
- applicant_name: the candidate's full name - usually the first and visually largest text on the page.
- applicant_contact: lines containing location, phone/email, social links (LinkedIn, GitHub), or visa/work rights. Typically 1-3 lines; each separate line is its own region.
- section_heading: section titles such as PROFESSIONAL SUMMARY, TECHNICAL SKILLS, PROFESSIONAL EXPERIENCE, PROJECTS, EDUCATION, CERTIFICATIONS (or any capitalisation). Short, standalone lines that label a section.
- experience_heading: lines combining a job title + company name, often with a date range or location - e.g. "Software Engineer, Acme Corp | Jan 2022 - Present". Longer than section_heading.
- project_heading: lines that are a project name, optionally followed by a tech stack summary.
- education_heading: lines combining a degree name + institution, e.g. "Bachelor of Science, University of Sydney".
- skill_line: lines in "Category: item, item, item" format, or comma-separated skill lists. Usually inside the Skills section.
- bullet: indented bullet points or lines starting with a bullet character (•, -, *). Mark as repeatable: true.
- summary: the prose paragraph directly below the summary/profile section heading. Not a bullet.
- footer: references line ("References available upon request") or visa/work-rights statement at the very bottom of the document.

For COVER LETTER documents:
- applicant_name: candidate's full name at the top of the letter - usually bold or large.
- applicant_contact: contact detail lines near the top (location, phone, email) - typically 1-3 short lines.
- date: the date line (e.g. "2 May 2026" or "May 2, 2026").
- recipient: the hiring manager's name or title (e.g. "Ms Jane Smith" or "Hiring Manager").
- company: the company name line (standalone, not part of the salutation).
- salutation: the greeting line starting with "Dear".
- body_paragraph: the main letter paragraphs - typically 3-4 paragraphs. Mark as repeatable: true.
- closing: a closing sentence such as "Thank you for your consideration." or "I look forward to hearing from you."
- signoff: the farewell phrase + candidate name, e.g. "Sincerely, / John Smith".
- footer: any footer text below the signature.`;

  const userMessage = `Document type: ${docType}

Text regions:
${regionSummary}

Map these regions.`;

  try {
    const result = await callStructured(
      { system, userMessage, model: MODEL, maxTokens: 4096 },
      pixelThemeMapSchema
    );
    const validIds = new Set(structure.regions.map((region) => region.id));
    const seen = new Set<string>();
    const regions = result.data.regions.filter((region) => {
      if (!validIds.has(region.id) || seen.has(region.id)) return false;
      seen.add(region.id);
      return true;
    });
    for (const region of structure.regions) {
      if (!seen.has(region.id)) {
        regions.push({
          id: region.id,
          role: fallbackRole(region.text, docType, regions.length),
          repeatable: false,
        });
      }
    }
    return {
      map: {
        version: 1,
        docType,
        regions,
        warnings: [...structure.warnings, ...result.data.warnings],
      },
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  } catch {
    return {
      map: buildFallbackPixelThemeMap(structure, docType),
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
