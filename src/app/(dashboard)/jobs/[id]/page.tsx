import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { ExternalLink } from "lucide-react";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as jobs from "@/lib/repositories/jobs";
import type { JobStatus } from "@/lib/repositories/jobs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteJobButton } from "./_components/delete-job-button";

export const metadata: Metadata = {
  title: "Job Detail — Job Hunt",
  description: "View your job application details.",
};

function StatusBadge({ status }: { status: JobStatus }) {
  if (status === "offer") {
    return <Badge className="bg-green-600 hover:bg-green-700">{status}</Badge>;
  }
  if (status === "rejected" || status === "withdrawn") {
    return <Badge variant="destructive">{status}</Badge>;
  }
  if (status === "saved") {
    return <Badge variant="secondary">{status}</Badge>;
  }
  return <Badge>{status}</Badge>;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

const Dash = () => <span className="text-muted-foreground">—</span>;

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireApprovedUserWithPlan();

  const job = await jobs.getById(user._id.toString(), id);
  if (!job) notFound();

  const jobLabel = `${job.role} at ${job.company}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/jobs"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to jobs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">{jobLabel}</h1>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" variant="outline">
            <Link href={`/jobs/${id}/edit`}>Edit</Link>
          </Button>
          <DeleteJobButton jobId={id} jobLabel={jobLabel} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DetailRow label="Company">{job.company}</DetailRow>
            <DetailRow label="Role">{job.role}</DetailRow>
            <DetailRow label="Location">
              {job.location ?? <Dash />}
            </DetailRow>
            <DetailRow label="Status">
              <StatusBadge status={job.status} />
            </DetailRow>
            <DetailRow label="URL">
              {job.url ? (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all"
                >
                  {job.url}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <Dash />
              )}
            </DetailRow>
            <DetailRow label="Salary">
              {job.salary ?? <Dash />}
            </DetailRow>
            <DetailRow label="Applied at">
              {job.appliedAt
                ? format(new Date(job.appliedAt), "PPP")
                : <span className="text-muted-foreground">Not yet</span>}
            </DetailRow>
            <DetailRow label="Added">
              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
            </DetailRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job description</CardTitle>
        </CardHeader>
        <CardContent>
          {job.jobDescription ? (
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
              {job.jobDescription}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No description saved.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {job.notes ? (
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
              {job.notes}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No notes.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
