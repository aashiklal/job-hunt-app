import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as resumes from "@/lib/repositories/resumes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumeForm } from "../_components/resume-form";

export const metadata: Metadata = {
  title: "New Resume — Job Hunt",
  description: "Create a new base resume.",
};

export default async function NewResumePage() {
  const { user, plan } = await requireApprovedUserWithPlan();
  const count = await resumes.countForUser(user._id.toString());
  const maxResumes = plan.maxResumes;

  if (maxResumes !== -1 && count >= maxResumes) {
    redirect("/resume");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 md:px-6 lg:px-8 py-6 md:py-10">
      <Link
        href="/resume"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground"
      >
        <ChevronLeft className="size-4" strokeWidth={1.75} />
        Back to resumes
      </Link>

      <Card className="border border-border/60 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-semibold tracking-tight md:text-3xl">
            New resume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResumeForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
