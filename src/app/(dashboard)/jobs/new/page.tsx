import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { JobForm } from "../_components/job-form";

export const metadata: Metadata = {
  title: "Add Job — Job Hunt",
  description: "Add a new job application.",
};

export default function NewJobPage() {
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
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            Add job
          </h1>
        </div>
      </header>

      <div className="space-y-6 px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
          <CardContent className="p-6">
            <JobForm mode="create" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
