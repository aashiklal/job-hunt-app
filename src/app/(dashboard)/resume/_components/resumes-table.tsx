"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SetDefaultButton } from "./set-default-button";
import { DeleteResumeButton } from "./delete-resume-button";
import type { ResumeListItem } from "@/lib/repositories/resumes";

type Props = {
  resumes: ResumeListItem[];
};

export function ResumesTable({ resumes }: Props) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 shadow-xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Default</TableHead>
            <TableHead className="hidden md:table-cell">Updated</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resumes.map((resume) => (
            <TableRow
              key={resume._id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => router.push(`/resume/${resume._id}`)}
            >
              <TableCell className="font-medium text-foreground">
                <div className="max-w-[280px] truncate">{resume.title}</div>
              </TableCell>
              <TableCell>
                {resume.isDefault ? (
                  <Badge variant="secondary">Default</Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {formatDistanceToNow(new Date(resume.updatedAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/resume/${resume._id}`)}>
                    Edit
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
    </div>
  );
}
