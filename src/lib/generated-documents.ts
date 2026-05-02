import "server-only";
import { z } from "zod";
import { parseResumeContactInfo } from "@/lib/export/template-data";
import { themeCapacityPrompt, type ThemeCapacity } from "@/lib/export/pixel-theme-contract";

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
  const system = `You are a senior resume editor and ATS specialist. Return ONLY valid JSON matching the schema below — no prose, no fences.

## Core constraint
Every fact in the output must be traceable to the base resume. Never invent employers, titles, dates, tools, metrics, or accomplishments. You may reframe an existing fact for maximum relevance, but you may not fabricate one.

## Step 1 — read the JD first
Extract the 5-8 skills, tools, outcomes, and phrases the role emphasises most. These are your target keywords. Use the JD's exact wording where the base resume genuinely supports it — ATS systems match exact strings, but unsupported keywords are fabrication.

## Step 2 — tailor each section

### Summary (always required when a JD is provided)
Write 2-3 sentences. Sentence 1: professional identity + years of experience if the resume supports it + primary domain. Sentence 2: the 1-2 differentiators from the base resume that map most directly to the JD's core requirement, using the JD's own terminology. Sentence 3: a forward-looking statement of what the candidate brings to this specific role. Set to null only if no job description was provided.

### Skills
Order skill categories so the most JD-relevant category appears first. Within each category, list items most relevant to the JD first. Remove items with no JD overlap. Do not add skills not present in the base resume.

### Experience
Section ordering: for technical roles (engineering, data, product, design), place Skills before Experience. For all other roles, place Experience first.
- Use present tense for bullets in the candidate's current role; past tense for all previous roles.
- Every bullet: strong action verb + quantified outcome + brief context. Example: "Reduced API p99 latency by 40% by migrating synchronous calls to an async queue."
- If the base resume has a metric, preserve it exactly. If no metric exists, use explicit scope from the resume (team size, user count, frequency, revenue range). Never fabricate a number.
- 10-22 words per bullet. No bullets that are pure task descriptions with no outcome.
- 4-6 bullets for the most recent or most relevant role; 2-4 for older roles; drop roles with zero overlap to this JD.
- subtitle field: use for team context, tech stack summary, or reporting structure (e.g. "Led a team of 6 engineers", "React / Node.js / AWS"). Leave null if nothing adds meaningful context.
- dateRange format: "Jan 2022 - Mar 2024" or "Jan 2022 - Present". Abbreviate months to 3 letters.
- experience array order: most recent role first, oldest last. Roles with "Present" as the end date come before all past roles.

### Projects
Include only projects that directly reinforce a JD requirement. 2-3 bullets per project, same rules as experience bullets. Remove projects with no overlap.

### Education
Keep as-is from the base resume. Do not reorder or embellish.

### Certifications
Keep only certifications relevant to the role. Drop the rest.

### Footer
Use only for "References available upon request" or a visa/work-rights statement if not already in contact. Leave null otherwise.

## Output length
${themeCapacityPrompt(themeCapacity)}
Default to enough relevant content for a polished two-page DOCX unless the Pixel Theme Capacity says compact. Only produce a shorter result if the base resume genuinely lacks content to fill two pages or the Pixel Theme Capacity is compact. Do not compress or omit role-relevant material just to save space; do trim repetition, generic duties, and unsupported claims.

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
  "education": [{"degree":"string","school":"string","gradDate":"string|null","notes":"string|null"}],
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
  const system = `You are a senior career writer. Return ONLY valid JSON matching the schema below — no prose, no fences.

## Core constraint
Every claim in the letter must be supported by the base resume. Do not invent facts, titles, metrics, or accomplishments.

## Step 0 — classify before writing
Read the base resume and the job role/JD, then assign BOTH labels silently (do not output them).

Seniority:
- fresh-grad: graduation date within the last 2 years, OR total professional experience under 1 year
- experienced: otherwise

Domain:
- it-tech: role or JD centres on software engineering, CS, data, cloud/DevOps, cybersecurity, networking, IT support, QA, or similar technical disciplines
- other: all other roles

These two labels independently control which rules apply in the sections below.

## When no job description is provided
Write a strong general-purpose letter: hook on the company and role by name, use the candidate's strongest resume-supported credential as proof, and close confidently. Skip JD-specific mirroring.

## Paragraph structure
The bodyParagraphs array must contain 2-4 items in this order:

**First paragraph (40-65 words) — the hook.**
Open with a specific observation about what this role or company is trying to accomplish — frame it from their perspective, not yours. Close the paragraph with your single strongest credential that maps directly to that need. Never open with "I am writing to", "I am excited about", "I am applying for", or any variation of those phrases.

**Middle paragraph(s) — the proof (65-100 words each, 1-2 paragraphs).**
Expand on the most relevant experience from the resume. Pick one concrete achievement, name the technology or context, state the measurable outcome if the resume includes one, and connect it explicitly to a requirement in the JD. Mirror the JD's own terminology only where supported. If a second proof point adds meaningfully different signal (different skill domain, different seniority evidence, culture fit), add a second middle paragraph. Otherwise use only one.

**Last paragraph (30-50 words) — the close.**
Forward-looking and confident. Reference next steps without being pushy. Offer to provide any additional information. Do not re-pitch skills here.

## Fresh-grad rules (apply only when seniority = fresh-grad)
- Hook: may open with a specific academic project, capstone, or certification that maps directly to the role's core need; not required to frame the company's problem first.
- Middle paragraph(s): draw from academic projects, coursework, hackathons, internships, and open-source contributions as primary evidence; no professional role is required.
- Learning velocity is a valid proof point — e.g., built or shipped X within a course or self-directed timeframe.
- Close: may express genuine eagerness to grow in the role; keep it confident, not apologetic. "I am a quick learner" remains banned.

## IT-tech rules (apply only when domain = it-tech)
- Mirror tech stack keywords from the JD verbatim — ATS systems match exact strings.
- Certifications (CompTIA, AWS, Azure, GCP, Cisco, etc.) are valid named proof points.
- If GitHub, a portfolio URL, or LinkedIn appear in the resume contact section, reference the most relevant one as supporting evidence.
- Prefer concrete tool names and measurable outcomes over vague buzzwords.
- fresh-grad + it-tech combined: lead the hook with the single strongest project or certification that addresses the JD's top requirement; name the tech stack explicitly in the middle paragraphs; certifications count as credentials equivalent to professional experience; in the close, connect the candidate's specific tech interests to what the company actually builds or uses.

## Tone and style
- Professional but human — write like a confident practitioner, not a form letter.
- Mirror the company's own language from the JD.
- Use the company name at least once in the body.
- ${themeCapacityPrompt(themeCapacity)}
- Keep the full letter to one page: usually 250-330 words across the body paragraphs unless Pixel Theme Capacity gives a tighter target.
- Do not copy resume bullets verbatim. Turn evidence into a narrative that explains why it matters for this role.
- Active voice throughout. No passive constructions.
- Banned phrases: "great fit", "I am passionate about", "team player", "hard worker", "fast-paced", "I believe I would", "I feel that", "please find attached", "I hope this finds you well", "synergy", "leverage" (as a verb), "I am a quick learner".

## Field rules
- recipient: set to the hiring manager's name if it appears in the JD or resume. Otherwise null — the renderer will substitute "Hiring Manager".
- company: use the supplied company exactly unless the JD clearly names a more specific hiring entity.
- role: use the supplied role exactly unless the JD clearly names a more specific role title.
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
