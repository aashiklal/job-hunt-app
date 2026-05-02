import type { Metadata } from "next";
import { requireAdminWithPlan } from "@/lib/auth-helpers";
import * as usersRepo from "@/lib/repositories/users";
import type { UserListItem } from "@/lib/repositories/users";
import * as templates from "@/lib/repositories/templates";
import * as auditLog from "@/lib/repositories/audit-log";
import { getBulkSpend } from "@/lib/usage";
import type { ThemeCapacity } from "@/lib/export/pixel-theme-contract";
import { TemplateManager } from "./_components/template-manager";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { UserTable } from "./_components/user-table";
import { AuditTable } from "./_components/audit-table";

export const metadata: Metadata = {
  title: "Admin — Job Hunt",
  description: "Manage user access requests.",
};

export default async function AdminPage() {
  const { user: admin, plan } = await requireAdminWithPlan();
  const adminId = (admin._id as { toString(): string }).toString();

  const [rawUsers, adminTemplateList, auditEntries] = await Promise.all([
    usersRepo.listAll(),
    templates.list(),
    auditLog.listRecent(100),
  ]);

  const allUsers: UserListItem[] = rawUsers.map(usersRepo.toUserListItem);

  const approvedUserIds = allUsers
    .filter((u) => u.status === "approved")
    .map((u) => u._id);

  const approvedSpend = await getBulkSpend(approvedUserIds);

  const currentAdminTemplates = Object.fromEntries(
    adminTemplateList.map((t) => [
      t.type,
      {
        fileName: t.fileName,
        mappedRegionCount: t.mappedRegionCount ?? 0,
        mappedStyleCount: t.mappedStyleCount ?? 0,
        themeCapacity: t.themeCapacity ?? null,
      },
    ])
  ) as Partial<
    Record<
      "resume" | "cover_letter",
      {
        fileName: string;
        mappedRegionCount: number;
        mappedStyleCount: number;
        themeCapacity: ThemeCapacity | null;
      }
    >
  >;

  const planSpendLimit = plan.aiSpendLimitUSD ?? 5.0;

  const pending = allUsers.filter((u) => u.status === "pending");
  const approved = allUsers.filter((u) => u.status === "approved");
  const rejected = allUsers.filter((u) => u.status === "rejected");
  const entries = auditEntries.map(auditLog.toAuditLogItem);

  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10 md:space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Admin
      </h1>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            Users
            {pending.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 py-0 text-xs">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-foreground">User access</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Approve or reject sign-up requests.
            </p>
          </div>

          <Tabs defaultValue="approved">
            <TabsList>
              <TabsTrigger value="pending">
                Pending
                <Badge className="ml-1.5 h-4 px-1.5 py-0 text-xs">
                  {pending.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved
                <Badge className="ml-1.5 h-4 px-1.5 py-0 text-xs">
                  {approved.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected
                <Badge className="ml-1.5 h-4 px-1.5 py-0 text-xs">
                  {rejected.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {pending.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
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
            title="Default export templates"
            description="These templates are used for all users who have not uploaded their own. Upload a styled .docx file for each document type."
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-6 space-y-4">
          <div>
            <h2 className="text-lg font-medium text-foreground">Audit log</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              All admin actions — last 100 entries, last 90 days.
            </p>
          </div>

          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No admin actions logged yet.
            </p>
          ) : (
            <AuditTable entries={entries} />
          )}
          <p className="text-xs text-muted-foreground">
            Audit entries are retained for 90 days, then automatically deleted.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
