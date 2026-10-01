/**
 * Revenue against cost, by month.
 *
 * The bars answer whether anything is wrong today. This answers whether today
 * is a trend or a blip, which is the natural next question. A healthy business
 * widens the gap between the two lines.
 *
 * Drawn from the Usage monthly counters rather than the per-call events,
 * because those counters hold the only record of spend from before per-call
 * tracking existed, and monthly is exactly the grain this needs.
 */

export type TrendPoint = {
  period: string;
  costUSD: number;
};

function money(n: number): string {
  return n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
}

function monthLabel(period: string): string {
  // Periods are "YYYY-MM" here; slice so a cycle key would also parse.
  const [year, month] = period.slice(0, 7).split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

export function RevenueTrend({
  points,
  monthlyRevenueUSD,
}: {
  points: TrendPoint[];
  /** What today's accounts would earn in a month at current prices. */
  monthlyRevenueUSD: number;
}) {
  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No months recorded yet.
      </p>
    );
  }

  // The revenue line is today's figure, not a per-month history: account
  // numbers were different in earlier months and projecting backward would
  // invent a trend that never happened.
  const max = Math.max(...points.map((p) => p.costUSD), monthlyRevenueUSD, 0.01);
  const revenueLinePct = (monthlyRevenueUSD / max) * 100;

  return (
    <div>
      <div className="relative h-40">
        {/* What today's accounts would earn, as a line to measure cost against. */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/40"
          style={{ bottom: `${Math.min(100, revenueLinePct)}%` }}
          aria-hidden="true"
        >
          <span className="absolute right-0 -top-6 bg-background px-1 text-xs text-muted-foreground">
            {money(monthlyRevenueUSD)}{" "}a month at today&apos;s prices
          </span>
        </div>

        <div className="flex h-full items-end gap-3 overflow-x-auto sm:gap-6">
          {points.map((p) => (
            <div
              key={p.period}
              className="flex h-full min-w-14 flex-1 flex-col items-center gap-2"
            >
              <div className="flex min-h-0 w-full flex-1 items-end justify-center">
                <div
                  className="w-8 rounded-t-sm bg-foreground/40"
                  style={{
                    height: `${Math.max(1, (p.costUSD / max) * 100)}%`,
                  }}
                  title={`${p.period}: ${money(p.costUSD)} cost`}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {money(p.costUSD)}
              </span>
              <span className="text-xs text-muted-foreground">
                {monthLabel(p.period)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Bars are real monthly cost. The line is what your current accounts would
        earn in a month, not what they earned then.
      </p>
    </div>
  );
}
