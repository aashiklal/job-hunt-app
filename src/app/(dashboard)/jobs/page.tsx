import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as jobs from "@/lib/repositories/jobs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import type { JobStatus } from "@/lib/repositories/jobs";

export const metadata: Metadata = {
  title: "Jobs — Job Hunt",
  description: "Browse and manage your job applications.",
};

function StatusBadge({ status }: { status: JobStatus }) {
  if (status === "offer") {
    return (
      <Badge className="bg-green-600 hover:bg-green-700">{status}</Badge>
    );
  }
  if (status === "rejected" || status === "withdrawn") {
    return <Badge variant="destructive">{status}</Badge>;
  }
  if (status === "saved") {
    return <Badge variant="secondary">{status}</Badge>;
  }
  // applied, screening, interview, assessment
  return <Badge>{status}</Badge>;
}

export default async function JobsPage() {
  const { user } = await requireApprovedUserWithPlan();
  const jobList = await jobs.list(user._id.toString());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Jobs</h1>
        <Button asChild>
          <Link href="/jobs/new">Add Job</Link>
        </Button>
      </div>

      {jobList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-base font-semibold text-gray-900">No jobs yet</p>
            <p className="text-sm text-muted-foreground">
              Start by adding your first job application.
            </p>
            <Button asChild className="mt-1">
              <Link href="/jobs/new">Add Job</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobList.map((job) => {
              const id = (job._id as { toString(): string }).toString();
              return (
                <TableRow key={id}>
                  <TableCell>
                    <Link href={`/jobs/${id}`} className="hover:underline">
                      {job.company}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/jobs/${id}`} className="hover:underline">
                      {job.role}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/jobs/${id}`} className="block">
                      {job.location ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/jobs/${id}`} className="block">
                      <StatusBadge status={job.status} />
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    <Link href={`/jobs/${id}`} className="block">
                      {formatDistanceToNow(new Date(job.updatedAt), {
                        addSuffix: true,
                      })}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <div className="text-center">
        <Link href="/jobs/trash" className="text-sm text-muted-foreground hover:underline">
          View trash
        </Link>
      </div>
    </div>
  );
}
