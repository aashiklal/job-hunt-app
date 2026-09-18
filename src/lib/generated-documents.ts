import "server-only";
import { z } from "zod";
import { parseResumeContactInfo } from "@/lib/export/template-data";
import { themeCapacityPrompt, type ThemeCapacity } from "@/lib/export/pixel-theme-contract";
import { APPLICATION_TAILORING_RULES } from "@/lib/tailoring-rules";

export const generatedResumeSchema = z.object({
  kind: z.literal("resume"),
  name: z.string().min(1),
  contact: z.object({
    location: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    linkedin: z.string().nullable(),
    github: z.string().nullable(),
    website: z.string().nullable(),
    workRights: z.string().nullable(),
  }),
  summary: z.string().nullable(),
  skills: z.array(
    z.object({
      category: z.string().min(1),
      items: z.array(z.string().min(1)),
    })
  ),
  experience: z.array(
    z.object({
      jobTitle: z.string().min(1),
      company: z.string().min(1),
      dateRange: z.string().min(1),
      subtitle: z.string().nullable(),
      bullets: z.array(z.string().min(1)),
    })
  ),
  projects: z.array(
    z.object({
      name: z.string().min(1),
      techStack: z.string().nullable(),
      bullets: z.array(z.string().min(1)),
    })
  ),
  education: z.array(
    z.object({
      degree: z.string().min(1),
      school: z.string().min(1),
      gradDate: z.string().nullable(),
      notes: z.string().nullable(),
    })
  ),
  certifications: z.array(z.string().min(1)),
  footer: z.string().nullable(),
});

export const generatedCoverLetterSchema = z.object({
  kind: z.literal("cover_letter"),
  name: z.string().min(1),
  contact: generatedResumeSchema.shape.contact,
  date: z.string().min(1),
  recipient: z.string().nullable(),
  company: z.string().min(1),
  role: z.string().min(1),
  bodyParagraphs: z.array(z.string().min(1)).min(2).max(4),
  closing: z.string().nullable(),
  signoff: z.string().min(1),
});

export const generatedDocumentSchema = z.discriminatedUnion("kind", [
  generatedResumeSchema,
  generatedCoverLetterSchema,
]);

export type GeneratedResume = z.infer<typeof generatedResumeSchema>;
export type GeneratedCoverLetter = z.infer<typeof generatedCoverLetterSchema>;
export type GeneratedDocument = z.infer<typeof generatedDocumentSchema>;

type JobForGeneration = {
  company: string;
  role: string;
  location?: string | null;
  jobDescription?: string | null;
};

