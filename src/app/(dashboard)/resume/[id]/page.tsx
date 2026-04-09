import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/resume"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to resumes
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit resume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResumeForm mode="edit" initialValues={initialValues} resumeId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
