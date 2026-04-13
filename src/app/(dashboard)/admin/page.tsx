import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requireAdminWithPlan } from "@/lib/auth-helpers";
import * as usersRepo from "@/lib/repositories/users";
import { type IUser } from "@/lib/repositories/users";
import * as templates from "@/lib/repositories/templates";
import * as auditLog from "@/lib/repositories/audit-log";
import { getBulkSpend } from "@/lib/usage";
import { TemplateManager } from "./_components/template-manager";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserActionButton } from "./_components/user-actions";
import { formatAuditAction } from "./_lib/format-audit";

export const metadata = {
  title: "Admin — Job Hunt",
  description: "Manage user access requests.",
};

function UserTable({
  users,
  adminId,
  showApprove,
  showReject,
  spendMap,
  spendLimit,
}: {
  users: IUser[];
  adminId: string;
  showApprove: boolean;
  showReject: boolean;
  spendMap?: Record<string, number>;
  spendLimit?: number;
}) {
  const showSpend = !!spendMap;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Signed up</TableHead>
          {showSpend && <TableHead>Spend this month</TableHead>}
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const id = (user._id as { toString(): string }).toString();
          const isSelf = id === adminId;
          const name =
            user.firstName || user.lastName
              ? [user.firstName, user.lastName].filter(Boolean).join(" ")
              : "—";
          const spent = spendMap?.[id] ?? 0;
          return (
            <TableRow key={id}>
              <TableCell>
                <Link href={`/admin/${id}`} className="hover:underline">
                  {user.email}
                </Link>
              </TableCell>
              <TableCell>{name}</TableCell>
              <TableCell className="text-gray-500">
                {formatDistanceToNow(new Date(user.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>
              {showSpend && (
                <TableCell className="text-sm tabular-nums">
                  {user.isAdmin ? (
                    <span className="text-muted-foreground">${spent.toFixed(2)} (no cap)</span>
                  ) : (
                    <span className={spent >= (spendLimit ?? 5) ? "text-destructive font-medium" : ""}>
                      ${spent.toFixed(2)} / ${(spendLimit ?? 5).toFixed(2)}
                    </span>
                  )}
                </TableCell>
              )}
              <TableCell>
                {isSelf ? (
                  <span className="text-gray-400 text-sm">—</span>
                ) : (
                  <div className="flex items-center gap-2">
                    {showApprove && (
                      <UserActionButton userId={id} variant="approve" />
                    )}
                    {showReject && (
                      <UserActionButton userId={id} variant="reject" />
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default async function AdminPage() {
  const { user: admin, plan } = await requireAdminWithPlan();
  const adminId = (admin._id as { toString(): string }).toString();

  const [allUsers, adminTemplateList, auditEntries] = await Promise.all([
    usersRepo.listAll(),
    templates.list(),
    auditLog.listRecent(100),
  ]);

  const approvedUserIds = allUsers
    .filter((u) => u.status === "approved")
    .map((u) => (u._id as { toString(): string }).toString());

  const approvedSpend = await getBulkSpend(approvedUserIds);

  const currentAdminTemplates = Object.fromEntries(
    adminTemplateList.map((t) => [t.type, { fileName: t.fileName }])
  ) as Partial<Record<"resume" | "cover_letter", { fileName: string }>>;

  // Use the plan's spend limit as the reference for displaying user budgets in the table
  const planSpendLimit = plan.aiSpendLimitUSD ?? 5.0;

  const pending = allUsers.filter((u) => u.status === "pending");
  const approved = allUsers.filter((u) => u.status === "approved");
  const rejected = allUsers.filter((u) => u.status === "rejected");
  const entries = auditEntries.map(auditLog.toAuditLogItem);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Admin</h1>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            Users
            {pending.length > 0 && (
              <Badge className="ml-1.5 text-xs px-1.5 py-0 h-4">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6 space-y-4">
          <div>
            <h2 className="text-base font-medium text-gray-900">User Access</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Approve or reject sign-up requests.
            </p>
          </div>

          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pending
                <Badge className="ml-1.5 text-xs px-1.5 py-0 h-4">
                  {pending.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved
                <Badge className="ml-1.5 text-xs px-1.5 py-0 h-4">
                  {approved.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected
                <Badge className="ml-1.5 text-xs px-1.5 py-0 h-4">
                  {rejected.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {pending.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                  No pending requests. You&apos;re all caught up.
                </div>
              ) : (
                <UserTable
                  users={pending}
                  adminId={adminId}
                  showApprove
                  showReject
                />
              )}
            </TabsContent>

            <TabsContent value="approved" className="mt-4">
              <UserTable
                users={approved}
                adminId={adminId}
                showApprove={false}
                showReject
                spendMap={approvedSpend}
                spendLimit={planSpendLimit}
              />
            </TabsContent>

            <TabsContent value="rejected" className="mt-4">
              <UserTable
                users={rejected}
                adminId={adminId}
                showApprove
                showReject={false}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <TemplateManager
            current={currentAdminTemplates}
            apiBase="/api/admin/templates"
            title="Default Export Templates"
            description="These templates are used for all users who have not uploaded their own. Upload a styled .docx file for each document type."
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-6 space-y-4">
          <div>
            <h2 className="text-base font-medium text-gray-900">Audit Log</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              All admin actions — last 100 entries, last 90 days.
            </p>
          </div>

          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No admin actions logged yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target user</TableHead>
                    <TableHead>By</TableHead>
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
                      <TableCell className="text-sm font-medium">
                        {formatAuditAction(entry.action, entry.details)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        <Link
                          href={`/admin/${entry.targetUserId}`}
                          className="hover:underline"
                        >
                          {entry.targetUserEmail}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                        {entry.adminEmail}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Audit entries are retained for 90 days, then automatically deleted.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
