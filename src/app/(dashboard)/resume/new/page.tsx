import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/resume"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to resumes
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New resume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResumeForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
