import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as jobs from "@/lib/repositories/jobs";
import { Card, CardContent } from "@/components/ui/card";
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
    <div>
      <header className="sticky top-14 md:top-0 z-10 -mx-6 md:-mx-8 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-4 md:px-6 lg:px-8 pb-3 pt-3 md:pb-4 md:pt-4">
          <Link
            href={`/jobs/${id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
            Back to job
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            Edit job
          </h1>
        </div>
      </header>

      <div className="space-y-6 px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
          <CardContent className="p-6">
            <JobForm mode="edit" initialValues={initialValues} jobId={id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
