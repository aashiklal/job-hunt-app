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

export function buildJobParsePrompt(args: { text: string }) {
  const system = `You are a job posting parser. Extract structured details from a raw job posting.

Respond with ONLY a JSON object matching this exact schema — no preamble, no commentary, no markdown code fences:

{
  "company": "string or null",
  "role": "string or null",
  "location": "string or null",
  "salary": "string or null",
  "description": "string or null"
}

Rules:
- "company": the hiring company's name. null if not found.
- "role": the job title. null if not found.
- "location": city, region, remote status, or a combination. null if not found.
- "salary": any salary or compensation range mentioned. null if not found.
- "description": the full job description text, lightly cleaned (remove excessive whitespace/repeated lines). null if the input is too short to be a real job posting.

Respond with ONLY the JSON object.`;

  const userMessage = `Job posting:

${args.text}

Return the JSON.`;

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

export function buildLinkedInConnectionNotePrompt(args: {
  senderName: string;
  recipientName: string;
  recipientTitle: string;
  job: { company: string; role: string };
  baseResume: string;
  connectionReason?: string;
}): { system: string; userMessage: string } {
  const { senderName, recipientName, recipientTitle, job, baseResume, connectionReason } = args;
  const system = `You are helping a job applicant write a LinkedIn connection request note.

LinkedIn connection notes have a hard 300-character limit (including spaces). You MUST stay within 300 characters.

Rules:
- Address the recipient by first name only.
- One sentence on why you are reaching out (role, company, or a genuine shared connection).
- One sentence on the most relevant thing about the applicant that is directly useful to the recipient.
- End with a soft, low-pressure close. No "I would love to pick your brain". No "I am a great fit".
- Do NOT use cliches: "hope this finds you well", "I came across your profile", "I am reaching out because".
- Plain text only. No markdown, no bullet points, no signature block.
- Output ONLY the note text. No preamble, no character count, no commentary.`;

  const userMessage = `Recipient: ${recipientName}, ${recipientTitle}
Company: ${job.company}
Role I am applying for: ${job.role}
My name: ${senderName}
${connectionReason ? `Shared context: ${connectionReason}` : ""}

Most relevant part of my background (use one fact from this):
${baseResume.slice(0, 800)}

Write the connection note. Stay under 300 characters.`;

  return { system, userMessage };
}

export function buildLinkedInRecruiterDMPrompt(args: {
  senderName: string;
  recipientName: string;
  recipientTitle: string;
  job: { company: string; role: string; jobDescription?: string | null };
  baseResume: string;
  tone: "direct" | "warm";
  hasApplied: boolean;
}): { system: string; userMessage: string } {
  const { senderName, recipientName, recipientTitle, job, baseResume, tone, hasApplied } = args;
  const system = `You are helping a job applicant write a cold LinkedIn DM to a recruiter or hiring manager.

The goal is to get a reply -- not to sell the applicant's entire career in one message. Short messages get replies. Long messages get ignored.

Rules:
- Keep it between 60 and 100 words. Hard limit.
- Open with one specific sentence that shows you know the company or the role (not generic flattery).
- State the applicant's single strongest credential that maps to this role. One thing only.
- If hasApplied is true: mention the application and ask if they can flag it internally.
- If hasApplied is false: state you are interested in the role and ask if they have 10 minutes.
- Tone "direct": confident, brief, no fluff.
- Tone "warm": friendly, conversational, still concise.
- No subject line. No sign-off block. No "I hope this message finds you well".
- Plain text only. Output ONLY the message body.`;

  const userMessage = `Recipient: ${recipientName}, ${recipientTitle}
Company: ${job.company}
Role: ${job.role}
Has already applied: ${hasApplied ? "yes" : "no"}
Tone: ${tone}
My name: ${senderName}

Job description (excerpt for context, use to find one specific detail):
${(job.jobDescription ?? "").slice(0, 600)}

My background (use the single most relevant credential):
${baseResume.slice(0, 800)}

Write the LinkedIn DM. 60-100 words, plain text only.`;

  return { system, userMessage };
}

export function buildFollowUpApplicationEmailPrompt(args: {
  senderName: string;
  recipientName?: string;
  job: { company: string; role: string; appliedAt?: string | null };
  daysSinceApplied: number;
}): { system: string; userMessage: string } {
  const { senderName, recipientName, job, daysSinceApplied } = args;
  const system = `You are helping a job applicant write a polite follow-up email after submitting a job application with no response.

Rules:
- Subject line: reference the exact role and company. Keep it short.
- Body: 2 short paragraphs, under 120 words total.
  - Para 1: briefly restate the application (role, company, approximate date). Express continued interest -- one specific sentence about why this role still appeals.
  - Para 2: offer to provide any additional materials and suggest a brief call. Easy, confident close.
- Do NOT sound needy or apologetic. Do NOT say "I just wanted to check in".
- Do NOT re-pitch skills -- this is a courtesy nudge, not a new pitch.
- Sign off with the applicant's name only.
- Output format: "Subject: <subject>" on the first line, blank line, then email body. Plain text only.`;

  const userMessage = `Company: ${job.company}
Role: ${job.role}
Applied approximately: ${job.appliedAt ?? `${daysSinceApplied} days ago`}
Days since application: ${daysSinceApplied}
${recipientName ? `Recipient name: ${recipientName}` : "Recipient: unknown (use 'Hiring Team')"}
My name: ${senderName}

Write the follow-up email. Subject line first, then body. Under 120 words.`;

  return { system, userMessage };
}

export function buildThankYouEmailPrompt(args: {
  senderName: string;
  interviewerName: string;
  interviewerTitle?: string;
  job: { company: string; role: string };
  interviewTopics: string;
  interviewType: "phone_screen" | "technical" | "onsite" | "panel";
}): { system: string; userMessage: string } {
  const { senderName, interviewerName, interviewerTitle, job, interviewTopics, interviewType } = args;
  const system = `You are helping a job applicant write a thank you email after a job interview.

Rules:
- Subject line: "Thank you -- [Role] interview" or a variation. Keep it clear.
- Body: 3 paragraphs, under 150 words total.
  - Para 1: genuine thank you for their time. Reference one specific topic from the interview to prove the note is not a template.
  - Para 2: one brief reinforcement of why this role is a good fit -- tie it to something discussed in the interview. Do NOT re-pitch the resume.
  - Para 3: brief, confident close. Mention you are looking forward to next steps.
- Do NOT use: "It was a pleasure speaking with you", "I wanted to reach out", "I am very excited about the opportunity".
- Warm but professional tone.
- Sign off with the applicant's name.
- Output format: "Subject: <subject>" on line 1, blank line, then body. Plain text only.`;

  const userMessage = `Interviewer: ${interviewerName}${interviewerTitle ? `, ${interviewerTitle}` : ""}
Company: ${job.company}
Role: ${job.role}
Interview type: ${interviewType}
Topics discussed: ${interviewTopics}
My name: ${senderName}

Write the thank you email. Subject line first. Under 150 words.`;

  return { system, userMessage };
}

export function buildInterviewPrepPrompt(args: {
  job: { company: string; role: string; jobDescription?: string | null };
  baseResume: string;
  seniorityLevel: "junior" | "mid" | "senior" | "staff" | "unclear";
  focusAreas?: string;
}): { system: string; userMessage: string } {
  const { job, baseResume, seniorityLevel, focusAreas } = args;
  const system = `You are an expert technical interviewer helping a job applicant prepare for an upcoming interview.

Your job is to generate a realistic set of interview questions the applicant is likely to face, based on the job description and their resume. The questions should feel like they came from a real interviewer at this company, not a generic list.

Respond with ONLY a JSON object matching this exact schema -- no preamble, no commentary, no markdown code fences:

{
  "behavioral": [
    { "question": "string", "hint": "string -- what the interviewer is really assessing with this question" }
  ],
  "technical": [
    { "question": "string", "hint": "string" }
  ],
  "roleSpecific": [
    { "question": "string", "hint": "string" }
  ],
  "cultureFit": [
    { "question": "string", "hint": "string" }
  ],
  "questionsToAskThem": [
    "string"
  ]
}

Rules:
- behavioral: 4-5 STAR-format questions. Tailor to the seniority level and the skills on the resume.
- technical: 4-6 questions. For junior roles: foundational CS + the primary stack. For senior+: system design, trade-offs, architecture decisions. Ground these in the specific technologies mentioned in the JD.
- roleSpecific: 3-4 questions about this specific role's responsibilities (not general tech).
- cultureFit: 2-3 questions about working style, collaboration, or values. Use company context from the JD if available.
- questionsToAskThem: 4-5 sharp questions the applicant should ask the interviewer. These should not be answerable from the JD.
- hint: one sentence. What the interviewer is probing for.

Respond with ONLY the JSON object.`;

  const userMessage = `Company: ${job.company}
Role: ${job.role}
Seniority level: ${seniorityLevel}
${focusAreas ? `Focus areas (user specified): ${focusAreas}` : ""}

Job description:
${(job.jobDescription ?? "(No job description provided)").slice(0, 2000)}

Applicant's resume (to tailor behavioral questions to their actual experience):
${baseResume.slice(0, 1200)}

Generate the interview questions. Return ONLY the JSON object.`;

  return { system, userMessage };
}
