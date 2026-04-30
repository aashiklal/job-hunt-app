export type ATSScoreResult = {
  overallScore: number;
  requiredCoverage: { matched: string[]; missing: string[]; score: number };
  niceToHaveCoverage: { matched: string[]; missing: string[]; score: number };
  keywordCoverage: { matched: string[]; missing: string[]; score: number };
};

function normalise(s: string): string {
  return s.toLowerCase().trim();
}

const STEM_SUFFIXES = ["ing", "ed", "er", "ly", "s"] as const;

function stems(word: string): string[] {
  const n = normalise(word);
  const variants = [n];
  for (const suffix of STEM_SUFFIXES) {
    if (n.endsWith(suffix) && n.length - suffix.length >= 3) {
      variants.push(n.slice(0, n.length - suffix.length));
    }
  }
  return variants;
}

function matchesResume(skill: string, resumeText: string): boolean {
  const rt = normalise(resumeText);
  for (const variant of stems(skill)) {
    if (rt.includes(variant)) return true;
  }
  return false;
}

function scoreBucket(
  skills: string[],
  resumeText: string
): { matched: string[]; missing: string[]; score: number } {
  if (skills.length === 0) return { matched: [], missing: [], score: 100 };
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of skills) {
    (matchesResume(s, resumeText) ? matched : missing).push(s);
  }
  const score = Math.round((matched.length / skills.length) * 100);
  return { matched, missing, score };
}

export function computeATSScore(args: {
  resumeText: string;
  requiredSkills: string[];
  niceToHaves: string[];
  keywordsForResume: string[];
}): ATSScoreResult {
  const { resumeText, requiredSkills, niceToHaves, keywordsForResume } = args;

  const requiredCoverage = scoreBucket(requiredSkills, resumeText);
  const niceToHaveCoverage = scoreBucket(niceToHaves, resumeText);
  const keywordCoverage = scoreBucket(keywordsForResume, resumeText);

  const overallScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        requiredCoverage.score * 0.6 +
          niceToHaveCoverage.score * 0.15 +
          keywordCoverage.score * 0.25
      )
    )
  );

  return { overallScore, requiredCoverage, niceToHaveCoverage, keywordCoverage };
}
