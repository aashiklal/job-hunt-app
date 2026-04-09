import type { Metadata } from "next";
import Link from "next/link";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as jobs from "@/lib/repositories/jobs";
import { toJobListItem } from "@/lib/repositories/jobs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobsListView } from "./_components/jobs-list-view";
import { JobsPipelineView } from "./_components/jobs-pipeline-view";

export const metadata: Metadata = {
  title: "Jobs — Job Hunt",
  description: "Browse and manage your job applications.",
};

export default async function JobsPage() {
  const { user } = await requireApprovedUserWithPlan();
  const rawJobs = await jobs.list(user._id.toString());
  const jobList = rawJobs.map(toJobListItem);

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
