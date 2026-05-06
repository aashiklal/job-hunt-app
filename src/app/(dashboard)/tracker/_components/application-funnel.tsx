import { JobStatus } from "@/lib/repositories/jobs";

type Props = {
  funnelCounts: Record<JobStatus, number>;
};

// Ordered pipeline stages (left to right)
const PIPELINE: { status: JobStatus; label: string }[] = [
  { status: "saved", label: "Saved" },
  { status: "applied", label: "Applied" },
  { status: "screening", label: "Screening" },
  { status: "interview", label: "Interview" },
  { status: "assessment", label: "Assessment" },
  { status: "offer", label: "Offer" },
];

function dropOffRate(from: number, to: number): string | null {
  if (from === 0) return null;
  const rate = Math.round(((from - to) / from) * 100);
  return `−${rate}%`;
}

export function ApplicationFunnel({ funnelCounts }: Props) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="mb-4 text-sm font-medium text-muted-foreground">
        Application funnel
      </p>

      <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
        {PIPELINE.map(({ status, label }, i) => {
          const count = funnelCounts[status];
          const prevCount =
            i > 0 ? funnelCounts[PIPELINE[i - 1].status] : null;
          const dropOff =
            prevCount !== null ? dropOffRate(prevCount, count) : null;
          const isActive = count > 0;

          return (
            <div key={status} className="flex shrink-0 items-stretch">
              {/* Arrow connector + drop-off label */}
              {i > 0 && (
                <div className="flex flex-col items-center justify-center px-1">
                  <span className="mb-0.5 text-[10px] leading-none text-muted-foreground/60">
                    {dropOff ?? ""}
                  </span>
                  <svg
                    width="20"
                    height="12"
                    viewBox="0 0 20 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M0 6h16M12 1l6 5-6 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-border"
                    />
                  </svg>
                </div>
              )}

              {/* Stage pill */}
              <div
                className={`flex flex-col items-center justify-center rounded-lg px-4 py-3 text-center transition-colors ${
                  isActive
                    ? "bg-primary/10 ring-1 ring-primary/20"
                    : "bg-muted/40"
                }`}
              >
                <span
                  className={`text-xl font-semibold tabular-nums leading-none ${
                    isActive ? "text-foreground" : "text-muted-foreground/50"
                  }`}
                >
                  {count}
                </span>
                <span
                  className={`mt-1 text-xs leading-none ${
                    isActive ? "text-muted-foreground" : "text-muted-foreground/40"
                  }`}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rejected / Withdrawn footnote */}
      {(funnelCounts.rejected > 0 || funnelCounts.withdrawn > 0) && (
        <div className="mt-3 flex gap-4 border-t pt-3">
          {funnelCounts.rejected > 0 && (
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {funnelCounts.rejected}
              </span>{" "}
              rejected
            </span>
          )}
          {funnelCounts.withdrawn > 0 && (
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {funnelCounts.withdrawn}
              </span>{" "}
              withdrawn
            </span>
          )}
        </div>
      )}
    </div>
  );
}