function ordinalSuffix(d: number): string {
  const v = d % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (v % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function todayLongDate(): string {
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleDateString("en-GB", { month: "long" });
  return `${day}${ordinalSuffix(day)} ${month} ${now.getFullYear()}`;
}

export function buildStructuredResumePrompt(args: {
  baseResume: string;
  job: JobForGeneration;
  themeCapacity?: ThemeCapacity | null;
}) {
  const { baseResume, job, themeCapacity } = args;
  const system = `You are a senior resume editor and ATS specialist. Return ONLY valid JSON matching the schema below - no prose, no fences.

${APPLICATION_TAILORING_RULES}

## Tailor each section

### Summary
Write 2-3 concise sentences when there is enough evidence for a useful summary: the applicant's actual professional identity and the 1-2 strongest differentiators relevant to this role. Include years of experience only if explicitly stated and applicable to the claim. Do not adopt the target title as a title already held, inflate seniority, or add a generic objective. If there is no JD, a concise evidence-based general summary is acceptable. Set to null if it would only repeat generic claims.

### Skills
Order categories and items by relevance to the main responsibilities. Include skills explicitly listed or unambiguously demonstrated in the base resume, preserving qualifiers such as "basic" or "coursework". Retain useful foundational and transferable skills even without an exact keyword match; remove distracting or redundant items. Do not infer a whole technology stack from one named tool. Without a JD, retain the strongest skills appropriate to the supplied role.

### Experience
The renderer controls section ordering. Prioritise content within the schema's arrays and fields.
- Preserve employer names and actual job titles, including internship, contract, part-time, and volunteer context.
- Order bullets within each role by relevance and evidence strength. Use present tense for ongoing responsibilities and past tense for completed achievements, including those in a current role.
- Build bullets from a precise action plus supported context and, when available, a supported result. If there is no result or metric, a concrete responsibility or deliverable is valid. Never invent impact to satisfy a bullet formula.
- Aim for roughly 12-30 words per bullet, allowing more when needed to preserve meaningful context or qualifiers. Avoid vague intensifiers and repeated opening verbs where a precise alternative exists.
- Usually use 3-5 distinct bullets for the strongest relevant roles and 1-3 for others, but only as many as the evidence supports. Do not split one fact into several repetitive bullets to meet a count.
- Preserve recent employment and meaningful career progression even when not directly related; compress unrelated roles to brief entries. Omit older unrelated roles only when space requires it and omission would not create a misleading career narrative.
- subtitle: use only for explicit, useful team context, tech stack, or scope from that role. Otherwise null.
- dateRange: abbreviate supplied months to 3 letters ("Jan 2022 - Mar 2024"). Preserve year-only dates as year-only; never invent missing months or end dates, or assume a role is current.
- experience array order: most recent role first, oldest last. Roles with "Present" as the end date come before all past roles.

### Projects
Select projects that provide relevant evidence not already covered by experience, including transferable skills. Use 1-3 supported bullets each. Preserve academic, personal, open-source, and in-progress context; do not imply users, deployment, or commercial impact without evidence. With no JD, select projects relevant to the supplied role.

### Education
Keep as-is from the base resume. Do not reorder or embellish.
For gradDate, preserve the FULL date or date range exactly as shown in the base resume, including expected graduation status. Do not truncate to just the end date or invent missing dates.

### Certifications
Keep certifications relevant to the role, including exact names and any supplied expiry or in-progress status. Do not turn training or an exam in progress into an earned credential.

### Identity and contact
Copy the applicant's name and contact details from the base resume. Preserve URLs exactly. Use null for missing contact fields; never substitute the job location for the applicant's location or infer work rights from address or education.

### Footer
Use only for "References available upon request" or a visa/work-rights statement if not already in contact. Leave null otherwise.

## Output length
${themeCapacityPrompt(themeCapacity)}
Use up to two pages by default when the relevant evidence warrants it, or one page for compact capacity. Length is a ceiling and a guide, not a quota: never pad to fill a page. Under space pressure, remove repetition and older low-relevance details before cutting strong proof of central requirements. Preserve factual qualifiers when shortening.

JSON schema:
{
  "kind": "resume",
  "name": "string",
  "contact": {
    "location": "string|null",
    "phone": "string|null",
    "email": "string|null",
    "linkedin": "string|null",
    "github": "string|null",
    "website": "string|null",
    "workRights": "string|null"
  },
  "summary": "string|null",
  "skills": [{"category":"string","items":["string"]}],
  "experience": [{"jobTitle":"string","company":"string","dateRange":"string","subtitle":"string|null","bullets":["string"]}],
  "projects": [{"name":"string","techStack":"string|null","bullets":["string"]}],
  "education": [{"degree":"string","school":"string","gradDate":"string|null — full date range e.g. \"Feb 2022 - Dec 2023\"","notes":"string|null"}],
  "certifications": ["string"],
  "footer": "string|null"
}`;

  const userMessage = `Job:
Company: ${job.company}
Role: ${job.role}${job.location ? `\nLocation: ${job.location}` : ""}

Job description:
${job.jobDescription ?? "(No job description provided)"}

Base resume:
${baseResume}

Return only the tailored resume JSON.`;

  return { system, userMessage };
}

export function buildStructuredCoverLetterPrompt(args: {
  baseResume: string;
  job: JobForGeneration;
  userName: string;
  themeCapacity?: ThemeCapacity | null;
}) {
  const { baseResume, job, userName, themeCapacity } = args;
  const system = `You are a senior career writer. Return ONLY valid JSON matching the schema below - no prose, no fences.

${APPLICATION_TAILORING_RULES}

## Adapt to the applicant and role
Choose evidence based on relevant experience and demonstrated responsibility, not graduation recency alone. A recent graduate may already have substantial experience; a career changer may have valuable experience in another field. Do not call someone a graduate, junior, senior, leader, or expert unless supported. Adapt the vocabulary and proof points to the actual profession, whether technical or non-technical.

## When no job description is provided
Name the company and role, use the strongest relevant resume-supported example, and close confidently. Do not invent what the company is trying to accomplish or claim to know its culture. A straightforward opening is preferable to fabricated personalisation.

## Paragraph structure
The bodyParagraphs array must contain 2-4 items. Default to 3; use 4 only when a second distinct proof point warrants its own paragraph. For a compact two-paragraph letter, combine the opening and first proof in paragraph 1, then any additional evidence and the close in paragraph 2. Do not require a separate middle paragraph when using 2 items.

Opening: establish the strongest supported connection between the applicant and a central responsibility. Use a specific need stated in the JD or lead with a relevant achievement or project. Avoid generic enthusiasm, flattery, and claims about unstated company problems.

Proof: develop 1-2 concrete examples using the actual situation, the applicant's contribution, and the result or deliverable supported by the resume. Explain the connection to the target work without promising the same outcome for this employer. Choose complementary examples rather than repeating the summary or retelling the entire career. If a result is not documented, describe the contribution accurately without adding a metric or inferred benefit.

Close: use one or two natural sentences inviting a conversation about the role. Do not repeat the evidence, assume an interview, promise availability or relocation, or introduce new credentials.

## Evidence for different backgrounds
- When relevant professional experience is limited, use academic projects, internships, volunteering, coursework, or personal work with their context clearly identified. Only describe learning speed if the source documents the timeframe and accomplishment.
- For experienced applicants, favour proof of the role's required scope: delivery, judgment, collaboration, specialist knowledge, or leadership as supported. Do not force a leadership narrative onto an individual contributor.
- For technical roles, name tools where they explain the work; do not insert a stack list into every paragraph. Certifications demonstrate the credential earned, not equivalent professional experience.
- Reference a supplied portfolio link only when the resume connects it to relevant work. A URL alone does not prove what it contains. Do not invent repository contents or imply you reviewed external links.

## Tone and style
- Professional but human - write like a confident practitioner, not a form letter.
- Use the JD's relevant terminology naturally, preserving the applicant's own level of expertise. Match spelling conventions consistently with the supplied materials.
- Use the company name at least once in the body.
- ${themeCapacityPrompt(themeCapacity)}
- Keep the full letter to one page: usually 200-300 words across the body paragraphs, shorter for compact capacity or limited evidence. Paragraph and word targets never justify padding or invented detail.
- Do not copy resume bullets verbatim. Turn evidence into a narrative that explains why it matters for this role.
- Prefer clear, active sentences and varied rhythm. Avoid formulaic transitions and unsupported superlatives.
- Banned phrases: "great fit", "I am passionate about", "team player", "hard worker", "fast-paced", "I believe I would", "I feel that", "please find attached", "I hope this finds you well", "synergy", "leverage" (as a verb), "I am a quick learner".

## Field rules
- name: use the applicant's name from the base resume, falling back to the supplied applicant name if missing. Never use another person's name found in the source.
- contact: copy applicant contact details from the base resume, preserving URLs exactly; use null for missing fields. Do not infer location or work rights from the job requirements.
- recipient: use a name only if the JD explicitly identifies that person as the hiring contact for this role. Never select a reference, former manager, or unrelated person from the resume. Otherwise null - the renderer will substitute "Hiring Manager".
- company and role: use the supplied company and role exactly. Do not silently switch the application target based on other entities mentioned in the JD.
- closing: use "Thank you for your consideration." if the tone is formal; null if the last body paragraph already closes naturally.
- signoff: "Sincerely," for formal tone; "Best regards," for conversational tone.
- date: use the supplied today's date exactly as given.

JSON schema:
{
  "kind": "cover_letter",
  "name": "string",
  "contact": {
    "location": "string|null",
    "phone": "string|null",
    "email": "string|null",
    "linkedin": "string|null",
    "github": "string|null",
    "website": "string|null",
    "workRights": "string|null"
  },
  "date": "string",
  "recipient": "string|null",
  "company": "string",
  "role": "string",
  "bodyParagraphs": ["string"],
  "closing": "string|null",
  "signoff": "string"
}`;

  const userMessage = `Job:
Company: ${job.company}
Role: ${job.role}${job.location ? `\nLocation: ${job.location}` : ""}

Today's date: ${todayLongDate()}
Applicant name: ${userName}

Job description:
${job.jobDescription ?? "(No job description provided)"}

Base resume:
${baseResume}

Return only the cover letter JSON.`;

  return { system, userMessage };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseEndDate(dateRange: string): number {
  const end = dateRange.split(" - ").at(-1)?.trim() ?? "";
  if (!end || end.toLowerCase() === "present") return Date.now();
  const [mon, yr] = end.split(" ");
  const m = MONTHS.indexOf(mon);
  return m !== -1 && yr ? new Date(parseInt(yr, 10), m).getTime() : 0;
}

export function sortExperienceByDate(doc: GeneratedResume): GeneratedResume {
  return {
    ...doc,
    experience: [...doc.experience].sort(
      (a, b) => parseEndDate(b.dateRange) - parseEndDate(a.dateRange)
    ),
  };
}

function contactLine(contact: GeneratedResume["contact"]): string {
  return [
    contact.location,
    contact.phone,
    contact.email,
    contact.linkedin,
    contact.github,
    contact.website,
    contact.workRights,
  ]
    .filter(Boolean)
    .join(" | ");
}

export function generatedDocumentToMarkdown(doc: GeneratedDocument): string {
  if (doc.kind === "cover_letter") {
    const headerLines = [
      `**${doc.name}**`,
      doc.contact.location,
      doc.contact.phone,
      doc.contact.email,
    ].filter((v): v is string => Boolean(v));
    return [
      headerLines.join("  \n"),
      "",
      doc.date,
      "",
      `Dear ${doc.recipient ?? "Hiring Manager"},`,
      "",
      ...doc.bodyParagraphs.flatMap((p) => [p, ""]),
      doc.closing,
      "",
      doc.signoff,
      doc.name,
    ]
      .filter((part) => part !== null)
      .join("\n")
      .trim();
  }

  const lines: string[] = [`# ${doc.name}`];
  const contact = contactLine(doc.contact);
  if (contact) lines.push(contact);
  if (doc.summary) lines.push("", "## Summary", doc.summary);
  if (doc.skills.length) {
    lines.push("", "## Skills");
    for (const skill of doc.skills) {
      lines.push(`**${skill.category}:** ${skill.items.join(", ")}`);
    }
  }
  if (doc.experience.length) {
    lines.push("", "## Experience");
    for (const role of doc.experience) {
      lines.push("", `### ${role.jobTitle}, ${role.company} ${role.dateRange}`);
      if (role.subtitle) lines.push(role.subtitle);
      for (const bullet of role.bullets) lines.push(`- ${bullet}`);
    }
  }
  if (doc.projects.length) {
    lines.push("", "## Projects");
    for (const project of doc.projects) {
      lines.push("", `### ${project.name}`);
      if (project.techStack) lines.push(project.techStack);
      for (const bullet of project.bullets) lines.push(`- ${bullet}`);
    }
  }
  if (doc.education.length) {
    lines.push("", "## Education");
    for (const education of doc.education) {
      const date = education.gradDate ? ` ${education.gradDate}` : "";
      lines.push("", `### ${education.degree}, ${education.school}${date}`);
      if (education.notes) lines.push(education.notes);
    }
  }
  if (doc.certifications.length) {
    lines.push("", "## Certifications");
    for (const cert of doc.certifications) lines.push(`- ${cert}`);
  }
  if (doc.footer) lines.push("", doc.footer);
  return lines.join("\n").trim();
}

export function fallbackContactFromResume(markdown: string) {
  return parseResumeContactInfo(markdown);
}
