import type { Metadata } from "next";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as jobs from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobsListView } from "./_components/jobs-list-view";
import { JobsPipelineView } from "./_components/jobs-pipeline-view";

export const metadata: Metadata = {
  title: "Jobs: JobHunt",
  description: "Browse and manage your job applications.",
};

export default async function JobsPage() {
  const { user } = await requireApprovedUserWithPlan();
  const userId = user._id.toString();
  const [jobList, resumeCount] = await Promise.all([
    jobs.list(userId),
    resumes.countForUser(userId),
  ]);

  return (
    <div className="space-y-8 md:space-y-10 px-4 md:px-6 lg:px-8 py-6 md:py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Jobs
        </h1>
        <Button asChild>
          <Link href="/jobs/new">Add job</Link>
        </Button>
      </div>

      {jobList.length === 0 && resumeCount === 0 ? (
        <Card className="mx-auto max-w-xl border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium">
              Welcome to JobHunt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              JobHunt helps you track job applications and tailor resumes for
              each one. Start by saving your base resume, then add your first
              job.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                How it works
              </p>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-3">
                  <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                    1.
                  </span>
                  <span className="text-foreground">
                    Save your base resume. Paste it in, or upload a PDF or DOCX
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                    2.
                  </span>
                  <span className="text-foreground">
                    Add a job you are applying for
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
                    3.
                  </span>
                  <span className="text-foreground">
                    Generate a tailored resume and cover letter for that job
                  </span>
                </li>
              </ol>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild>
                <Link href="/resume/new">Save your resume</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/jobs/new">Add a job</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : jobList.length === 0 ? (
        <Card className="border border-border/60 shadow-xs">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-base font-semibold text-foreground">
              No jobs yet
            </p>
            <p className="text-sm text-muted-foreground">
              Start by adding your first job application.
            </p>
            <Button asChild className="mt-1">
              <Link href="/jobs/new">Add job</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="mt-4">
            <JobsListView jobs={jobList} />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-4">
            <JobsPipelineView jobs={jobList} />
          </TabsContent>
        </Tabs>
      )}

      <div className="flex justify-center">
        <Link
          href="/jobs/trash"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
          View trash
        </Link>
      </div>
    </div>
  );
}
