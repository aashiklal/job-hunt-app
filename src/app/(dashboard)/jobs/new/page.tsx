import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobForm } from "../_components/job-form";

export const metadata: Metadata = {
  title: "Add Job — Job Hunt",
  description: "Add a new job application.",
};

export default function NewJobPage() {
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
          <CardTitle>Add Job</CardTitle>
        </CardHeader>
        <CardContent>
          <JobForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
