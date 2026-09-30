export function buildJobParsePrompt(args: { text: string }) {
  const system = `You are a job posting parser. Extract structured details from a raw job posting.

Respond with ONLY a JSON object matching this exact schema - no preamble, no commentary, no markdown code fences:

{
  "company": "string or null",
  "role": "string or null",
  "location": "string or null",
  "salary": "string or null",
  "description": "string or null",
  "analysis": {
    "summary": "string",
    "seniorityLevel": "junior" | "mid" | "senior" | "staff" | "unclear",
    "requiredSkills": ["string"],
    "niceToHaves": ["string"],
    "keywordsForResume": ["string"],
    "interviewLikelyFocus": ["string"],
    "redFlags": ["string"]
  }
}

Rules:
- "company": the hiring company's name. null if not found.
- "role": the job title. null if not found.
- "location": city, region, remote status, or a combination. null if not found.
- "salary": any salary or compensation range mentioned. null if not found.
- "description": the full job description text, lightly cleaned (remove excessive whitespace/repeated lines). null if the input is too short to be a real job posting.
- "analysis": structured job-description analysis for Fit Score and applicant decision support. Use the same cleaned job description as evidence.
- "summary": 1-2 plain-English sentences about day-to-day work and success criteria.
- "requiredSkills": hard requirements needed to pass screening. No generic soft skills.
- "niceToHaves": skills labelled preferred, bonus, advantageous, or similar.
- "keywordsForResume": 8-20 exact strings from the posting worth mirroring in a resume.
- "interviewLikelyFocus": 3-6 likely interview topics signalled by the posting.
- "redFlags": concrete concerns such as implausible scope, unclear salary, unrelated skill breadth, out-of-hours expectations, or vague responsibilities. Empty array if none.

Respond with ONLY the JSON object.`;

  const userMessage = `Job posting:

${args.text}

Return the JSON.`;

  return { system, userMessage };
}

