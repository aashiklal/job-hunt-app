import { costPerCredit, isOverTarget } from "@/lib/credits";

/**
 * Shared presentation for AI usage, used by both the platform dashboard and
 * the per-user page. Kept in one place so the two cannot drift into showing
 * the same number two different ways.
 */

export function money(n: number): string {
  // Sub-cent precision matters for per-call costs, but zero and whole amounts
  // read as broken with four decimals.
  if (n === 0) return "$0.00";
  return `$${Math.abs(n) < 1 ? n.toFixed(4) : n.toFixed(2)}`;
}

/** Cost per credit, rendered to enough precision to be meaningful at fractions of a cent. */
export function ratioLabel(costUSD: number, credits: number): string {
  const ratio = costPerCredit(costUSD, credits);
  if (ratio === null) return "-";
  return `$${ratio.toFixed(4)}/cr`;
}

/**
 * Marks spend that is costing more per credit than the pricing assumes.
 *
 * This is the outlier signal: either the user leans on expensive features, or
 * a credit weight is too low and is quietly eating margin.
 */
export function OverTargetBadge({
  costUSD,
  credits,
}: {
  costUSD: number;
  credits: number;
}) {
  const ratio = costPerCredit(costUSD, credits);
  if (!isOverTarget(ratio)) return null;

  return (
    <span
      className="ml-2 rounded-sm bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
      title={`Costing ${ratioLabel(costUSD, credits)}, above the pricing target. Check the feature breakdown.`}
    >
      Over target
    </span>
  );
}

export type UsageSummary = {
  costUSD: number;
  credits: number;
  calls: number;
};

export function UsageStatCard({
  label,
  totals,
}: {
  label: string;
  totals: UsageSummary;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center text-2xl font-semibold text-foreground">
        {money(totals.costUSD)}
        <OverTargetBadge costUSD={totals.costUSD} credits={totals.credits} />
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {totals.calls} {totals.calls === 1 ? "call" : "calls"} ·{" "}
        {totals.credits} credits
      </p>
    </div>
  );
}

/**
 * Bar chart drawn with divs. Heights are data-driven, so the inline style is
 * the documented exception rather than a styling shortcut.
 */
export function UsageBars({
  points,
  emptyMessage,
}: {
  points: Array<{ bucket: string; costUSD: number; calls: number }>;
  emptyMessage: string;
}) {
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const max = Math.max(...points.map((p) => p.costUSD), 0.0001);

  return (
    <div className="flex h-32 items-end gap-1 overflow-x-auto">
      {points.map((p) => (
        <div
          key={p.bucket}
          className="flex h-full min-w-6 flex-1 flex-col items-center gap-1"
        >
          {/*
            The bar's height is a percentage, so it needs an ancestor with a
            definite height to resolve against. Without this track the column
            collapses to the label and every bar computes to zero.
          */}
          <div className="flex w-full min-h-0 flex-1 items-end">
            <div
              className="w-full rounded-t-sm bg-primary/70"
              style={{ height: `${Math.max(2, (p.costUSD / max) * 100)}%` }}
              title={`${p.bucket}: ${money(p.costUSD)} over ${p.calls} ${p.calls === 1 ? "call" : "calls"}`}
            />
          </div>
          <span className="truncate text-[10px] text-muted-foreground">
            {p.bucket.slice(-5)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Shown where detailed per-call data does not exist yet.
 *
 * UsageEvent rows only began being written when that collection was added, so
 * every chart is empty for activity before then. Saying so is better than an
 * empty box that reads as "this user did nothing".
 */
export function TrackingGapNotice({ scope }: { scope: string }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      No detailed usage recorded for {scope} yet. Per-call tracking started
      recently, so earlier activity only appears in the monthly totals below.
    </p>
  );
}
