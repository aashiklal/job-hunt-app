type ContactInfo = {
  location: string | null;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  github: string | null;
  website: string | null;
  workRights: string | null;
};

/**
 * Extract contact fields from a resume markdown header without an AI call.
 * Reads lines between the # Name heading and the first ## section header,
 * splits by "|", then classifies each token by pattern.
 */
export function parseResumeContactInfo(resumeMarkdown: string): ContactInfo {
  const lines = resumeMarkdown.split("\n");

  // Find the # Name heading
  let i = 0;
  while (i < lines.length && !lines[i].trimStart().startsWith("# ")) i++;
  i++; // advance past the name line

  // Collect header lines until the first ## section or end of content
  const headerTokens: string[] = [];
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("## ")) break;
    if (line) {
      headerTokens.push(
        ...line.split("|").map((v) => v.trim()).filter(Boolean)
      );
    }
    i++;
  }

  let location: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;
  let linkedin: string | null = null;
  let github: string | null = null;
  let website: string | null = null;
  let workRights: string | null = null;

  for (const token of headerTokens) {
    const t = token.replace(/\*+/g, "").trim(); // strip markdown bold
    if (!t) continue;

    if (!email && t.includes("@") && !/\s/.test(t)) {
      email = t;
    } else if (!phone && /^[+\d][\d\s().+-]{5,}$/.test(t)) {
      phone = t;
    } else if (!linkedin && /linkedin\.com/i.test(t)) {
      linkedin = t;
    } else if (!github && /github\.com/i.test(t)) {
      github = t;
    } else if (!website && /^https?:\/\//i.test(t)) {
      website = t;
    } else if (!workRights && /citizen|visa|right to work|permanent resident|work permit|work authoris/i.test(t)) {
      workRights = t;
    } else if (!location) {
      location = t;
    }
  }

  return { location, phone, email, linkedin, github, website, workRights };
}
