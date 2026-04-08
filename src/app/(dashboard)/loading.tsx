import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Skeleton className="w-full max-w-md h-48 rounded-xl" />
    </div>
  );
}
