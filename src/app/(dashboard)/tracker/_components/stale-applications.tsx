import Link from "next/link";
import { StaleJob } from "@/lib/repositories/jobs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  jobs: StaleJob[];
};

export function StaleApplications({ jobs }: Props) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Stale applications
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            No status update in 14+ days — worth a follow-up?
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {jobs.length} stuck
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Company</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right pr-5">Days stale</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job._id}>
              <TableCell className="pl-5 font-medium">
                <Link
                  href={`/jobs/${job._id}`}
                  className="hover:underline"
                >
                  {job.company}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {job.role}
              </TableCell>
              <TableCell className="pr-5 text-right">
                <span
                  className={`tabular-nums font-medium ${
                    job.daysSinceUpdate >= 30
                      ? "text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {job.daysSinceUpdate}d
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
