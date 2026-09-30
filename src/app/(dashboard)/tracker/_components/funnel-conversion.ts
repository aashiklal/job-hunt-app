import type { JobStatus } from "@/lib/repositories/jobs";

export type FunnelStage = Exclude<JobStatus, "rejected" | "withdrawn">;

// Ordered pipeline stages (left to right)
export const FUNNEL_STAGES: FunnelStage[] = [
  "saved",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
];

/**
 * How many jobs reached each stage. Counts are a snapshot of where each job is
 * now, so a job in interview also passed through applied and screening: a
 * stage's reach is its own count plus every stage after it. There is no status
 * history, so rejected jobs are assumed to have reached applied (a rejection
 * implies an application) and withdrawn jobs are left out.
 */
export function reachedCounts(
  counts: Record<JobStatus, number>
): Record<FunnelStage, number> {
  const reached = {} as Record<FunnelStage, number>;
  let running = 0;
  for (let i = FUNNEL_STAGES.length - 1; i >= 0; i--) {
    const stage = FUNNEL_STAGES[i];
    running += counts[stage];
    if (stage === "applied") running += counts.rejected;
    reached[stage] = running;
  }
  return reached;
}

/**
 * Percentage (0-100) of jobs that reached `stages[i - 1]` and moved on to
 * `stages[i]`. Index 0 is always null, as is any stage whose predecessor was
 * never reached.
 */
export function conversionRates(
  counts: Record<JobStatus, number>
): (number | null)[] {
  const reached = reachedCounts(counts);
  return FUNNEL_STAGES.map((stage, i) => {
    if (i === 0) return null;
    const from = reached[FUNNEL_STAGES[i - 1]];
    if (from === 0) return null;
    return Math.round((reached[stage] / from) * 100);
  });
}
