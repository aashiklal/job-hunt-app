import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as jobs from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import * as documents from "@/lib/repositories/documents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteJobButton } from "./_components/delete-job-button";
import { GeneratePanel } from "./_components/generate-panel";
import { JDAnalysisPanel } from "./_components/jd-analysis-panel";
import { StatusBadge } from "@/app/(dashboard)/jobs/_components/status-badge";

export const metadata: Metadata = {
  title: "Job Detail — Job Hunt",
  description: "View your job application details.",
};

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="text-sm text-foreground">{children}</div>
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
  const userIdStr = user._id.toString();

  const job = await jobs.getById(userIdStr, id);
  if (!job) notFound();

  const [resumeList, latestResumeDoc, latestCoverLetterDoc, latestJDDoc] =
    await Promise.all([
      resumes.list(userIdStr),
      documents.getLatestForJob(userIdStr, id, "resume"),
      documents.getLatestForJob(userIdStr, id, "cover_letter"),
      documents.getLatestForJob(userIdStr, id, "jd_analysis"),
    ]);

  const initialAnalysis = latestJDDoc
    ? (() => {
        try {
          return JSON.parse(latestJDDoc.content);
        } catch {
          return null;
        }
      })()
    : null;

  const resumeOptions = resumeList.map((r) => ({
    _id: (r._id as { toString(): string }).toString(),
    title: r.title,
    isDefault: r.isDefault,
  }));

  const jobLabel = `${job.role} at ${job.company}`;

  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10 md:space-y-10">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground"
      >
        <ChevronLeft className="size-4" strokeWidth={1.75} />
        Back to jobs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {jobLabel}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/jobs/${id}/edit`}>Edit</Link>
          </Button>
          <DeleteJobButton jobId={id} jobLabel={jobLabel} />
        </div>
      </div>

      {/* Details */}
      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DetailRow label="Company">{job.company}</DetailRow>
            <DetailRow label="Role">{job.role}</DetailRow>
            <DetailRow label="Location">{job.location ?? <Dash />}</DetailRow>
            <DetailRow label="Status">
              <StatusBadge status={job.status} />
            </DetailRow>
            <DetailRow label="URL">
              {job.url ? (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 break-all underline underline-offset-4 transition-opacity duration-200 hover:opacity-70"
                >
                  {job.url}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              ) : (
                <Dash />
              )}
            </DetailRow>
            <DetailRow label="Salary">{job.salary ?? <Dash />}</DetailRow>
            <DetailRow label="Applied at">
              {job.appliedAt ? (
                format(new Date(job.appliedAt), "PPP")
              ) : (
                <span className="text-muted-foreground">Not yet</span>
              )}
            </DetailRow>
            <DetailRow label="Added">
              {formatDistanceToNow(new Date(job.createdAt), {
                addSuffix: true,
              })}
            </DetailRow>
          </div>
        </CardContent>
      </Card>

      {/* Job description */}
      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Job description</CardTitle>
        </CardHeader>
        <CardContent>
          {job.jobDescription ? (
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
              {job.jobDescription}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No description saved.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {job.notes ? (
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
              {job.notes}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No notes.</p>
          )}
        </CardContent>
      </Card>

      {/* AI Generation */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">AI Generation</h2>
        <GeneratePanel
          type="resume"
          jobId={id}
          resumes={resumeOptions}
          initialContent={latestResumeDoc?.content ?? null}
          initialResumeId={latestResumeDoc?.resumeIdUsed?.toString() ?? null}
        />
        <GeneratePanel
          type="cover_letter"
          jobId={id}
          resumes={resumeOptions}
          initialContent={latestCoverLetterDoc?.content ?? null}
          initialResumeId={
            latestCoverLetterDoc?.resumeIdUsed?.toString() ?? null
          }
        />
        <JDAnalysisPanel
          jobId={id}
          hasJobDescription={
            !!job.jobDescription && job.jobDescription.trim().length >= 50
          }
          initialAnalysis={initialAnalysis}
        />
      </div>
    </div>
  );
}
