import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/repositories/jobs";

export function StatusBadge({ status }: { status: JobStatus }) {
  if (status === "offer") {
    return (
      <Badge className="bg-green-600 hover:bg-green-700">{status}</Badge>
    );
  }
  if (status === "rejected" || status === "withdrawn") {
    return <Badge variant="destructive">{status}</Badge>;
  }
  if (status === "saved") {
    return <Badge variant="secondary">{status}</Badge>;
  }
  // applied, screening, interview, assessment
  return <Badge>{status}</Badge>;
}
