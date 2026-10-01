import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import { getCreditBalance } from "@/lib/usage";
import { describeCredits } from "@/lib/credits";

/**
 * Shows credits rather than dollars.
 *
 * Spend in dollars made people count pennies instead of seeing value, and it
 * exposed the cost basis. A raw credit count is not much better on its own, so
 * the balance is paired with what it actually buys.
 */
export async function UsageWidget() {
  const { user } = await requireApprovedUserWithPlan();
  const balance = await getCreditBalance(user._id.toString());

  if (balance.limit === 0) {
    // Approved users should always have both a subscription and a plan.
    return null;
  }

  const isUnlimited = balance.limit === -1;

  if (isUnlimited) {
    return (
      <div className="px-3 py-2 text-xs">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-muted-foreground">AI credits</span>
          <span className="font-medium text-foreground">No limit</span>
        </div>
        <p className="text-muted-foreground">{balance.used} used this billing month</p>
      </div>
    );
  }

  const { used, limit, remaining } = balance;
  const percentUsed = Math.min(100, (used / limit) * 100);
  const isOut = remaining <= 0;
  const isLow = !isOut && remaining <= limit * 0.15;

  return (
    <div className="px-3 py-2 text-xs">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-muted-foreground">AI credits</span>
        <span
          className={
            isOut
              ? "font-semibold text-destructive"
              : isLow
                ? "font-semibold text-foreground"
                : "font-medium text-foreground"
          }
        >
          {remaining} left
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percentUsed)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${remaining} of ${limit} AI credits remaining`}
      >
        <div
          className={
            isOut
              ? "h-full bg-destructive"
              : isLow
                ? "h-full bg-primary/60"
                : "h-full bg-primary"
          }
          style={{ width: `${percentUsed}%` }}
        />
      </div>

      <p className="mt-1 text-muted-foreground">{describeCredits(remaining)}</p>
      <p className="text-muted-foreground">
        Resets{" "}
        {balance.periodEndsAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          // Cycles turn over at 00:00 UTC; local time would show the day before.
          timeZone: "UTC",
        })}
      </p>
    </div>
  );
}
