"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UserTable } from "./user-table";
import type { UserListItem } from "@/lib/repositories/users";

type AdminUserTabsProps = {
  adminId: string;
  pending: UserListItem[];
  approved: UserListItem[];
  rejected: UserListItem[];
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvedUsage: Record<string, { costUSD: number; credits: number; calls: number }>;
  sortByCost: boolean;
  page: number;
  totalPages: number;
};

const USER_STATUSES = ["pending", "approved", "rejected"] as const;

function parseTab(value: string | null): (typeof USER_STATUSES)[number] {
  return USER_STATUSES.includes(value as (typeof USER_STATUSES)[number])
    ? (value as (typeof USER_STATUSES)[number])
    : "approved";
}

export function AdminUserTabs({
  adminId,
  pending,
  approved,
  rejected,
  pendingCount,
  approvedCount,
  rejectedCount,
  approvedUsage,
  sortByCost,
  page,
  totalPages,
}: AdminUserTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));

  function handleTabChange(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.set("page", "1");
    router.push("?" + params.toString());
  }

  function toggleCostSort() {
    const params = new URLSearchParams(searchParams.toString());
    if (sortByCost) {
      params.delete("sort");
    } else {
      params.set("sort", "cost");
    }
    // Sorting reorders the whole list, so the current page number is meaningless.
    params.set("page", "1");
    router.push("?" + params.toString());
  }

  function goToPage(n: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(n));
    router.push("?" + params.toString());
  }

  const paginationControls = (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Previous page"
        >
          Previous
        </button>
        <button
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="pending">
          Pending
          <Badge className="ml-1.5 h-4 px-1.5 py-0 text-xs">
            {pendingCount}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="approved">
          Approved
          <Badge className="ml-1.5 h-4 px-1.5 py-0 text-xs">
            {approvedCount}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="rejected">
          Rejected
          <Badge className="ml-1.5 h-4 px-1.5 py-0 text-xs">
            {rejectedCount}
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
        {totalPages > 1 && paginationControls}
      </TabsContent>

      <TabsContent value="approved" className="mt-4">
        {approved.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No approved users found.
          </div>
        ) : (
          <UserTable
            users={approved}
            adminId={adminId}
            showApprove={false}
            showReject
            usageMap={approvedUsage}
            sortByCost={sortByCost}
            onToggleSort={toggleCostSort}
          />
        )}
        {totalPages > 1 && paginationControls}
      </TabsContent>

      <TabsContent value="rejected" className="mt-4">
        {rejected.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No rejected users found.
          </div>
        ) : (
          <UserTable
            users={rejected}
            adminId={adminId}
            showApprove
            showReject={false}
          />
        )}
        {totalPages > 1 && paginationControls}
      </TabsContent>
    </Tabs>
  );
}