export function buildJDAnalysisPrompt(args: { jobDescription: string }) {
  const { jobDescription } = args;
  const system = `You are an expert job description analyst helping a job applicant prepare a targeted application.

Read the job description carefully and return a structured analysis. Respond with ONLY a JSON object matching this exact schema - no preamble, no commentary, no markdown code fences:

{
  "summary": "string",
  "seniorityLevel": "junior" | "mid" | "senior" | "staff" | "unclear",
  "requiredSkills": ["string"],
  "niceToHaves": ["string"],
  "keywordsForResume": ["string"],
  "interviewLikelyFocus": ["string"],
  "redFlags": ["string"]
}

Field guidance:

summary: 2-3 sentences of plain English. What does this person actually do day-to-day, who do they work with, and what does success look like? No buzzwords, no restating the job title.

seniorityLevel: infer from years-of-experience requirements, reporting structure, scope of ownership, and compensation signals. "unclear" is acceptable if the JD is genuinely ambiguous.

requiredSkills: hard skills the candidate MUST have to pass the initial screen - languages, frameworks, tools, platforms, methodologies, credentials, and role-specific domain requirements. No generic soft skills. Each item is a short exact string (e.g. "React", "SQL", "Kubernetes"). Empty array if the JD is too vague to determine.

niceToHaves: skills the JD labels "preferred", "bonus", "nice to have", or "advantageous". Empty array if none.

keywordsForResume: 8-20 exact strings the candidate should mirror in their resume to pass ATS and resonate with recruiters. Include specific technology names, domain/industry terms, role-specific methodology phrases, and competency phrases the JD genuinely emphasises. Prioritise terms that appear multiple times or are used in the requirements section. Use the JD's exact wording - not synonyms. Return raw terms only; do not prefix with categories.

interviewLikelyFocus: 3-6 short strings describing the specific topics this JD signals will be tested. Think like the hiring manager designing the interview loop. Be specific to this role - do not list generic topics. Format each as "Category: specific topic" (e.g. "Technical: SQL window functions and query optimisation", "System design: event-driven microservices", "Behavioural: navigating ambiguity without clear requirements", "Domain: experience with GDPR compliance workflows"). Include technical, behavioural, domain, or portfolio-review topics only when the JD signals them.

redFlags: concrete signals the role may be misrepresented or working conditions are poor. Look for: scope creep disguised as "wear many hats", missing or implausibly wide salary range, demands for an implausible breadth of unrelated skills, vague or unmeasurable responsibilities, "fast-paced startup environment" without specifics, no mention of team size or reporting structure, excessive out-of-hours expectations. Empty array if the JD looks clean and well-scoped.

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

The goal is to get a reply - not to sell the applicant's entire career in one message. Short messages get replies. Long messages get ignored.

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
  - Para 1: briefly restate the application (role, company, approximate date). Express continued interest - one specific sentence about why this role still appeals.
  - Para 2: offer to provide any additional materials and suggest a brief call. Easy, confident close.
- Do NOT sound needy or apologetic. Do NOT say "I just wanted to check in".
- Do NOT re-pitch skills - this is a courtesy nudge, not a new pitch.
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
- Subject line: "Thank you - [Role] interview" or a variation. Keep it clear.
- Body: 3 paragraphs, under 150 words total.
  - Para 1: genuine thank you for their time. Reference one specific topic from the interview to prove the note is not a template.
  - Para 2: one brief reinforcement of why this role is a good fit - tie it to something discussed in the interview. Do NOT re-pitch the resume.
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

Respond with ONLY a JSON object matching this exact schema - no preamble, no commentary, no markdown code fences:

{
  "behavioral": [
    { "question": "string", "hint": "string - what the interviewer is really assessing with this question" }
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

export function buildLinkedInAppliedFollowupDMPrompt(args: {
  senderName: string;
  recipientName: string;
  job: { company: string; role: string };
  daysSinceApplied: number;
  previousMessageSent: boolean;
}): { system: string; userMessage: string } {
  const { senderName, recipientName, job, daysSinceApplied, previousMessageSent } = args;
  const system = `You are helping a job applicant write a follow-up LinkedIn DM after applying for a role with no response.

Rules:
- Keep it under 50 words. This is a nudge, not a pitch.
- Reference the role and company by name.
- If previousMessageSent is true: acknowledge this is a second follow-up, keep it even shorter, give them an easy out ("happy to be redirected if this is not the right channel").
- Do NOT sound desperate. Do NOT re-pitch yourself.
- Do NOT open with "Just following up" - find a better first line.
- Plain text only. No greeting header, no sign-off block. Output ONLY the message body.`;

  const userMessage = `Recipient first name: ${recipientName}
Company: ${job.company}
Role: ${job.role}
Days since I applied: ${daysSinceApplied}
Have I already sent one follow-up before this? ${previousMessageSent ? "yes" : "no"}
My name: ${senderName}

Write the follow-up DM. Under 50 words.`;

  return { system, userMessage };
}

export function buildColdEmailPrompt(args: {
  senderName: string;
  recipientName?: string;
  recipientTitle?: string;
  job: { company: string; role: string; companyContext?: string };
}): { system: string; userMessage: string } {
  const { senderName, recipientName, recipientTitle, job } = args;
  const system = `You are helping a job applicant write a cold outreach email to a company that has not advertised a specific role.

The goal is a speculative application: the applicant is reaching out directly to introduce themselves and signal interest in a specific type of role.

Rules:
- Subject line: short, specific, non-generic. Include the company name and target role.
- Body: 3 short paragraphs max, under 200 words total.
  - Para 1: one specific reason you are reaching out to THIS company (use companyContext if provided, otherwise infer something believable from the company name and role).
  - Para 2: two concrete things from the resume that are directly relevant to the target role.
  - Para 3: a clear, low-pressure ask (e.g. "Would you be open to a 15-minute call?").
- Do NOT use: "I am writing to inquire", "I believe I would be a great fit", "Please find attached".
- Sign off with the applicant's name only (no title or contact block - the user will add that).
- Output format: first line is the subject line prefixed with "Subject: ", then a blank line, then the email body.
- Plain text only. No markdown.`;

  const userMessage = `Company: ${job.company}
Target role: ${job.role}
${recipientName ? `Recipient: ${recipientName}${recipientTitle ? `, ${recipientTitle}` : ""}` : "Recipient: Hiring Manager (unknown name)"}
${job.companyContext ? `Why this company specifically: ${job.companyContext}` : ""}
My name: ${senderName}

Write the cold email. Subject line first, then the body. Under 200 words.`;

  return { system, userMessage };
}

export function buildCheckinEmailPrompt(args: {
  senderName: string;
  recipientName?: string;
  job: { company: string; role: string };
  lastInteractionDescription: string;
  daysSinceLastContact: number;
}): { system: string; userMessage: string } {
  const { senderName, recipientName, job, lastInteractionDescription, daysSinceLastContact } = args;
  const system = `You are helping a job applicant write a brief check-in email after going silent post-interview.

This email has two goals: (1) show continued interest, (2) get clarity on whether the process is still active.

Rules:
- Subject line: reference the role. Keep it short.
- Body: 2 short paragraphs, under 100 words.
  - Para 1: reference the last interaction (the interview or call) and express continued interest.
  - Para 2: ask directly if the process is still ongoing. Give them a polite out ("I understand if the timeline has shifted or the role has been filled").
- Do NOT sound desperate or resentful. No guilt-tripping.
- Do NOT use "Just checking in" as the opener.
- Sign off with the applicant's name.
- Output format: "Subject: <subject>" on line 1, blank line, then body. Plain text only.`;

  const userMessage = `Company: ${job.company}
Role: ${job.role}
Last interaction: ${lastInteractionDescription}
Days since last contact: ${daysSinceLastContact}
${recipientName ? `Recipient: ${recipientName}` : "Recipient: unknown (use 'Hiring Team')"}
My name: ${senderName}

Write the check-in email. Subject first, body under 100 words.`;

  return { system, userMessage };
}

export function buildSalaryNegotiationEmailPrompt(args: {
  senderName: string;
  recipientName: string;
  job: { company: string; role: string };
  offeredSalary: string;
  targetSalary: string;
  negotiationReason: string;
  otherComponents?: string;
}): { system: string; userMessage: string } {
  const { senderName, recipientName, job, offeredSalary, targetSalary, negotiationReason, otherComponents } = args;
  const system = `You are helping a job applicant write a professional salary negotiation email after receiving a job offer.

The goal is to counter confidently without damaging the relationship or sounding entitled.

Rules:
- Subject line: "Re: Offer - [Role] at [Company]" or similar. Keep it professional.
- Body: 3 paragraphs, under 200 words.
  - Para 1: thank them for the offer. Express genuine enthusiasm for the role. Keep it brief - this is not the main point.
  - Para 2: make the ask. State the specific counter number (or component). Ground it in one specific reason from negotiationReason (market rate, competing offer, cost of living, experience level). One reason only - multiple reasons sound desperate.
  - Para 3: reaffirm excitement about the role. Make clear you are hoping to reach an agreement, not issue an ultimatum. A closing line that invites dialogue.
- Do NOT say "I feel", "I was hoping", "I was wondering if". Be direct.
- Do NOT make the counter sound like begging.
- If otherComponents is provided, work it in naturally in para 2 as a secondary ask.
- Sign off with applicant's name.
- Output format: "Subject: <subject>" on line 1, blank line, then body. Plain text only.`;

  const userMessage = `Recipient: ${recipientName}
Company: ${job.company}
Role: ${job.role}
Offer received: ${offeredSalary}
My target: ${targetSalary}
Reason for counter: ${negotiationReason}
${otherComponents ? `Other components to negotiate: ${otherComponents}` : ""}
My name: ${senderName}

Write the negotiation email. Subject first, body under 200 words.`;

  return { system, userMessage };
}

export function buildSkillsGapPrompt(args: {
  missingRequired: string[];
  missingNiceToHave: string[];
  resumeSkillsText: string;
  appliedRoles: string[];
}): { system: string; userMessage: string } {
  const { missingRequired, missingNiceToHave, resumeSkillsText, appliedRoles } = args;
  const system = `You are a career coach helping a job applicant understand their skills gap based on the roles they have been applying to.

You have been given a list of skills that repeatedly appear in job descriptions the applicant has applied to, but are missing from their resume. Your job is to produce a prioritised, actionable learning roadmap.

Respond with ONLY a JSON object matching this schema - no preamble, no markdown fences:

{
  "summary": "string - 2-3 sentence plain English summary of the overall gap pattern",
  "highPriority": [
    {
      "skill": "string",
      "why": "string - one sentence: why this skill matters for their target role type",
      "howToLearn": "string - one specific, free or low-cost resource or approach (e.g. 'Build a small project using X', 'Complete the official Y docs tutorial'). No paid course recommendations unless free tier is available.",
      "timeEstimate": "string - e.g. '2-4 weeks part-time'"
    }
  ],
  "mediumPriority": [ same shape as highPriority ],
  "lowPriority": [ same shape as highPriority ],
  "quickWins": [
    "string - skills the user almost certainly has but has not written on the resume (inferred from adjacent skills present). One sentence each: 'You use X - consider adding Y explicitly since it appears in N job descriptions.'"
  ]
}

Rules:
- highPriority: required skills missing from the most job descriptions. Max 5 items.
- mediumPriority: required skills missing from fewer job descriptions, or frequently missing nice-to-haves. Max 5 items.
- lowPriority: nice-to-haves missing from few job descriptions. Max 3 items.
- quickWins: infer from the user's resume what adjacent skills they might have but not listed. Max 3 items.
- howToLearn: be specific. "Learn Docker" is not useful. "Build a containerised version of a personal project and push it to Docker Hub" is useful.
- Do NOT recommend paid courses. Suggest official docs, open source projects, personal projects, or free platforms.`;

  const userMessage = `Roles I have been applying to: ${appliedRoles.join(", ")}

Required skills missing from my resume:
${missingRequired.map((s) => `- ${s}`).join("\n")}

Nice-to-have skills missing from my resume:
${missingNiceToHave.map((s) => `- ${s}`).join("\n")}

My resume skills (to identify adjacent skills for quick wins):
${resumeSkillsText.slice(0, 1500)}

Return the JSON skills gap analysis.`;

  return { system, userMessage };
}

export function buildLatexBodyPrompt(
  fullTemplate: string,
  resume: Record<string, unknown>
): string {
  return `You are a LaTeX document generator. Your task is to generate the body of a LaTeX resume document.

You are given:
1. A complete LaTeX template (study it for the preamble commands, custom macros, and section structure)
2. Structured resume data in JSON format

TEMPLATE:
---
${fullTemplate}
---

RESUME DATA (JSON):
---
${JSON.stringify(resume, null, 2)}
---

RULES:
- Use the custom commands defined in the template preamble (e.g. \\jobrow, \\skillrow, \\section*, etc.)
- Use ONLY the data from RESUME DATA - do NOT copy any text content from the template
- Follow the same section ordering and structural patterns shown in the template body
- Escape these LaTeX special characters in all text content: & % $ # _ { } ~ ^ \\
- URLs: whenever any data field contains a URL (starting with http:// or https://), render it as \\href{url}{display text}. Copy the URL character-for-character as the first argument -- do NOT escape, encode, or modify any character in the URL (no backslashes, no percent changes). Use surrounding context as display text or the URL itself if no label exists.
- For URLs in \\href{url}{text}: the URL portion does not need LaTeX escaping; only escape the display text
- Education dates: use the gradDate value VERBATIM in the right column of the date row (e.g. \\jobrow) - it may be a full range like "Feb 2022 - Dec 2023". Never truncate, reformat, or split it.
- NEVER use -- anywhere in any content. -- is a LaTeX en dash and signals machine-generated text. Use a plain hyphen - for separators in any context (certifications, job titles, bullet points, dates within ranges, etc.).
- Dash handling: keep plain hyphens as plain hyphens (-). Only use --- (em dash) if and only if the source text explicitly contains a Unicode em dash character. Never introduce -- or --- into content that does not have a dash in the source.
- Do NOT add \\noindent before any block unless the template explicitly uses \\noindent before that element type. Follow the template's indentation pattern exactly.
- Do NOT add \\vspace{} commands unless that exact element type already has a \\vspace in the template. Vertical spacing is controlled by the preamble; invented \\vspace values break the template rhythm.
- Do NOT over-escape. Only escape these seven characters: & % $ # _ { }. Do NOT escape apostrophes, colons, parentheses, slashes, or any other character not in that list.
- Output ONLY the document body - everything that would appear between \\begin{document} and \\end{document}
- Do NOT include \\begin{document} or \\end{document} tags
- No explanations, no markdown, no code fences (no \`\`\`latex or \`\`\` markers) - raw LaTeX only

Generate the document body now:`;
}

export function buildCoverLetterLatexBodyPrompt(
  fullTemplate: string,
  coverLetter: Record<string, unknown>
): string {
  return `You are a LaTeX document generator. Your task is to generate the body of a LaTeX cover letter document.

You are given:
1. A complete LaTeX template (study it for the preamble commands, custom macros, and structural patterns)
2. Structured cover letter data in JSON format

TEMPLATE:
---
${fullTemplate}
---

COVER LETTER DATA (JSON):
---
${JSON.stringify(coverLetter, null, 2)}
---

RULES:
- Use the custom commands defined in the template preamble
- Use ONLY the data from COVER LETTER DATA - do NOT copy any text content from the template
- Follow the same structural patterns shown in the template body (header, date, salutation, paragraphs, signoff)
- Escape these LaTeX special characters in all text content: & % $ # _ { }
- For URLs in \\href{url}{text}: the URL portion does not need LaTeX escaping; only escape the display text
- If recipient is null, use "Hiring Manager" as the salutation name
- Do NOT include a GitHub link in the contact bar - cover letters show phone, email, location, LinkedIn, and website only
- URLs: whenever any data field contains a URL (starting with http:// or https://), render it as \\href{url}{display text}. Copy the URL character-for-character as the first argument -- do NOT escape, encode, or modify any character in the URL (no backslashes, no percent changes). Use surrounding context as display text or the URL itself if no label exists.
- NEVER use -- anywhere in any content. -- is a LaTeX en dash and signals machine-generated text. Use a plain hyphen - where a separator is needed.
- Dash handling: keep plain hyphens as plain hyphens (-). Only use --- (em dash) if and only if the source text explicitly contains a Unicode em dash character. Never introduce -- into content.
- Do NOT add \\noindent before any block unless the template explicitly uses \\noindent before that element type.
- Do NOT add \\vspace{} commands unless that exact element type already has a \\vspace in the template.
- Do NOT over-escape. Only escape these six characters: & % $ # _ { }. Do NOT escape apostrophes, colons, parentheses, slashes, or any other character not in that list.
- Output ONLY the document body - everything that would appear between \\begin{document} and \\end{document}
- Do NOT include \\begin{document} or \\end{document} tags
- No explanations, no markdown, no code fences (no \`\`\`latex or \`\`\` markers) - raw LaTeX only

Generate the document body now:`;
}

