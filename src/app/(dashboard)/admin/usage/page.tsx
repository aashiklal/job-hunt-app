import type { Metadata } from "next";
import { requireAdminWithPlan } from "@/lib/auth-helpers";
import * as usageEvents from "@/lib/repositories/usage-events";
import * as usageRepo from "@/lib/repositories/usage";
import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";
import * as plansRepo from "@/lib/repositories/plans";
import { CREDIT_LABELS, type CreditFeature } from "@/lib/credits";
import {
  accountMargin,
  countsTowardMargin,
  marginHeadline,
  summarise,
  type BillingStatus,
} from "@/lib/margin";
import { money } from "../_components/usage-display";
import { MarginBars, type MarginRow } from "../_components/margin-bars";
import { RevenueTrend, type TrendPoint } from "../_components/revenue-trend";

export const metadata: Metadata = {
  title: "Margin",
  description:
    "What each account pays against what it costs to serve, and whether margin is holding up.",
};

function featureLabel(key: string): string {
  return CREDIT_LABELS[key as CreditFeature] ?? key;
}

export default async function AdminMarginPage() {
  await requireAdminWithPlan();

  const [approvedUsers, plans, monthlyCost, features] = await Promise.all([
    users.listByStatus("approved"),
    plansRepo.listAll(),
    usageRepo.monthlyTotals({ limit: 12 }),
    usageEvents.byFeature(),
  ]);

  const priceByPlan = new Map(
    plans.map((p) => [p.key, p.monthlyPriceUSD ?? 0])
  );

  // The demo account sits on a paid plan but is not a customer. Counting it
  // would add a seat that pays nothing to every figure on this page.
  const accounts = approvedUsers.filter((u) => !u.isDemo);
  const accountIds = accounts.map((u) =>
    (u._id as { toString(): string }).toString()
  );

  const [subs, costs] = await Promise.all([
    subscriptions.bulkByUserId(accountIds),
    usageRepo.currentPeriodByUser(accountIds),
  ]);

  const rows: MarginRow[] = accounts
    .map((user) => {
      const id = (user._id as { toString(): string }).toString();
      const sub = subs[id];
      const status = (sub?.status ?? "trialing") as BillingStatus;
      return {
        userId: id,
        email: user.email,
        status,
        margin: accountMargin({
          priceUSD: priceByPlan.get(sub?.planKey ?? "personal") ?? 0,
          costUSD: costs[id]?.costUSD ?? 0,
          status,
        }),
      };
    })
    // Cancelled and comped accounts say nothing about whether pricing works.
    .filter((row) => countsTowardMargin(row.status))
    // Worst first, so trouble is always at the top of the page.
    .sort((a, b) => a.margin.marginUSD - b.margin.marginUSD);

  const totals = summarise(rows.map((r) => r.margin));

  const trend: TrendPoint[] = monthlyCost.map((m) => ({
    period: m.period,
    costUSD: m.costUSD,
  }));

  const nothingEarned = totals.earnedRevenueUSD === 0;

  return (
    <div className="space-y-12">
      <section aria-labelledby="margin-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1
            id="margin-heading"
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            {marginHeadline(totals)}
          </h1>
          <p className="text-sm tabular-nums text-muted-foreground">
            <span className="text-foreground">
              {money(totals.modelledMarginUSD)}
            </span>{" "}
            modelled margin of {money(totals.modelledRevenueUSD)}
          </p>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {nothingEarned
            ? `${money(0)} earned so far. Nobody is paying yet, so revenue here is what your prices would bring in if every account converted.`
            : `${money(totals.earnedRevenueUSD)} earned from ${totals.payingCount} paying ${totals.payingCount === 1 ? "account" : "accounts"} this month.`}
        </p>

        <div className="mt-6">
          <MarginBars rows={rows} />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Each bar is what an account costs against what its plan charges. The
          demo account is excluded.
        </p>
      </section>

      <section aria-labelledby="trend-heading">
        <h2
          id="trend-heading"
          className="text-sm font-medium text-foreground"
        >
          Is margin holding up
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Real cost each month, against what your current accounts would earn in
          a month at today&apos;s prices.
        </p>
        <RevenueTrend
          points={trend}
          monthlyRevenueUSD={totals.modelledRevenueUSD}
        />
      </section>

      <section aria-labelledby="feature-heading">
        <h2
          id="feature-heading"
          className="text-sm font-medium text-foreground"
        >
          What the cost goes on
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Cost per call is what the credit weights are derived from. A feature
          drifting far above its price needs retuning. Per-call tracking started
          recently, so this fills in over time.
        </p>

        {features.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            No per-call records yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Feature</th>
                  <th className="py-2 pr-4 text-right font-medium">Calls</th>
                  <th className="py-2 pr-4 text-right font-medium">Cost</th>
                  <th className="py-2 text-right font-medium">Per call</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f) => (
                  <tr key={f.feature} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground">
                      {featureLabel(f.feature)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {f.calls}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                      {money(f.costUSD)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {f.calls > 0 ? money(f.costUSD / f.calls) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
