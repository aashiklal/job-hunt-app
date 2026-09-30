import Link from "next/link";
import type { AccountMargin } from "@/lib/margin";

/**
 * One row per account: a track representing what the account pays, with its
 * cost filling in from the left.
 *
 * The whole customer base reads in a glance without parsing any numbers. A
 * thin fill is healthy, a nearly full one is thin margin, an overflowing one
 * is a loss. Sorted worst first, so trouble is always at the top.
 *
 * The app's palette is achromatic by design, so red is reserved entirely for
 * money being lost. If this component shows colour, something is wrong.
 */

export type MarginRow = {
  userId: string;
  email: string;
  margin: AccountMargin;
  status: string;
};

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function percent(ratio: number | null): string {
  if (ratio === null) return "-";
  return `${Math.round(ratio * 100)}%`;
}

function statusNote(status: string): string | null {
  // Only worth saying when it changes how the row should be read.
  if (status === "trialing") return "trial";
  if (status === "past_due") return "past due";
  return null;
}

function Bar({ margin }: { margin: AccountMargin }) {
  const ratio = margin.costRatio;

  if (ratio === null) {
    return (
      <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true" />
    );
  }

  // Cost beyond the price cannot be drawn inside the track, so the overflow is
  // shown as a full red bar; the figures alongside carry the exact amount.
  const filled = Math.min(100, ratio * 100);

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      aria-hidden="true"
    >
      <div
        className={`h-full rounded-full ${
          margin.isLoss
            ? "bg-destructive"
            : margin.isAtRisk
              ? "bg-foreground/70"
              : "bg-foreground/40"
        }`}
        style={{ width: `${Math.max(1, filled)}%` }}
      />
    </div>
  );
}

export function MarginBars({ rows }: { rows: MarginRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No accounts to measure yet. Approve a user to see what they cost against
        what their plan charges.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {rows.map((row) => {
        const note = statusNote(row.status);
        return (
          <li key={row.userId}>
            <Link
              href={`/admin/${row.userId}`}
              className="grid grid-cols-1 gap-2 rounded-md px-2 py-3 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-center sm:gap-4"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-sm text-foreground">
                  {row.email}
                </span>
                {note && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {note}
                  </span>
                )}
              </span>

              <Bar margin={row.margin} />

              <span className="flex items-baseline justify-between gap-3 text-sm tabular-nums sm:justify-end">
                <span
                  className={
                    row.margin.isLoss
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  {money(row.margin.costUSD)}
                  <span className="text-muted-foreground">
                    {" of "}
                    {money(row.margin.priceUSD)}
                  </span>
                </span>
                <span
                  className={`w-14 text-right ${
                    row.margin.isLoss
                      ? "font-medium text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {row.margin.isLoss
                    ? money(row.margin.marginUSD)
                    : percent(row.margin.marginRatio)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
