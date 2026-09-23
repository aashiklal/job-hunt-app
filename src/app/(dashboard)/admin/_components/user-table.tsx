"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ArrowDown } from "lucide-react";
import { costPerCredit, isOverTarget } from "@/lib/credits";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserActionButton } from "./user-actions";
import type { UserListItem } from "@/lib/repositories/users";

type UsageTotals = { costUSD: number; credits: number; calls: number };

type Props = {
  users: UserListItem[];
  adminId: string;
  showApprove: boolean;
  showReject: boolean;
  /** Rolling 30 day cost per user id. Present only on the approved tab. */
  usageMap?: Record<string, UsageTotals>;
  sortByCost?: boolean;
  onToggleSort?: () => void;
};

export function UserTable({
  users,
  adminId,
  showApprove,
  showReject,
  usageMap,
  sortByCost,
  onToggleSort,
}: Props) {
  const router = useRouter();
  const showSpend = !!usageMap;

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 shadow-xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead className="hidden md:table-cell">Name</TableHead>
            <TableHead className="hidden md:table-cell">Signed up</TableHead>
            {showSpend && (
              <TableHead className="hidden md:table-cell">
                <button
                  type="button"
                  onClick={onToggleSort}
                  className="inline-flex items-center gap-1 rounded-sm font-medium transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                  aria-label={
                    sortByCost
                      ? "Sorted by cost. Click to sort by sign-up date"
                      : "Sort by cost, highest first"
                  }
                >
                  Cost, 30 days
                  <ArrowDown
                    className={`size-3 ${sortByCost ? "text-foreground" : "text-muted-foreground/40"}`}
                    aria-hidden="true"
                  />
                </button>
              </TableHead>
            )}
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const id = user._id;
            const isSelf = id === adminId;
            const name =
              user.firstName || user.lastName
                ? [user.firstName, user.lastName].filter(Boolean).join(" ")
                : "-";
            const usage = usageMap?.[id] ?? {
              costUSD: 0,
              credits: 0,
              calls: 0,
            };
            const ratio = costPerCredit(usage.costUSD, usage.credits);
            return (
              <TableRow
                key={id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/admin/${id}`)}
              >
                <TableCell className="text-foreground">
                  <div className="max-w-[220px] truncate">{user.email}</div>
                </TableCell>
                <TableCell className="hidden text-foreground md:table-cell">
                  <div className="max-w-[160px] truncate">{name}</div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {formatDistanceToNow(new Date(user.createdAt), {
                    addSuffix: true,
                  })}
                </TableCell>
                {showSpend && (
                  <TableCell className="hidden text-sm tabular-nums md:table-cell">
                    <div className="flex items-center">
                      <span
                        className={
                          isOverTarget(ratio)
                            ? "font-medium text-destructive"
                            : "text-foreground"
                        }
                      >
                        ${usage.costUSD.toFixed(usage.costUSD < 1 ? 4 : 2)}
                      </span>
                      {isOverTarget(ratio) && (
                        <span
                          className="ml-2 rounded-sm bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                          title={`Costing $${ratio!.toFixed(4)} per credit, above the pricing target.`}
                        >
                          Over target
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {usage.credits} credits · {usage.calls}{" "}
                      {usage.calls === 1 ? "call" : "calls"}
                    </span>
                  </TableCell>
                )}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {isSelf ? (
                    <span className="text-sm text-muted-foreground">-</span>
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
    </div>
  );
}
