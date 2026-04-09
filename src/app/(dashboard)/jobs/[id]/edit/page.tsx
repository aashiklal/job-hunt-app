import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as jobs from "@/lib/repositories/jobs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobForm } from "../../_components/job-form";

export const metadata: Metadata = {
  title: "Edit Job — Job Hunt",
  description: "Edit a job application.",
};

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireApprovedUserWithPlan();

  const job = await jobs.getById(user._id.toString(), id);
  if (!job) notFound();

  const initialValues = {
    company: job.company,
    role: job.role,
    location: job.location ?? "",
    jobDescription: job.jobDescription ?? "",
    url: job.url ?? "",
    salary: job.salary ?? "",
    status: job.status,
    notes: job.notes ?? "",
    appliedAt: job.appliedAt ? job.appliedAt.toISOString().slice(0, 10) : "",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/jobs"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to Jobs
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit job</CardTitle>
        </CardHeader>
        <CardContent>
          <JobForm mode="edit" initialValues={initialValues} jobId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
