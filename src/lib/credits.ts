/**
 * Credit pricing for AI features.
 *
 * Users see credits, not dollars. Two reasons. Showing spend makes people
 * count pennies instead of seeing value, and it exposes the cost basis to
 * anyone evaluating the product. More importantly, a flat "N generations per
 * month" allowance is unsafe: a tailored resume costs roughly five times a
 * short outreach email, so a resume-heavy user on a flat plan costs five times
 * a note-heavy one for the same money.
 *
 * Weights below are derived from measured token usage against the MODEL_PRICING
 * table in usage.ts, at roughly 1 credit per $0.006 of spend. Re-derive them if
 * prompts grow materially or the active model changes.
 *
 * Credits are exact and known before the call, unlike USD which is only known
 * after. That makes the reservation simpler than the USD path: there is nothing
 * to reconcile afterwards.
 */

export type CreditFeature =
  | "resume"
  | "cover_letter"
  | "jd_analysis"
  | "interview_prep"
  | "outreach"
  | "jobs_parse"
  | "skills_gap"
  | "latex_export";

export const CREDIT_COSTS: Record<CreditFeature, number> = {
  outreach: 1,
  latex_export: 2,
  jd_analysis: 3,
  cover_letter: 3,
  jobs_parse: 3,
  skills_gap: 4,
  interview_prep: 4,
  resume: 6,
};

/** Shown next to each button so the price is known before clicking. */
export const CREDIT_LABELS: Record<CreditFeature, string> = {
  resume: "Tailored resume",
  cover_letter: "Cover letter",
  jd_analysis: "Job description analysis",
  interview_prep: "Interview prep",
  outreach: "Outreach message",
  jobs_parse: "Quick import",
  skills_gap: "Skills gap report",
  latex_export: "LaTeX export",
};

/**
 * The spend each credit is priced to cover. The weights above are derived from
 * this, so it is the yardstick for judging whether reality still matches the
 * pricing.
 */
export const USD_PER_CREDIT_TARGET = 0.006;

/**
 * How far above target a ratio has to run before it is worth flagging.
 *
 * Deliberately not 1.0. Real cost varies with prompt and response length, so
 * flagging anything over target would mark almost everyone and the signal
 * would be worthless.
 */
export const OVER_TARGET_MULTIPLE = 1.5;

/**
 * Actual USD spent per credit charged. Null when no credits were charged,
 * which is the admin case: dividing by zero would render as Infinity.
 */
export function costPerCredit(costUSD: number, credits: number): number | null {
  if (credits <= 0) return null;
  return costUSD / credits;
}

/**
 * True when a user or feature is costing meaningfully more per credit than the
 * pricing assumes. Either they lean on expensive features, or a weight in
 * CREDIT_COSTS is too low and is eating margin.
 */
export function isOverTarget(ratio: number | null): boolean {
  if (ratio === null) return false;
  return ratio > USD_PER_CREDIT_TARGET * OVER_TARGET_MULTIPLE;
}

/** What one call of this feature is priced to cost, for comparison against reality. */
export function targetCostPerCall(feature: CreditFeature): number {
  return CREDIT_COSTS[feature] * USD_PER_CREDIT_TARGET;
}

export function creditCost(feature: CreditFeature): number {
  return CREDIT_COSTS[feature];
}

/**
 * Turns a credit balance into something a person can act on.
 *
 * "340 credits" means nothing on its own. "About 113 cover letters" is a
 * number someone can judge against their own job search.
 */
export function describeCredits(remaining: number): string {
  if (remaining <= 0) return "No credits left this month";

  const coverLetters = Math.floor(remaining / CREDIT_COSTS.cover_letter);
  const resumes = Math.floor(remaining / CREDIT_COSTS.resume);

  if (resumes < 1 && coverLetters < 1) {
    return "Enough for a few outreach messages";
  }
  if (resumes < 1) {
    return `About ${coverLetters} more cover ${coverLetters === 1 ? "letter" : "letters"}`;
  }
  return `About ${resumes} tailored ${resumes === 1 ? "resume" : "resumes"} or ${coverLetters} cover ${coverLetters === 1 ? "letter" : "letters"}`;
}

/** Maps a generation type from the API onto its credit feature. */
export function featureForGenerationType(type: string): CreditFeature {
  switch (type) {
    case "resume":
      return "resume";
    case "cover_letter":
      return "cover_letter";
    case "jd_analysis":
      return "jd_analysis";
    case "interview_prep":
      return "interview_prep";
    default:
      // The eight outreach variants all produce short messages at similar cost.
      return "outreach";
  }
}
