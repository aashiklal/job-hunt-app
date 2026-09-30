/**
 * Per-demo creation caps. Kept apart from src/lib/demo-accounts.ts so that
 * src/lib/actions.ts can recognise DemoLimitError without importing Clerk and
 * the sample-data module into every server action.
 */

/** New records a visitor may add on top of the sample data. */
export const DEMO_EXTRA_ALLOWANCE = {
  jobs: 10,
  resumes: 5,
} as const;

export type DemoCapacityKind = keyof typeof DEMO_EXTRA_ALLOWANCE;

const NOUNS: Record<DemoCapacityKind, string> = {
  jobs: "jobs",
  resumes: "resumes",
};

/** A demo visitor hit a per-demo creation cap. The message is shown to them. */
export class DemoLimitError extends Error {
  constructor(kind: DemoCapacityKind) {
    super(
      `The demo lets you add up to ${DEMO_EXTRA_ALLOWANCE[kind]} ${NOUNS[kind]}. Sign up to add more.`
    );
    this.name = "DemoLimitError";
  }
}
