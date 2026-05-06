import { WeeklyApplicationPoint } from "@/lib/repositories/jobs";

type Props = {
  data: WeeklyApplicationPoint[];
};

function formatWeekLabel(isoDate: string): string {
  const date = new Date(isoDate + "T00:00:00"); // force local midnight
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WeeklyActivity({ data }: Props) {
  const maxCount = Math.max(...data.map((w) => w.count), 1);
  const totalThisWeek = data[data.length - 1]?.count ?? 0;
  const isAllZero = data.every((w) => w.count === 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Weekly applications
        </p>
        {isAllZero ? (
          <span className="text-xs text-muted-foreground">0 this week</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{totalThisWeek}</span>{" "}
            this week
          </span>
        )}
      </div>

      {isAllZero ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No applications logged yet
        </div>
      ) : (
        <div className="flex items-end gap-1.5 h-32">
          {data.map((week) => {
            const heightPct = (week.count / maxCount) * 100;
            const isCurrentWeek = week === data[data.length - 1];

            return (
              <div
                key={week.weekStart}
                className="group relative flex flex-1 flex-col items-center justify-end gap-1 h-full"
              >
                {week.count > 0 && (
                  <span className="absolute -top-5 text-[10px] font-medium tabular-nums text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {week.count}
                  </span>
                )}

                {/* Bar */}
                <div
                  className={`w-full rounded-t-sm transition-colors ${
                    isCurrentWeek
                      ? "bg-primary"
                      : week.count > 0
                        ? "bg-primary/40 group-hover:bg-primary/60"
                        : "bg-muted"
                  }`}
                  style={{
                    height: week.count === 0 ? "2px" : `${heightPct}%`,
                  }}
                  title={`${week.count} application${week.count === 1 ? "" : "s"}, w/c ${formatWeekLabel(week.weekStart)}`}
                />

                <span
                  className={`mt-1 text-[9px] leading-none text-muted-foreground/70 ${
                    data.indexOf(week) % 2 !== 0 ? "hidden sm:block" : ""
                  }`}
                >
                  {formatWeekLabel(week.weekStart)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
