import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as jobs from "@/lib/repositories/jobs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RestoreJobButton } from "./_components/restore-job-button";
import { PermanentDeleteButton } from "./_components/permanent-delete-button";

export const metadata: Metadata = {
  title: "Trash — Job Hunt",
  description: "Restore or permanently delete job applications.",
};

export default async function TrashPage() {
  const { user } = await requireApprovedUserWithPlan();
  const deletedJobs = await jobs.listDeleted(user._id.toString());

  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10">
      <div>
        <Link
          href="/jobs"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
          Back to jobs
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          Trash
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restore or permanently delete removed jobs.
        </p>
      </div>

      {deletedJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm font-medium text-foreground">Trash is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Deleted jobs will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60 shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deletedJobs.map((job) => {
                const id = job._id;
                return (
                  <TableRow key={id}>
                    <TableCell className="font-medium text-foreground">
                      <div className="max-w-[180px] truncate">{job.company}</div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      <div className="max-w-[220px] truncate">{job.role}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.deletedAt
                        ? formatDistanceToNow(new Date(job.deletedAt), {
                            addSuffix: true,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <RestoreJobButton jobId={id} />
                        <PermanentDeleteButton
                          jobId={id}
                          jobLabel={`${job.role} at ${job.company}`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
