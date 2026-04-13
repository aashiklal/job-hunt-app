import { Skeleton } from "@/components/ui/skeleton";

export default function ResumeLoading() {
  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-border/60 shadow-xs">
        <div className="border-b border-border/60 px-4 py-3">
          <div className="grid grid-cols-4 gap-4">
            {["Title", "Default", "Updated", "Actions"].map((h) => (
              <Skeleton key={h} className="h-4 w-16" />
            ))}
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-4 gap-4 border-b border-border/40 px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-12 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
