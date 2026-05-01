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
  const now = new Date();
  const day = now.getDate();
  const ordinal = ["th", "st", "nd", "rd"][
    day % 10 > 3 || Math.floor((day % 100) / 10) === 1 ? 0 : day % 10
  ];
  const todayFormatted = `${day}${ordinal} ${now.toLocaleDateString("en-GB", { month: "long" })} ${now.getFullYear()}`;
  const system = `You are helping a job applicant write a professional cover letter for a specific role.

Your job is to write a concise, warm, professional cover letter (3 to 4 paragraphs) tailored to the company and role. The letter should:
- Begin with today's date (${todayFormatted}) on its own line
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
- Do NOT open with "Just following up" -- find a better first line.
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
- Sign off with the applicant's name only (no title or contact block -- the user will add that).
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
- Subject line: "Re: Offer -- [Role] at [Company]" or similar. Keep it professional.
- Body: 3 paragraphs, under 200 words.
  - Para 1: thank them for the offer. Express genuine enthusiasm for the role. Keep it brief -- this is not the main point.
  - Para 2: make the ask. State the specific counter number (or component). Ground it in one specific reason from negotiationReason (market rate, competing offer, cost of living, experience level). One reason only -- multiple reasons sound desperate.
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

export function buildSTARStoryPolishPrompt(args: {
  roughDraft: string;
  title: string;
  maxWords?: number;
}): { system: string; userMessage: string } {
  const { roughDraft, title, maxWords = 200 } = args;
  const system = `You are an expert interview coach helping a job applicant polish a rough behavioral story into a clean STAR-format answer.

STAR format:
- Situation: brief context (1-2 sentences). What was the setting?
- Task: what were you specifically responsible for?
- Action: what YOU did -- not "we". Specific, active verbs. This is the longest part (2-4 sentences).
- Result: quantified outcome if possible. What changed because of your action? Include timeframe if known.

Rules:
- Stay within the maxWords limit.
- Use first-person singular. Remove passive voice.
- Do NOT invent facts. If the story is vague, make the existing facts sharper -- do not add new ones.
- Remove filler phrases: "basically", "like", "you know", "so yeah".
- The Result must be concrete. If the user's draft has a vague result ("it went well"), improve the phrasing but do not fabricate a number.
- Output format: plain text, with "Situation:", "Task:", "Action:", "Result:" as section headers on their own lines. No markdown bold, no bullet points.`;

  const userMessage = `Story title: ${title}
Max words: ${maxWords}

My rough story:
${roughDraft}

Polish this into a clean STAR answer. Use the section headers. Stay under ${maxWords} words.`;

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

Respond with ONLY a JSON object matching this schema -- no preamble, no markdown fences:

{
  "summary": "string -- 2-3 sentence plain English summary of the overall gap pattern",
  "highPriority": [
    {
      "skill": "string",
      "why": "string -- one sentence: why this skill matters for their target role type",
      "howToLearn": "string -- one specific, free or low-cost resource or approach (e.g. 'Build a small project using X', 'Complete the official Y docs tutorial'). No paid course recommendations unless free tier is available.",
      "timeEstimate": "string -- e.g. '2-4 weeks part-time'"
    }
  ],
  "mediumPriority": [ same shape as highPriority ],
  "lowPriority": [ same shape as highPriority ],
  "quickWins": [
    "string -- skills the user almost certainly has but has not written on the resume (inferred from adjacent skills present). One sentence each: 'You use X -- consider adding Y explicitly since it appears in N job descriptions.'"
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

export function buildOfferComparisonPrompt(args: {
  offers: Array<{
    company: string;
    role: string;
    baseSalary: number;
    currency: string;
    equity?: string;
    bonus?: string;
    leaveDays?: number;
    location: string;
    remotePolicy: string;
    roleLevel: string;
    notes?: string;
  }>;
}): { system: string; userMessage: string } {
  const { offers } = args;
  const system = `You are a career advisor helping a job applicant objectively compare multiple job offers.

Your job is to produce a structured, honest comparison and a clear recommendation -- not a wishy-washy "it depends on what matters to you" non-answer.

Respond with ONLY a JSON object matching this exact schema -- no preamble, no markdown fences:

{
  "comparisonTable": [
    {
      "dimension": "string -- e.g. 'Total compensation', 'Remote flexibility', 'Career growth signal', 'Company stability'",
      "winner": "string -- company name, or 'Tie'",
      "notes": "string -- one sentence explaining the call"
    }
  ],
  "prosAndCons": {
    "<company_name>": {
      "pros": ["string"],
      "cons": ["string"]
    }
  },
  "recommendation": {
    "pick": "string -- company name",
    "reasoning": "string -- 3-4 sentences. Be direct. Acknowledge the trade-offs of this choice."
  },
  "negotiationOpportunities": [
    "string -- one per offer where there is a clear gap to negotiate (e.g. 'Offer B base salary is $10k below Offer A for the same level -- use that as leverage')"
  ]
}

