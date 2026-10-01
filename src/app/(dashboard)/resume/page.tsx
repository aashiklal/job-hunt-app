import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as resumes from "@/lib/repositories/resumes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResumesTable } from "./_components/resumes-table";

export const metadata: Metadata = {
  title: "Resumes",
  description: "Manage your base resumes for AI tailoring.",
};

export default async function ResumePage() {
  const { user, plan } = await requireApprovedUserWithPlan();
  const userId = user._id.toString();
  const resumeList = await resumes.list(userId);

  const count = resumeList.length;
  const maxResumes = plan.maxResumes;
  const atLimit = maxResumes !== -1 && count >= maxResumes;

  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10 md:space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Resumes
        </h1>
        {!atLimit && (
          <Button asChild>
            <Link href="/resume/new">New resume</Link>
          </Button>
        )}
      </div>

      {atLimit && (
        <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/50 px-4 py-3">
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              Resume limit reached ({count} of {maxResumes})
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Delete an existing resume to add a new one.
            </p>
          </div>
        </div>
      )}

      {resumeList.length === 0 ? (
        <Card className="border border-border/60 shadow-xs">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-base font-semibold text-foreground">
              No resumes yet
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Save your base resume here. Offerstitch will use it when tailoring
              your resume for specific job applications.
            </p>
            <Button asChild className="mt-1">
              <Link href="/resume/new">New resume</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ResumesTable resumes={resumeList} />
      )}

      {!atLimit && maxResumes !== -1 && (
        <p className="text-sm text-muted-foreground">
          Resumes used: {count} of {maxResumes}
        </p>
      )}
    </div>
  );
}
