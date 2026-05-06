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
import { getCurrentUsage } from "@/lib/usage";
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

export const metadata: Metadata = {
  title: "User Detail: Admin",
  description: "View and manage a user's access, limits, and activity.",
};

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

  const [subscription, usage, auditEntries, spendHistory] = await Promise.all([
    subscriptions.getByUserId(userId),
    getCurrentUsage(userId),
    auditLog
      .listForTargetUser(userId)
      .then((docs) => docs.map(auditLog.toAuditLogItem)),
    usageRepo.listForUser(userId),
  ]);

  let planDefault = ctx.plan.aiSpendLimitUSD ?? 5.0;
  if (subscription?.planKey) {
    const plan = await plans.getByKey(subscription.planKey);
    if (plan) planDefault = plan.aiSpendLimitUSD ?? 5.0;
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

  const customLimit = subscription?.customLimits?.aiSpendLimitUSD;
  const hasCustomLimit = typeof customLimit === "number";

  const percentUsed =
    usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
  const remaining = Math.max(0, usage.limit - usage.used);
  const isOut = remaining <= 0 && usage.limit > 0;
  const isLow = !isOut && remaining < 1.0 && usage.limit > 0;
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
            AI spend this month
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {usage.limit === 0 ? (
            <p className="text-sm text-muted-foreground">
              No subscription found. Approve this user first.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Spent</span>
                <span className={countColor}>
                  {fmtUSD(usage.used)} of {fmtUSD(usage.limit)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${barColor}`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
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
                      Custom budget: {fmtUSD(customLimit!)}
                    </span>
                    <ClearCustomLimitButton userId={targetId} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Plan default: {fmtUSD(planDefault)} / month
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Budget from plan:{" "}
                  <span className="font-medium text-foreground">
                    {usage.planKey ?? "-"}
                  </span>{" "}
                  ({fmtUSD(planDefault)} / month)
                </p>
              )}
              {subscription && (
                <SetCustomLimitDialog
                  userId={targetId}
                  currentLimit={usage.limit}
                  planDefault={planDefault}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Spend history card */}
      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Spend history</CardTitle>
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
