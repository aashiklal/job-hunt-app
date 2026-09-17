import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminWithPlan } from "@/lib/auth-helpers";
import * as usersRepo from "@/lib/repositories/users";
import * as subscriptionsRepo from "@/lib/repositories/subscriptions";
import * as templates from "@/lib/repositories/templates";
import * as auditLog from "@/lib/repositories/audit-log";
import type { AuditAction } from "@/lib/repositories/audit-log";
import * as plansRepo from "@/lib/repositories/plans";
import { getBulkSpend, getPlatformStats } from "@/lib/usage";
import type { ThemeCapacity } from "@/lib/export/pixel-theme-contract";
import { TemplateManager } from "./_components/template-manager";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AuditTable } from "./_components/audit-table";
import { AuditFilters } from "./_components/audit-filters";
import { AdminUserTabs } from "./_components/admin-user-tabs";
import { PlanEditor } from "./_components/plan-editor";
import { StatsBar } from "./_components/stats-bar";
import { UserFilters } from "./_components/user-filters";

export const metadata: Metadata = {
  title: "Admin: Job Hunt",
  description: "Manage user access requests.",
};

const USER_PAGE_SIZE = 25;
const AUDIT_PAGE_SIZE = 25;
const USER_STATUSES = ["pending", "approved", "rejected"] as const;
const AUDIT_ACTIONS: AuditAction[] = [
  "user.approved",
  "user.rejected",
  "user.admin_granted",
  "user.admin_revoked",
  "user.custom_limit_set",
  "user.custom_limit_cleared",
  "user.upgrade_granted",
  "user.upgrade_declined",
  "template.uploaded",
  "template.deleted",
  "plan.updated",
];

type UserStatus = (typeof USER_STATUSES)[number];

function parsePositiveInt(value: string | undefined, fallback = 1): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseUserStatus(value: string | undefined): UserStatus {
  return USER_STATUSES.includes(value as UserStatus)
    ? (value as UserStatus)
    : "approved";
}

function parseAuditAction(value: string | undefined): AuditAction | undefined {
  return AUDIT_ACTIONS.includes(value as AuditAction)
    ? (value as AuditAction)
    : undefined;
}

function pageCount(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}

function buildHref(
  params: Record<string, string | undefined>,
  updates: Record<string, string | number | null | undefined>
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  const query = next.toString();
  return query ? `?${query}` : "?";
}

