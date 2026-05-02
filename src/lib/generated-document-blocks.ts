import "server-only";
import type { GeneratedDocument } from "@/lib/generated-documents";

export type GeneratedDocumentBlockRole =
  | "applicant_name"
  | "applicant_contact"
  | "date"
  | "recipient"
  | "company"
  | "role"
  | "salutation"
  | "summary"
  | "section_heading"
  | "experience_heading"
  | "project_heading"
  | "education_heading"
  | "skill_line"
  | "bullet"
  | "body_paragraph"
  | "closing"
  | "signoff"
  | "footer";

export type GeneratedDocumentBlock = {
  role: GeneratedDocumentBlockRole;
  text: string;
};

export function resumeContactLines(contact: GeneratedDocument["contact"]): string[] {
  const line1 = [contact.location, contact.phone, contact.email]
    .filter(Boolean)
    .join(" | ");
  const line2 = [contact.linkedin, contact.github, contact.website]
    .filter(Boolean)
    .join(" | ");
  const line3 = contact.workRights ?? null;
  return [line1, line2, line3].filter(Boolean) as string[];
}

export function coverLetterContactLines(contact: GeneratedDocument["contact"]): string[] {
  return [contact.location, contact.phone, contact.email].filter(
    (value): value is string => Boolean(value)
  );
}

function sectionTitle(title: string, sectionHeadingCase: "preserve" | "upper" | "title") {
  if (sectionHeadingCase === "upper") return title.toUpperCase();
  return title;
}

function addSection(
  blocks: GeneratedDocumentBlock[],
  title: string,
  body: GeneratedDocumentBlock[],
  sectionHeadingCase: "preserve" | "upper" | "title"
) {
  if (!body.length) return;
  blocks.push({
    role: "section_heading",
    text: sectionTitle(title, sectionHeadingCase),
  });
  blocks.push(...body);
}

export function generatedDocumentBlocks(
  doc: GeneratedDocument,
  options: { sectionHeadingCase?: "preserve" | "upper" | "title" } = {}
): GeneratedDocumentBlock[] {
  const sectionHeadingCase = options.sectionHeadingCase ?? "preserve";
  if (doc.kind === "cover_letter") {
    const signoff = doc.signoff.endsWith(",") ? doc.signoff : `${doc.signoff},`;
    const blocks: GeneratedDocumentBlock[] = [
      { role: "applicant_name", text: doc.name },
      ...coverLetterContactLines(doc.contact).map((text) => ({
        role: "applicant_contact" as const,
        text,
      })),
      { role: "date", text: doc.date },
      { role: "recipient", text: doc.recipient ?? "Hiring Manager" },
      { role: "company", text: doc.company },
      { role: "role", text: doc.role },
      { role: "salutation", text: `Dear ${doc.recipient ?? "Hiring Manager"}:` },
      ...doc.bodyParagraphs.map((text) => ({
        role: "body_paragraph" as const,
        text,
      })),
      ...(doc.closing ? [{ role: "closing" as const, text: doc.closing }] : []),
      { role: "signoff", text: `${signoff}\n${doc.name}` },
    ];
    return blocks.filter((block) => block.text.trim().length > 0);
  }

  const blocks: GeneratedDocumentBlock[] = [
    { role: "applicant_name", text: doc.name },
    ...resumeContactLines(doc.contact).map((text) => ({
      role: "applicant_contact" as const,
      text,
    })),
  ];

  addSection(
    blocks,
    "Professional Summary",
    doc.summary ? [{ role: "summary", text: doc.summary }] : [],
    sectionHeadingCase
  );
  addSection(
    blocks,
    "Technical Skills",
    doc.skills.map((skill) => ({
      role: "skill_line",
      text: `${skill.category}: ${skill.items.join(", ")}`,
    })),
    sectionHeadingCase
  );
  addSection(
    blocks,
    "Professional Experience",
    doc.experience.flatMap((role) => [
      {
        role: "experience_heading" as const,
        text: `${role.jobTitle}, ${role.company} ${role.dateRange}`,
      },
      ...(role.subtitle ? [{ role: "summary" as const, text: role.subtitle }] : []),
      ...role.bullets.map((text) => ({ role: "bullet" as const, text })),
    ]),
    sectionHeadingCase
  );
  addSection(
    blocks,
    "Projects",
    doc.projects.flatMap((project) => [
      { role: "project_heading" as const, text: project.name },
      ...(project.techStack
        ? [{ role: "skill_line" as const, text: project.techStack }]
        : []),
      ...project.bullets.map((text) => ({ role: "bullet" as const, text })),
    ]),
    sectionHeadingCase
  );
  addSection(
    blocks,
    "Education",
    doc.education.flatMap((item) => [
      {
        role: "education_heading" as const,
        text: `${item.degree}, ${item.school}${item.gradDate ? ` ${item.gradDate}` : ""}`,
      },
      ...(item.notes ? [{ role: "summary" as const, text: item.notes }] : []),
    ]),
    sectionHeadingCase
  );
  addSection(
    blocks,
    "Certifications",
    doc.certifications.map((text) => ({ role: "bullet" as const, text })),
    sectionHeadingCase
  );

  if (doc.footer) blocks.push({ role: "footer", text: doc.footer });
  return blocks.filter((block) => block.text.trim().length > 0);
}
