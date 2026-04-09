import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requireAdminWithPlan } from "@/lib/auth-helpers";
import * as auditLog from "@/lib/repositories/audit-log";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAuditAction } from "../_lib/format-audit";

export const metadata = {
  title: "Audit Log — Admin",
  description: "All admin actions across all users, last 90 days.",
};

export default async function AuditPage() {
  await requireAdminWithPlan();

  const entries = (await auditLog.listRecent(100)).map(auditLog.toAuditLogItem);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit log</h1>
          <p className="text-sm text-gray-500 mt-1">
            All admin actions — last 100 entries, last 90 days.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to admin
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All admin actions</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No admin actions logged yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target user</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry._id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDistanceToNow(new Date(entry.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.adminEmail}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatAuditAction(entry.action, entry.details)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/admin/${entry.targetUserId}`}
                        className="hover:underline"
                      >
                        {entry.targetUserEmail}
                      </Link>
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

      <p className="text-xs text-muted-foreground">
        Audit entries are retained for 90 days, then automatically deleted.
      </p>
    </div>
  );
}
