import { WeeklyApplicationPoint } from "@/lib/repositories/jobs";

type Props = {
  weeklyData: WeeklyApplicationPoint[];
};

// TODO: make this user-configurable via a settings field (e.g. user.weeklyGoal)
// and pass it in from the page once the settings UI is built.
const DEFAULT_WEEKLY_GOAL = 5;

export function WeeklyGoal({ weeklyData }: Props) {
  const goal = DEFAULT_WEEKLY_GOAL;
  const applied = weeklyData[weeklyData.length - 1]?.count ?? 0;
  const pct = Math.min(applied / goal, 1); // cap at 100%
  const achieved = applied >= goal;

  // Circular SVG progress ring
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct);

  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">Weekly goal</p>
      <p className="mt-0.5 text-xs text-muted-foreground/70">
        Resets every Monday
      </p>

      <div className="mt-4 flex items-center gap-6">
        {/* Circular progress ring */}
        <div className="relative shrink-0 size-22">
          <svg
            width="88"
            height="88"
            viewBox="0 0 88 88"
            fill="none"
            aria-hidden="true"
          >
            {/* Track */}
            <circle
              cx="44"
              cy="44"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/60"
            />
            {/* Progress arc */}
            <circle
              cx="44"
              cy="44"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 44 44)"
              className={achieved ? "text-primary" : "text-primary"}
              style={{ transition: "stroke-dashoffset 0.4s ease" }}
            />
          </svg>
          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tabular-nums leading-none text-foreground">
              {applied}
            </span>
            <span className="text-[10px] leading-none text-muted-foreground">
              of {goal}
            </span>
          </div>
        </div>

        {/* Text summary */}
        <div className="min-w-0">
          {achieved ? (
            <>
              <p className="text-sm font-semibold text-foreground">
                Goal reached!
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {applied === goal
                  ? `You hit your target of ${goal} this week.`
                  : `${applied} applied, ${applied - goal} ahead of target.`}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">
                {applied === 0
                  ? "Nothing applied yet"
                  : `${goal - applied} to go`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Applied to{" "}
                <span className="font-medium text-foreground">{applied}</span>{" "}
                of{" "}
                <span className="font-medium text-foreground">{goal}</span>{" "}
                jobs this week.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
