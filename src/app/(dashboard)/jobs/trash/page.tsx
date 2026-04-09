import type { Metadata } from "next";
import Link from "next/link";
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
  description: "Restore or permanently review deleted job applications.",
};

export default async function TrashPage() {
  const { user } = await requireApprovedUserWithPlan();
  const deletedJobs = await jobs.listDeleted(user._id.toString());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Trash</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <Link href="/jobs" className="hover:underline">
              ← Back to jobs
            </Link>
          </p>
        </div>
      </div>

      {deletedJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <p className="text-sm font-medium text-gray-600">Trash is empty.</p>
          <Link href="/jobs" className="text-sm text-muted-foreground hover:underline">
            Back to jobs
          </Link>
        </div>
      ) : (
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
              const id = (job._id as { toString(): string }).toString();
              return (
                <TableRow key={id}>
                  <TableCell className="font-medium">{job.company}</TableCell>
                  <TableCell>{job.role}</TableCell>
                  <TableCell className="text-gray-500">
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
      )}
    </div>
  );
}
