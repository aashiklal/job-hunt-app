import type { Metadata } from "next";
import { requireAdminWithPlan } from "@/lib/auth-helpers";
import * as usageEvents from "@/lib/repositories/usage-events";
import * as users from "@/lib/repositories/users";
import { CREDIT_LABELS, type CreditFeature } from "@/lib/credits";
import {
  money,
  UsageBars,
  UsageStatCard,
} from "../_components/usage-display";

export const metadata: Metadata = {
  title: "AI usage: Job Hunt",
  description: "AI spend and credit consumption over time, by period and feature.",
};

function featureLabel(key: string): string {
  return CREDIT_LABELS[key as CreditFeature] ?? key;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export default async function AdminUsagePage() {
  await requireAdminWithPlan();

  const [
    today,
    thisWeek,
    thisMonth,
    thisYear,
    allTime,
    daily,
    weekly,
    monthly,
    yearly,
    features,
    heaviest,
  ] = await Promise.all([
    usageEvents.totals({ since: daysAgo(1) }),
    usageEvents.totals({ since: daysAgo(7) }),
    usageEvents.totals({ since: daysAgo(30) }),
    usageEvents.totals({ since: daysAgo(365) }),
    usageEvents.totals(),
    usageEvents.series({ bucket: "day", since: daysAgo(30), limit: 30 }),
    usageEvents.series({ bucket: "week", since: daysAgo(180), limit: 26 }),
    usageEvents.series({ bucket: "month", limit: 12 }),
    usageEvents.series({ bucket: "year", limit: 5 }),
    usageEvents.byFeature(),
    usageEvents.topUsers({ since: daysAgo(30), limit: 10 }),
  ]);

  const heaviestWithEmail = await Promise.all(
    heaviest.map(async (row) => {
      const u = await users.getById(row.userId);
      return { ...row, email: u?.email ?? "unknown" };
    })
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          AI usage
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real spend against the Anthropic API, and the credits charged for it.
        </p>
      </header>

      <section aria-label="Totals by period">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <UsageStatCard label="Last 24 hours" totals={today} />
          <UsageStatCard label="Last 7 days" totals={thisWeek} />
          <UsageStatCard label="Last 30 days" totals={thisMonth} />
          <UsageStatCard label="Last 12 months" totals={thisYear} />
          <UsageStatCard label="All time" totals={allTime} />
        </div>
      </section>

      <section aria-label="Daily spend">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Daily, last 30 days
        </h2>
        <UsageBars points={daily} emptyMessage="No AI calls in the last 30 days." />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section aria-label="Weekly spend">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Weekly, last 26 weeks
          </h2>
          <UsageBars points={weekly} emptyMessage="No AI calls yet." />
        </section>

        <section aria-label="Monthly spend">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Monthly, last 12 months
          </h2>
          <UsageBars points={monthly} emptyMessage="No AI calls yet." />
        </section>
      </div>

      <section aria-label="Yearly spend">
        <h2 className="mb-3 text-sm font-medium text-foreground">By year</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Year</th>
                <th className="py-2 pr-4 font-medium">Spend</th>
                <th className="py-2 pr-4 font-medium">Calls</th>
                <th className="py-2 font-medium">Credits</th>
              </tr>
            </thead>
            <tbody>
              {yearly.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No AI calls yet.
                  </td>
                </tr>
              ) : (
                yearly.map((y) => (
                  <tr key={y.bucket} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground">{y.bucket}</td>
                    <td className="py-2 pr-4 text-foreground">{money(y.costUSD)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{y.calls}</td>
                    <td className="py-2 text-muted-foreground">{y.credits}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Spend by feature">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          By feature, all time
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Cost per call is what the credit weights in src/lib/credits.ts are
          derived from. If a feature drifts far from its weight, re-tune it.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Feature</th>
                <th className="py-2 pr-4 font-medium">Spend</th>
                <th className="py-2 pr-4 font-medium">Calls</th>
                <th className="py-2 font-medium">Cost per call</th>
              </tr>
            </thead>
            <tbody>
              {features.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No AI calls yet.
                  </td>
                </tr>
              ) : (
                features.map((f) => (
                  <tr key={f.feature} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground">
                      {featureLabel(f.feature)}
                    </td>
                    <td className="py-2 pr-4 text-foreground">{money(f.costUSD)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{f.calls}</td>
                    <td className="py-2 text-muted-foreground">
                      {f.calls > 0 ? money(f.costUSD / f.calls) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Heaviest users">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Heaviest users, last 30 days
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Spend</th>
                <th className="py-2 pr-4 font-medium">Calls</th>
                <th className="py-2 font-medium">Credits</th>
              </tr>
            </thead>
            <tbody>
              {heaviestWithEmail.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No AI calls in the last 30 days.
                  </td>
                </tr>
              ) : (
                heaviestWithEmail.map((u) => (
                  <tr key={u.userId} className="border-b border-border/50">
                    <td className="py-2 pr-4 break-all text-foreground">{u.email}</td>
                    <td className="py-2 pr-4 text-foreground">{money(u.costUSD)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{u.calls}</td>
                    <td className="py-2 text-muted-foreground">{u.credits}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
