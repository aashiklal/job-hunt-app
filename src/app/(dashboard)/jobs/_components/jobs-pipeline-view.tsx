"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { JobListItem, JobStatus } from "@/lib/repositories/jobs";

const COLUMNS: ReadonlyArray<{ status: JobStatus; label: string }> = [
  { status: "saved", label: "Saved" },
  { status: "applied", label: "Applied" },
  { status: "screening", label: "Screening" },
  { status: "interview", label: "Interview" },
  { status: "assessment", label: "Assessment" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
  { status: "withdrawn", label: "Withdrawn" },
];

type Props = {
  jobs: JobListItem[];
};

export function JobsPipelineView({ jobs }: Props) {
  const grouped = new Map<JobStatus, JobListItem[]>();
  for (const col of COLUMNS) grouped.set(col.status, []);
  for (const job of jobs) {
    const list = grouped.get(job.status);
    if (list) list.push(job);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {COLUMNS.map((col) => {
          const colJobs = grouped.get(col.status) ?? [];
          return (
            <div key={col.status} className="w-72 flex flex-col gap-2">
              {/* Column header */}
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-semibold">{col.label}</span>
                <Badge variant="secondary" className="text-xs">
                  {colJobs.length}
                </Badge>
              </div>

              {/* Column body */}
              <div className="flex flex-col gap-2 min-h-24">
                {colJobs.length === 0 ? (
                  <div className="rounded-md border border-dashed flex items-center justify-center min-h-24">
                    <p className="text-xs text-muted-foreground">No jobs</p>
                  </div>
                ) : (
                  colJobs.map((job) => (
                    <Link key={job._id} href={`/jobs/${job._id}`}>
                      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardContent className="p-3 space-y-1">
                          <p className="font-semibold text-sm leading-tight">
                            {job.company}
                          </p>
                          <p className="text-sm text-muted-foreground leading-tight">
                            {job.role}
                          </p>
                          {job.location && (
                            <p className="text-xs text-muted-foreground">
                              {job.location}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground pt-1">
                            {formatDistanceToNow(new Date(job.updatedAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
