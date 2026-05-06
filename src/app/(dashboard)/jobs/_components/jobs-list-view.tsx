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
import type { JobListItem } from "@/lib/repositories/jobs";
import { StatusBadge } from "./status-badge";

type Props = {
  jobs: JobListItem[];
};

export function JobsListView({ jobs }: Props) {
  const router = useRouter();

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border/60 shadow-xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow
              key={job._id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => router.push(`/jobs/${job._id}`)}
            >
              <TableCell>
                <div className="max-w-[180px] truncate">{job.company}</div>
              </TableCell>
              <TableCell>
                <div className="max-w-[220px] truncate">{job.role}</div>
              </TableCell>
              <TableCell>
                <div className="max-w-[140px] truncate">{job.location ?? "-"}</div>
              </TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {formatDistanceToNow(new Date(job.updatedAt), {
                  addSuffix: true,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
