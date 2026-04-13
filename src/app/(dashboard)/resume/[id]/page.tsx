import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as resumes from "@/lib/repositories/resumes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumeForm } from "../_components/resume-form";

export const metadata: Metadata = {
  title: "Edit Resume — Job Hunt",
  description: "Edit your base resume.",
};

export default async function EditResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireApprovedUserWithPlan();
  const resume = await resumes.getById(user._id.toString(), id);

  if (!resume) {
    notFound();
  }

  const initialValues = {
    title: resume.title,
    content: resume.content,
  };

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
            Edit resume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResumeForm mode="edit" initialValues={initialValues} resumeId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
