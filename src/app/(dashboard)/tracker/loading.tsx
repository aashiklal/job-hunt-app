import { Skeleton } from "@/components/ui/skeleton";

// Deterministic bar heights (avoids SSR/client hydration mismatch from Math.random())
const BAR_HEIGHTS = [35, 60, 45, 75, 30, 85, 50, 65];

function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <Skeleton className="mb-3 h-4 w-28" />
      <Skeleton className="mb-2 h-8 w-16" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

export default function TrackerLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-24" />

      {/* Funnel skeleton */}
      <div className="rounded-xl border bg-card p-5">
        <Skeleton className="mb-4 h-4 w-36" />
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex shrink-0 items-center gap-1">
              <Skeleton className="h-[60px] w-[80px] rounded-lg" />
              {i < 5 && <Skeleton className="h-3 w-5 rounded-sm" />}
            </div>
          ))}
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Two-column grid skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weekly activity */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex items-end gap-1.5" style={{ height: "8rem" }}>
            {BAR_HEIGHTS.map((h, i) => (
              <div
                key={i}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                style={{ height: "100%" }}
              >
                <Skeleton
                  className="w-full rounded-t-sm"
                  style={{ height: `${h}%` }}
                />
                <Skeleton className="h-2 w-full rounded-sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Weekly goal */}
        <div className="rounded-xl border bg-card p-5">
          <Skeleton className="mb-1 h-4 w-24" />
          <Skeleton className="mb-4 h-3 w-32" />
          <div className="flex items-center gap-6">
            <Skeleton className="h-[88px] w-[88px] shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
