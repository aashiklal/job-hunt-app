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
import { formatAuditAction } from "../_lib/format-audit";
import type { AuditLogItem } from "@/lib/repositories/audit-log";

type Props = {
  entries: AuditLogItem[];
};

export function AuditTable({ entries }: Props) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 shadow-xs">
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
            <TableRow
              key={entry._id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => router.push(`/admin/${entry.targetUserId}`)}
            >
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(entry.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell className="text-sm font-medium text-foreground">
                {formatAuditAction(entry.action, entry.details)}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-sm text-foreground">
                {entry.targetUserEmail}
              </TableCell>
              <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                {entry.adminEmail}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
