export function buildResumeTailorPrompt(args: {
  baseResume: string;
  job: {
    company: string;
    role: string;
    location?: string | null;
    jobDescription?: string | null;
  };
}) {
  const { baseResume, job } = args;
  const system = `You are an expert resume editor helping a job applicant tailor their existing base resume for a specific role.

Your job is to rewrite the user's resume so it is targeted at the specific job description, while staying truthful. You may NOT add experience, skills, or accomplishments that are not in the original resume. You MAY:
- Reorder bullet points to put the most relevant ones first
- Rephrase bullet points to use language and keywords from the job description (where the original facts genuinely match)
- Adjust the summary or objective section to speak directly to the role
- Drop bullet points that are clearly irrelevant to this role (but never lie about experience)
- Adjust skill ordering to put the most relevant skills first

Output the tailored resume in clean markdown. Use # for the candidate's name as the top heading, ## for major sections (Experience, Education, Skills, etc.), ### for individual roles, and - for bullet points. Do not include any preamble, explanation, or commentary — just the tailored resume.

The user's base resume may be in plain text or markdown; treat both the same way.`;

  const userMessage = `Job:
Company: ${job.company}
Role: ${job.role}${job.location ? `\nLocation: ${job.location}` : ""}

Job description:
${job.jobDescription ?? "(No job description provided)"}

Base resume:
${baseResume}

Now tailor the base resume for this job. Output only the tailored resume in markdown.`;

  return { system, userMessage };
}

export function buildCoverLetterPrompt(args: {
  baseResume: string;
  job: {
    company: string;
    role: string;
    location?: string | null;
    jobDescription?: string | null;
  };
  userName?: string;
}) {
  const { baseResume, job, userName } = args;
  const system = `You are helping a job applicant write a professional cover letter for a specific role.

Your job is to write a concise, warm, professional cover letter (3 to 4 paragraphs) tailored to the company and role. The letter should:
- Open with a specific reason the applicant is interested in THIS role at THIS company (not generic)
- Highlight 2 to 3 specific accomplishments from the base resume that match the job description
- Close with a brief, confident call to action

Constraints:
- Do NOT invent facts. Only use experience, skills, and accomplishments from the base resume.
- Do NOT use cliches like "I am writing to express my interest in" or "I believe I would be a great fit".
- Keep it under 350 words.
- Output in clean markdown. No preamble or commentary — just the letter itself.`;

  const userMessage = `Job:
Company: ${job.company}
Role: ${job.role}${job.location ? `\nLocation: ${job.location}` : ""}

Job description:
${job.jobDescription ?? "(No job description provided)"}

Base resume:
${baseResume}

${userName ? `The applicant's name is ${userName}.` : ""}
Now write the cover letter. Output only the letter in markdown.`;

  return { system, userMessage };
}

export function buildJDAnalysisPrompt(args: { jobDescription: string }) {
  const { jobDescription } = args;
  const system = `You are an expert job description analyzer helping a job applicant understand a role before applying.

Your job is to read a job description and return a structured analysis. Respond with ONLY a JSON object matching this exact schema, no preamble, no commentary, no markdown code fences:

{
  "summary": "string — 2-3 sentence plain English summary of what the role actually does",
  "seniorityLevel": "junior" | "mid" | "senior" | "staff" | "unclear",
  "requiredSkills": ["string", ...],
  "niceToHaves": ["string", ...],
  "keywordsForResume": ["string", ...],
  "redFlags": ["string", ...]
}

Notes on each field:
- summary: what the role actually does, in plain English. No buzzwords.
- seniorityLevel: your best guess. "unclear" is acceptable.
- requiredSkills: skills the candidate MUST have to be considered. Hard skills only (languages, tools, frameworks). Not soft skills.
- niceToHaves: skills the JD mentions as bonus or preferred. Empty array if none.
- keywordsForResume: terminology and phrases from the JD that the candidate should naturally include in their resume. 5-15 items.
- redFlags: signs the role might be misrepresented or have poor working conditions. Examples: vague responsibilities, "wear many hats", "fast-paced startup environment" used as a euphemism, missing salary range, demands a wide range of unrelated skills suggesting the role is doing 3 jobs. Empty array if the JD looks clean.

Respond with ONLY the JSON object. No code fences. No preamble. No explanation.`;

  const userMessage = `Job description:

${jobDescription}

Return the JSON analysis.`;

  return { system, userMessage };
}
