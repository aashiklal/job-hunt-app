"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
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

type Props = {
  users: UserListItem[];
  adminId: string;
  showApprove: boolean;
  showReject: boolean;
  spendMap?: Record<string, number>;
  spendLimit?: number;
};

export function UserTable({
  users,
  adminId,
  showApprove,
  showReject,
  spendMap,
  spendLimit,
}: Props) {
  const router = useRouter();
  const showSpend = !!spendMap;

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
                Spend this month
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
            const spent = spendMap?.[id] ?? 0;
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
                    {user.isAdmin ? (
                      <span className="text-muted-foreground">
                        ${spent.toFixed(2)} (no cap)
                      </span>
                    ) : (
                      <span
                        className={
                          spent >= (spendLimit ?? 5)
                            ? "font-medium text-destructive"
                            : "text-foreground"
                        }
                      >
                        ${spent.toFixed(2)} / ${(spendLimit ?? 5).toFixed(2)}
                      </span>
                    )}
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
