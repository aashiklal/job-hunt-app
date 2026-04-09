import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requireAdminWithPlan } from "@/lib/auth-helpers";
import * as users from "@/lib/repositories/users";
import * as subscriptions from "@/lib/repositories/subscriptions";
import * as auditLog from "@/lib/repositories/audit-log";
import * as plans from "@/lib/repositories/plans";
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

export const metadata = {
  title: "User Detail — Admin",
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

  const [subscription, usage, auditEntries] = await Promise.all([
    subscriptions.getByUserId(userId),
    getCurrentUsage(userId),
    auditLog.listForTargetUser(userId).then((docs) => docs.map(auditLog.toAuditLogItem)),
  ]);

  // Resolve plan default for the target user's subscription
  let planDefault = ctx.plan.aiGenerationsPerMonth;
  if (subscription?.planKey) {
    const plan = await plans.getByKey(subscription.planKey);
    if (plan) planDefault = plan.aiGenerationsPerMonth;
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

  const customLimit = subscription?.customLimits?.aiGenerationsPerMonth;
  const hasCustomLimit = typeof customLimit === "number";

  const percentUsed = usage.limit > 0 ? Math.round((usage.used / usage.limit) * 100) : 0;
  const remaining = Math.max(0, usage.limit - usage.used);
  const isOut = remaining === 0 && usage.limit > 0;
  const isLow = !isOut && remaining <= 5 && usage.limit > 0;

  const barColor = isOut
    ? "bg-destructive"
    : isLow
      ? "bg-yellow-500"
      : "bg-primary";

  const countColor = isOut
    ? "font-semibold text-destructive"
    : isLow
      ? "font-semibold text-yellow-600"
      : "font-medium";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        ← Back to admin
      </Link>

      {/* Identity card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-lg">
                {displayName ?? target.email}
              </CardTitle>
              {displayName && (
                <p className="text-sm text-muted-foreground">{target.email}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap pt-1">
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
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          {isSelf ? (
            <p className="text-sm text-muted-foreground">
              Cannot edit your own account.
            </p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
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
              <ToggleAdminButton
                userId={targetId}
                currentlyAdmin={target.isAdmin}
                userLabel={displayName ?? target.email}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI generation usage this month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {usage.limit === 0 ? (
            <p className="text-sm text-muted-foreground">
              No subscription found — approve this user first.
            </p>
          ) : (
            <>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className={countColor}>
                  {usage.used} of {usage.limit}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} transition-all`}
                  style={{ width: `${Math.min(100, percentUsed)}%` }}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      Custom limit: {customLimit}
                    </span>
                    <ClearCustomLimitButton userId={targetId} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Plan default: {planDefault}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Limit from plan:{" "}
                  <span className="font-medium">{usage.planKey ?? "—"}</span>{" "}
                  ({planDefault} / month)
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

      {/* Audit log card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent activity for this user</CardTitle>
        </CardHeader>
        <CardContent>
          {auditEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No admin actions logged yet.
            </p>
          ) : (
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
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDistanceToNow(new Date(entry.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatAuditAction(entry.action, entry.details)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.adminEmail}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.details
                        ? Object.entries(entry.details)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