Rules:
- comparisonTable: cover at minimum: total compensation, remote/location, role level/seniority, career growth signal, company stability/size, benefits. Add more dimensions if the offer data justifies it.
- Be honest. If one offer is clearly better on a dimension, say so. Do not artificially balance the comparison.
- recommendation.pick: choose one. If it is genuinely too close to call without more information, say which single piece of information would change the answer and why.
- negotiationOpportunities: only include if there is a real, specific gap to exploit. Empty array if not.`;

  const userMessage = `Offers:
${offers
    .map(
      (o, i) => `
Offer ${i + 1}: ${o.company} -- ${o.role}
  Base salary: ${o.currency} ${o.baseSalary.toLocaleString()}
  ${o.equity ? `Equity: ${o.equity}` : "No equity"}
  ${o.bonus ? `Bonus: ${o.bonus}` : "No bonus"}
  Location: ${o.location} (${o.remotePolicy.replace("_", " ")})
  Leave: ${o.leaveDays != null ? `${o.leaveDays} days` : "Not specified"}
  Level: ${o.roleLevel}
  ${o.notes ? `Notes: ${o.notes}` : ""}`
    )
    .join("\n")}

Return the JSON comparison.`;

  return { system, userMessage };
}

export function buildResumeExtractionPrompt(args: {
  markdown: string;
}): { system: string; userMessage: string } {
  const system = `You are extracting structured data from a tailored resume in markdown format.
The resume uses # for the candidate name, ## for section headers, ### for job/project/degree titles, and - for bullet points.

Return ONLY a JSON object matching this exact schema -- no preamble, no commentary, no markdown code fences:

{
  "name": "string",
  "location": "string or null",
  "phone": "string or null",
  "email": "string or null",
  "linkedin": "string or null",
  "github": "string or null",
  "website": "string or null",
  "workRights": "string or null",
  "summary": "string or null",
  "skills": [{ "category": "string", "items": "string" }],
  "experience": [{
    "jobTitle": "string",
    "company": "string",
    "dateRange": "string",
    "subtitle": "string or null",
    "bullets": ["string"]
  }],
  "projects": [{
    "name": "string",
    "techStack": "string or null",
    "bullets": ["string"]
  }],
  "education": [{
    "degree": "string",
    "school": "string",
    "gradDate": "string or null",
    "notes": "string or null"
  }],
  "certifications": ["string"],
  "footer": "string or null"
}

Extraction rules:
- name: from the # heading (first line).
- location, phone, email, linkedin, github, website, workRights: from header lines after the name, before Professional Summary. Values on the same line are separated by | characters.
- summary: paragraph text under the Professional Summary section header.
- skills: each "Category: items" line. category is the label before ":", items is everything after ":".
- experience: each role under Professional Experience. jobTitle and company are usually on the same ### line. subtitle is the optional plain-text context line immediately following the title line (e.g. a promotion note or a project URL), not a bullet point. If the line is a URL, include it as-is. bullets are the - lines.
- projects: each entry under Projects. name is the full title including type (e.g. "Job Hunt Tracker | Personal Project"). techStack is the "Tech Stack:" line value.
- education: each degree. notes is the first supplementary line after the degree/school/date line (coursework, GPA, honours, or publication). If multiple supplementary lines exist, concatenate them with a semicolon. null if none present.
- certifications: flat list of strings, one per certification bullet.
- footer: any final line like "References available on request".
- Use null for any field not present in the resume.

Respond with ONLY the JSON object.`;

  return {
    system,
    userMessage: `Resume markdown:\n\n${args.markdown}\n\nReturn the JSON.`,
  };
}

export function buildCoverLetterExtractionPrompt(args: {
  markdown: string;
  company: string;
  role: string;
  candidateName: string;
}): { system: string; userMessage: string } {
  const { markdown, company, role, candidateName } = args;
  const system = `You are extracting structured data from a cover letter in markdown format.

Return ONLY a JSON object matching this exact schema -- no preamble, no commentary, no markdown code fences:

{
  "name": "string",
  "date": "string",
  "recipient": "string or null",
  "company": "string",
  "role": "string",
  "bodyParagraphs": ["string"],
  "closing": "string or null"
}

Extraction rules:
- name: the applicant's name from the sign-off, or use the hint provided.
- date: the date line at the top of the letter.
- recipient: "Hiring Manager", a personal name if addressed to one, or null.
- company: the company name from the letter body (use the hint if not explicit).
- role: the job title from the letter body (use the hint if not explicit).
- bodyParagraphs: each body paragraph as a separate string. Exclude the date line, recipient line, and sign-off block.
- closing: the distinct closing sentence before the name sign-off (e.g. "I look forward to hearing from you."). If no separate closing sentence exists and the last body paragraph itself serves as the close, use null.
- Use null for any field not present.

Respond with ONLY the JSON object.`;

  return {
    system,
    userMessage: `Company hint: ${company}\nRole hint: ${role}\nApplicant name hint: ${candidateName}\n\nCover letter markdown:\n\n${markdown}\n\nReturn the JSON.`,
  };
}