function PaginationLinks({
  label,
  page,
  totalPages,
  hrefForPage,
}: {
  label: string;
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label={label}
      className="mt-4 flex items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page <= 1 ? (
          <span className="rounded-md border border-border px-3 py-1.5 text-sm opacity-50">
            Previous
          </span>
        ) : (
          <Link
            href={hrefForPage(page - 1)}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Previous
          </Link>
        )}
        {page >= totalPages ? (
          <span className="rounded-md border border-border px-3 py-1.5 text-sm opacity-50">
            Next
          </span>
        ) : (
          <Link
            href={hrefForPage(page + 1)}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    page?: string;
    audit_page?: string;
    audit_action?: string;
  }>;
}) {
  const { user: admin, plan } = await requireAdminWithPlan();
  const adminId = (admin._id as { toString(): string }).toString();
  const params = await searchParams;
  const userTab = parseUserStatus(params.tab);
  const search = params.q?.trim() || undefined;
  const userPage = parsePositiveInt(params.page);
  const auditPage = parsePositiveInt(params.audit_page);
  const auditAction = parseAuditAction(params.audit_action);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const [
    statusCounts,
    filteredStatusCounts,
    paginatedUsers,
    adminTemplateList,
    auditResult,
    planDocs,
    platformStats,
    newSignupsCount,
    upgradeRequestUserIdList,
  ] = await Promise.all([
    usersRepo.countByStatus(),
    usersRepo.countByStatusWithSearch(search),
    usersRepo.listPaginated({
      status: userTab,
      search,
      page: userPage,
      limit: USER_PAGE_SIZE,
    }),
    templates.list(),
    auditLog.listRecent({
      limit: AUDIT_PAGE_SIZE,
      offset: (auditPage - 1) * AUDIT_PAGE_SIZE,
      action: auditAction,
    }),
    plansRepo.listAll(),
    getPlatformStats(),
    usersRepo.countNewSince(sevenDaysAgo),
    subscriptionsRepo.listPendingUpgradeUserIds(),
  ]);
  const upgradeRequestUserIds = new Set(upgradeRequestUserIdList);

  const currentUsers = paginatedUsers.users.map(usersRepo.toUserListItem);
  const approvedUserIds = currentUsers
    .filter((u) => u.status === "approved")
    .map((u) => u._id);
  const approvedSpend = await getBulkSpend(approvedUserIds);
  const plans = planDocs.map(plansRepo.toPlanListItem);

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
  const entries = auditResult.entries.map(auditLog.toAuditLogItem);
  const userTotalPages = pageCount(paginatedUsers.total, USER_PAGE_SIZE);
  const safeUserPage = Math.min(userPage, userTotalPages);
  const auditTotalPages = pageCount(auditResult.total, AUDIT_PAGE_SIZE);
  const safeAuditPage = Math.min(auditPage, auditTotalPages);
  const pendingUsers = userTab === "pending" ? currentUsers : [];
  const approvedUsers = userTab === "approved" ? currentUsers : [];
  const rejectedUsers = userTab === "rejected" ? currentUsers : [];
  const defaultAdminTab =
    auditAction || params.audit_page ? "audit" : "users";
  const hrefParams = {
    tab: userTab,
    q: search,
    page: String(safeUserPage),
    audit_page: String(safeAuditPage),
    audit_action: auditAction,
  };

  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10 md:space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Admin
      </h1>
      <StatsBar
        counts={statusCounts}
        totalSpendUSD={platformStats.totalSpendUSD}
        activeUserCount={platformStats.activeUserCount}
        newSignupsCount={newSignupsCount}
      />

      <Tabs defaultValue={defaultAdminTab}>
        <TabsList>
          <TabsTrigger value="users">
            Users
            {statusCounts.pending > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 py-0 text-xs">
                {statusCounts.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-foreground">User access</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Approve or reject sign-up requests.
            </p>
          </div>

          <UserFilters />
          <AdminUserTabs
            adminId={adminId}
            pending={pendingUsers}
            approved={approvedUsers}
            rejected={rejectedUsers}
            pendingCount={filteredStatusCounts.pending}
            approvedCount={filteredStatusCounts.approved}
            rejectedCount={filteredStatusCounts.rejected}
            approvedSpend={approvedSpend}
            spendLimit={planSpendLimit}
            page={safeUserPage}
            totalPages={userTotalPages}
            upgradeRequestUserIds={upgradeRequestUserIds}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <TemplateManager
            current={currentAdminTemplates}
            apiBase="/api/admin/templates"
            title="Default export templates"
            description="These templates are used for all users who have not uploaded their own. Upload a styled .docx file for each document type."
          />
        </TabsContent>

        <TabsContent value="plans" className="mt-6 space-y-4">
          <div>
            <h2 className="text-lg font-medium text-foreground">Plan limits</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Edit the monthly spend limit and resource caps for seeded plans.
            </p>
          </div>
          <PlanEditor plans={plans} />
        </TabsContent>

        <TabsContent value="audit" className="mt-6 space-y-4">
          <div>
            <h2 className="text-lg font-medium text-foreground">Audit log</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {auditAction
                ? `Filtered by ${auditAction}, page ${safeAuditPage} of ${auditTotalPages}.`
                : `All admin actions, page ${safeAuditPage} of ${auditTotalPages}.`}
            </p>
          </div>
          <AuditFilters />

          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No admin actions logged yet.
            </p>
          ) : (
            <AuditTable entries={entries} />
          )}
          <PaginationLinks
            label="Audit log pagination"
            page={safeAuditPage}
            totalPages={auditTotalPages}
            hrefForPage={(nextPage) =>
              buildHref(hrefParams, { audit_page: nextPage })
            }
          />
          <p className="text-xs text-muted-foreground">
            Audit entries are retained for 90 days, then automatically deleted.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
