import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { JobListItem } from "@/lib/repositories/jobs";
import { StatusBadge } from "./status-badge";

type Props = {
  jobs: JobListItem[];
};

export function JobsListView({ jobs }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job._id}>
            <TableCell>
              <Link href={`/jobs/${job._id}`} className="hover:underline">
                {job.company}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/jobs/${job._id}`} className="hover:underline">
                {job.role}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/jobs/${job._id}`} className="block">
                {job.location ?? "—"}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/jobs/${job._id}`} className="block">
                <StatusBadge status={job.status} />
              </Link>
            </TableCell>
            <TableCell className="text-gray-500">
              <Link href={`/jobs/${job._id}`} className="block">
                {formatDistanceToNow(new Date(job.updatedAt), {
                  addSuffix: true,
                })}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
