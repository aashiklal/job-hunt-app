import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobForm } from "../_components/job-form";

export const metadata: Metadata = {
  title: "Add Job — Job Hunt",
  description: "Add a new job application.",
};

export default function NewJobPage() {
  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8 py-6 md:py-10">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground"
      >
        <ChevronLeft className="size-4" strokeWidth={1.75} />
        Back to jobs
      </Link>

      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-semibold tracking-tight md:text-3xl">
            Add job
          </CardTitle>
        </CardHeader>
        <CardContent>
          <JobForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
