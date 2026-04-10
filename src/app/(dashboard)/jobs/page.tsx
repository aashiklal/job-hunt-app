import type { Metadata } from "next";
import Link from "next/link";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as jobs from "@/lib/repositories/jobs";
import { toJobListItem } from "@/lib/repositories/jobs";
import * as resumes from "@/lib/repositories/resumes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobsListView } from "./_components/jobs-list-view";
import { JobsPipelineView } from "./_components/jobs-pipeline-view";

export const metadata: Metadata = {
  title: "Jobs — Job Hunt",
  description: "Browse and manage your job applications.",
};

export default async function JobsPage() {
  const { user } = await requireApprovedUserWithPlan();
  const userId = user._id.toString();
  const [rawJobs, resumeCount] = await Promise.all([
    jobs.list(userId),
    resumes.countForUser(userId),
  ]);
  const jobList = rawJobs.map(toJobListItem);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Jobs</h1>
        <Button asChild>
          <Link href="/jobs/new">Add Job</Link>
        </Button>
      </div>

      {jobList.length === 0 && resumeCount === 0 ? (
        <Card className="max-w-xl mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Welcome to JobHunt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              JobHunt helps you track job applications and tailor resumes for
              each one. Start by saving your base resume, then add your first
              job.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                How it works
              </p>
              <ol className="space-y-1.5 text-sm text-gray-700">
                <li className="flex gap-2">
                  <span className="shrink-0 font-medium text-gray-400">1.</span>
                  Save your base resume — paste it in, or upload a PDF or DOCX
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-medium text-gray-400">2.</span>
                  Add a job you are applying for
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-medium text-gray-400">3.</span>
                  Generate a tailored resume and cover letter for that job
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

      <div className="text-center">
        <Link
          href="/jobs/trash"
          className="text-sm text-muted-foreground hover:underline"
        >
          View trash
        </Link>
      </div>
    </div>
  );
}
