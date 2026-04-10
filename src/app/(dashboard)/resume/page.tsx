import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as resumes from "@/lib/repositories/resumes";
import { toResumeListItem } from "@/lib/repositories/resumes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SetDefaultButton } from "./_components/set-default-button";
import { DeleteResumeButton } from "./_components/delete-resume-button";

export const metadata: Metadata = {
  title: "Resumes — Job Hunt",
  description: "Manage your base resumes for AI tailoring.",
};

export default async function ResumePage() {
  const { user, plan } = await requireApprovedUserWithPlan();
  const userId = user._id.toString();
  const rawResumes = await resumes.list(userId);
  const resumeList = rawResumes.map(toResumeListItem);

  const count = resumeList.length;
  const maxResumes = plan.maxResumes;
  const atLimit = maxResumes !== -1 && count >= maxResumes;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Resumes</h1>
        {!atLimit && (
          <Button asChild>
            <Link href="/resume/new">New resume</Link>
          </Button>
        )}
      </div>

      {atLimit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Resume limit reached ({count} of {maxResumes})</p>
          <p className="mt-0.5 text-amber-700">
            Delete an existing resume to add a new one.
          </p>
        </div>
      )}

      {resumeList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-base font-semibold text-gray-900">No resumes yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Save your base resume here. JobHunt will use it when tailoring
              your resume for specific job applications.
            </p>
            <Button asChild className="mt-1">
              <Link href="/resume/new">New resume</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resumeList.map((resume) => (
              <TableRow key={resume._id}>
                <TableCell>
                  <Link
                    href={`/resume/${resume._id}`}
                    className="font-medium hover:underline"
                  >
                    {resume.title}
                  </Link>
                </TableCell>
                <TableCell>
                  {resume.isDefault ? (
                    <Badge variant="secondary">Default</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(resume.updatedAt), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/resume/${resume._id}`}>Edit</Link>
                    </Button>
                    {!resume.isDefault && (
                      <SetDefaultButton resumeId={resume._id} />
                    )}
                    <DeleteResumeButton
                      resumeId={resume._id}
                      resumeTitle={resume.title}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!atLimit && maxResumes !== -1 && (
        <p className="text-sm text-muted-foreground">
          Resumes used: {count} of {maxResumes}
        </p>
      )}

    </div>
  );
}
