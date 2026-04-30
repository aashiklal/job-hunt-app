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
import { JobDetailTabs } from "./_components/job-detail-tabs";
import { StatusBadge } from "@/app/(dashboard)/jobs/_components/status-badge";

export const metadata: Metadata = {
  title: "Job Detail -- Job Hunt",
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

const Dash = () => <span className="text-muted-foreground">-</span>;

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

  const [
    resumeList,
    latestResumeDoc,
    latestCoverLetterDoc,
    latestJDDoc,
    latestLinkedInNoteDoc,
    latestLinkedInDmDoc,
    latestFollowUpEmailDoc,
    latestThankYouEmailDoc,
    latestInterviewPrepDoc,
    latestLinkedInFollowupDmDoc,
    latestColdEmailDoc,
    latestCheckinEmailDoc,
    latestSalaryNegotiationDoc,
  ] = await Promise.all([
    resumes.list(userIdStr),
    documents.getLatestForJob(userIdStr, id, "resume"),
    documents.getLatestForJob(userIdStr, id, "cover_letter"),
    documents.getLatestForJob(userIdStr, id, "jd_analysis"),
    documents.getLatestForJob(userIdStr, id, "linkedin_note"),
    documents.getLatestForJob(userIdStr, id, "linkedin_dm"),
    documents.getLatestForJob(userIdStr, id, "followup_email"),
    documents.getLatestForJob(userIdStr, id, "thankyou_email"),
    documents.getLatestForJob(userIdStr, id, "interview_prep"),
    documents.getLatestForJob(userIdStr, id, "linkedin_followup_dm"),
    documents.getLatestForJob(userIdStr, id, "cold_email"),
    documents.getLatestForJob(userIdStr, id, "checkin_email"),
    documents.getLatestForJob(userIdStr, id, "salary_negotiation"),
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

  const initialInterviewPrep = latestInterviewPrepDoc
    ? (() => {
        try {
          return JSON.parse(latestInterviewPrepDoc.content);
        } catch {
          return null;
        }
      })()
    : null;

  const defaultResume = resumeList.find((r) => r.isDefault) ?? resumeList[0] ?? null;
  const defaultResumeContent = defaultResume?.content ?? "";

  const resumeOptions = resumeList.map((r) => ({
    _id: r._id,
    title: r.title,
    isDefault: r.isDefault,
  }));

  const jobLabel = `${job.role} at ${job.company}`;

  return (
    <div>
      <header className="sticky top-14 md:top-0 z-10 -mx-6 md:-mx-8 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-4 md:px-6 lg:px-8 pb-3 pt-3 md:pb-4 md:pt-4">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
            Back to jobs
          </Link>
          <div className="mt-2 flex items-start justify-between gap-4">
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
        </div>
      </header>

      <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-8 md:space-y-10">
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

        {/* AI Tools */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">AI tools</h2>
          <JobDetailTabs
            jobId={id}
            job={{
              company: job.company,
              role: job.role,
              status: job.status,
              appliedAt: job.appliedAt,
              jobDescription: job.jobDescription,
              contactName: job.contactName,
              contactTitle: job.contactTitle,
            }}
            resumes={resumeOptions}
            defaultResumeContent={defaultResumeContent}
            initialResumeContent={latestResumeDoc?.content ?? null}
            initialResumeId={latestResumeDoc?.resumeIdUsed ?? null}
            initialCoverLetterContent={latestCoverLetterDoc?.content ?? null}
            initialCoverLetterId={latestCoverLetterDoc?.resumeIdUsed ?? null}
            initialAnalysis={initialAnalysis}
            initialLinkedInNote={latestLinkedInNoteDoc?.content ?? null}
            initialLinkedInDm={latestLinkedInDmDoc?.content ?? null}
            initialFollowUpEmail={latestFollowUpEmailDoc?.content ?? null}
            initialThankYouEmail={latestThankYouEmailDoc?.content ?? null}
            initialInterviewPrep={initialInterviewPrep}
            initialLinkedInFollowupDm={latestLinkedInFollowupDmDoc?.content ?? null}
            initialColdEmail={latestColdEmailDoc?.content ?? null}
            initialCheckinEmail={latestCheckinEmailDoc?.content ?? null}
            initialSalaryNegotiation={latestSalaryNegotiationDoc?.content ?? null}
          />
        </div>
      </div>
    </div>
  );
}
