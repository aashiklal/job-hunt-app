import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requireAdminWithPlan } from "@/lib/auth-helpers";
import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";
import * as auditLog from "@/lib/repositories/audit-log";
import * as plans from "@/lib/repositories/plans";
import * as usageRepo from "@/lib/repositories/usage";
import * as usageEvents from "@/lib/repositories/usage-events";
import { getCurrentUsage, getCreditBalance } from "@/lib/usage";
import {
  CREDIT_LABELS,
  describeCredits,
  targetCostPerCall,
  type CreditFeature,
} from "@/lib/credits";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserActionButton } from "../_components/user-actions";
import { ToggleAdminButton } from "../_components/toggle-admin-button";
import { ClearCustomLimitButton } from "../_components/clear-custom-limit-button";
import { SetCustomLimitDialog } from "../_components/set-custom-limit-dialog";
import { formatAuditAction } from "../_lib/format-audit";
import {
  money,
  ratioLabel,
  TrackingGapNotice,
  UsageBars,
  UsageStatCard,
} from "../_components/usage-display";

export const metadata: Metadata = {
  title: "User detail",
  description: "View and manage a user's access, limits, and activity.",
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const ctx = await requireAdminWithPlan();
  const isSelf = ctx.user._id.toString() === userId;

  const target = await users.getById(userId);
  if (!target) notFound();

  const [
    subscription,
    usage,
    credits,
    auditEntries,
    spendHistory,
    today,
    last7,
    last30,
    last365,
    allTimeUsage,
    dailySeries,
    featureBreakdown,
  ] = await Promise.all([
    subscriptions.getByUserId(userId),
    getCurrentUsage(userId),
    getCreditBalance(userId),
    auditLog
      .listForTargetUser(userId)
      .then((docs) => docs.map(auditLog.toAuditLogItem)),
    usageRepo.listForUser(userId),
    usageEvents.totals({ userId, since: daysAgo(1) }),
    usageEvents.totals({ userId, since: daysAgo(7) }),
    usageEvents.totals({ userId, since: daysAgo(30) }),
    usageEvents.totals({ userId, since: daysAgo(365) }),
    usageEvents.totals({ userId }),
    usageEvents.series({ bucket: "day", userId, since: daysAgo(30), limit: 30 }),
    usageEvents.byFeature({ userId }),
  ]);

  let planCredits = ctx.plan.monthlyCredits;
  if (subscription?.planKey) {
    const plan = await plans.getByKey(subscription.planKey);
    if (plan) planCredits = plan.monthlyCredits;
  }

  const targetId = (target._id as { toString(): string }).toString();
  const displayName =
    target.firstName || target.lastName
      ? [target.firstName, target.lastName].filter(Boolean).join(" ")
      : null;

  const statusBadgeVariant =
    target.status === "approved"
      ? "default"
      : target.status === "rejected"
        ? "destructive"
        : "secondary";

  const customCredits = subscription?.customLimits?.monthlyCredits;
  const hasCustomLimit = typeof customCredits === "number";
  const formatAllowance = (n: number) => (n === -1 ? "unlimited" : `${n} credits`);

  const creditsUnlimited = credits.limit === -1;
  const percentUsed =
    credits.limit > 0 ? Math.min(100, (credits.used / credits.limit) * 100) : 0;
  const remaining = creditsUnlimited ? Infinity : credits.remaining;
  const isOut = !creditsUnlimited && remaining <= 0 && credits.limit > 0;
  const isLow =
    !isOut && !creditsUnlimited && remaining <= credits.limit * 0.15;
  const fmtUSD = (n: number) => `$${n.toFixed(2)}`;
  const formatPeriod = (period: string) => {
    const [year, month] = period.split("-");
    return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString(
      "en-US",
      { month: "long", year: "numeric" }
    );
  };
  const totalSpend = spendHistory.reduce((sum, e) => sum + e.aiSpendUSD, 0);

  // Map to design tokens only: destructive for over-limit, muted-foreground for low, primary for normal
  const barColor = isOut ? "bg-destructive" : "bg-primary";
  const countColor = isOut
    ? "font-semibold text-destructive"
    : isLow
      ? "font-semibold text-foreground"
      : "font-medium text-foreground";

  return (
    <div>
      <header className="sticky top-14 md:top-0 z-10 -mx-6 md:-mx-8 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-4 md:px-6 lg:px-8 pb-3 pt-3 md:pb-4 md:pt-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
            Back to admin
          </Link>
          <div className="mt-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {displayName ?? target.email}
            </h1>
            {displayName && (
              <p className="mt-1 text-sm text-muted-foreground">{target.email}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={statusBadgeVariant}>
                {target.status.charAt(0).toUpperCase() + target.status.slice(1)}
              </Badge>
              {target.isAdmin && <Badge variant="default">Admin</Badge>}
              <span className="text-xs text-muted-foreground">
                Joined{" "}
                {formatDistanceToNow(new Date(target.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-8 md:space-y-10 px-4 md:px-6 lg:px-8 py-6 md:py-8">

      {/* Controls card */}
      {isSelf ? (
        <p className="text-sm text-muted-foreground">
          Cannot edit your own account.
        </p>
      ) : (
        <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              User controls
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/60 p-0">
            {/* Access row */}
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Access</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {target.status === "approved"
                    ? "This user can sign in and use the app."
                    : target.status === "pending"
                      ? "Waiting for approval. The user cannot sign in yet."
                      : "Access has been revoked. The user cannot sign in."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {target.status === "pending" && (
                  <>
                    <UserActionButton userId={targetId} variant="approve" />
                    <UserActionButton userId={targetId} variant="reject" />
                  </>
                )}
                {target.status === "approved" && (
                  <UserActionButton userId={targetId} variant="reject" />
                )}
                {target.status === "rejected" && (
                  <UserActionButton userId={targetId} variant="approve" />
                )}
              </div>
            </div>

            {/* Admin row */}
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Admin access
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {target.isAdmin
                    ? "Can access the admin panel and manage other users."
                    : "Standard user. No admin privileges."}
                </p>
              </div>
              <div className="shrink-0">
                <ToggleAdminButton
                  userId={targetId}
                  currentlyAdmin={target.isAdmin}
                  userLabel={displayName ?? target.email}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage card */}
      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">
            Credits this month
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {credits.limit === 0 ? (
            <p className="text-sm text-muted-foreground">
              No subscription found. Approve this user first.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className={countColor}>
                  {creditsUnlimited
                    ? `${credits.used} (no limit)`
                    : `${credits.used} of ${credits.limit}`}
                </span>
              </div>
              {!creditsUnlimited && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${barColor}`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {creditsUnlimited
                  ? "Admin account, no allowance applied."
                  : describeCredits(credits.remaining)}
              </p>
              <p className="text-xs text-muted-foreground">
                Real spend this month: {fmtUSD(usage.used)}
              </p>
              <p className="text-xs text-muted-foreground">
                Resets{" "}
                {new Date(usage.periodEndsAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <Separator />
              {hasCustomLimit ? (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Custom allowance: {formatAllowance(customCredits!)} a month
                    </span>
                    <ClearCustomLimitButton userId={targetId} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Plan allowance: {formatAllowance(planCredits)} a month
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Plan:{" "}
                  <span className="font-medium text-foreground">
                    {usage.planKey ?? "-"}
                  </span>{" "}
                  ({formatAllowance(planCredits)} a month)
                </p>
              )}
              {subscription && (
                <SetCustomLimitDialog
                  userId={targetId}
                  currentCredits={credits.limit}
                  planCredits={planCredits}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Cost across intervals */}
      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">What this user costs</CardTitle>
          <p className="text-sm text-muted-foreground">
            Real spend against the Anthropic API, with the credits charged for
            it. A figure marked over target is costing more per credit than the
            pricing assumes.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <UsageStatCard label="Last 24 hours" totals={today} />
            <UsageStatCard label="Last 7 days" totals={last7} />
            <UsageStatCard label="Last 30 days" totals={last30} />
            <UsageStatCard label="Last 12 months" totals={last365} />
            <UsageStatCard label="All time" totals={allTimeUsage} />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">
              Daily, last 30 days
            </h3>
            {dailySeries.length === 0 ? (
              <TrackingGapNotice scope="this user" />
            ) : (
              <UsageBars points={dailySeries} emptyMessage="" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* What the spend went on */}
      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">
            What they used it on
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            The total tells you how much. This tells you why.
          </p>
        </CardHeader>
        <CardContent>
          {featureBreakdown.length === 0 ? (
            <TrackingGapNotice scope="this user" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Per call</TableHead>
                    <TableHead className="text-right hidden md:table-cell">
                      Credits
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">
                      Per credit
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureBreakdown.map((f) => {
                    const perCall = f.calls > 0 ? f.costUSD / f.calls : 0;
                    const target = targetCostPerCall(f.feature as CreditFeature);
                    // Flag a feature whose real cost has drifted above what its
                    // credit weight was derived from.
                    const drifted = target > 0 && perCall > target * 1.5;
                    return (
                      <TableRow key={f.feature}>
                        <TableCell className="text-sm text-foreground">
                          {CREDIT_LABELS[f.feature as CreditFeature] ?? f.feature}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                          {f.calls}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-foreground">
                          {money(f.costUSD)}
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm tabular-nums ${drifted ? "font-medium text-destructive" : "text-muted-foreground"}`}
                          title={
                            drifted
                              ? `Priced at about ${money(target)} per call, actually costing ${money(perCall)}. This weight may need retuning.`
                              : undefined
                          }
                        >
                          {money(perCall)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground hidden md:table-cell">
                          {f.credits}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-muted-foreground hidden lg:table-cell">
                          {ratioLabel(f.costUSD, f.credits)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-t-2 border-border">
                    <TableCell className="text-sm font-medium text-foreground">
                      Total
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {allTimeUsage.calls}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {money(allTimeUsage.costUSD)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      -
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground hidden md:table-cell">
                      {allTimeUsage.credits}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground hidden lg:table-cell">
                      {ratioLabel(allTimeUsage.costUSD, allTimeUsage.credits)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Spend history card */}
      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">
            Earlier monthly totals
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Recorded before per-call tracking existed, so these are month totals
            only with no breakdown of what they were spent on.
          </p>
        </CardHeader>
        <CardContent>
          {spendHistory.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No spend recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">AI spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spendHistory.map((entry) => (
                    <TableRow key={entry.period}>
                      <TableCell className="text-sm text-foreground">
                        {formatPeriod(entry.period)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-foreground">
                        {fmtUSD(entry.aiSpendUSD)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-border">
                    <TableCell className="text-sm font-medium text-foreground">
                      All time
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
                      {fmtUSD(totalSpend)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit log card */}
      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditEntries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No admin actions logged yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditEntries.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground">
                        {formatAuditAction(entry.action, entry.details)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.adminEmail}
                      </TableCell>
                      <TableCell className="max-w-[240px] break-all text-sm text-muted-foreground">
                        {entry.details
                          ? Object.entries(entry.details)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(", ")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
