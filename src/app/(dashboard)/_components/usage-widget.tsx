import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import { getCurrentUsage } from "@/lib/usage";
import * as subscriptions from "@/lib/repositories/subscriptions";
import { RequestAccessButton } from "./request-access-button";

export async function UsageWidget() {
  const { user } = await requireApprovedUserWithPlan();
  const usage = await getCurrentUsage(user._id.toString());

  if (usage.limit === 0) {
    // Approved users should always have both a subscription and a plan.
    return null;
  }

  const spent = usage.used;
  const isUnlimited = usage.limit === -1;
  const isLifetime = usage.budgetScope === "lifetime";
  const limitUSD = usage.limit;
  const remaining = isUnlimited ? Infinity : Math.max(0, limitUSD - spent);
  const percentUsed = isUnlimited ? 0 : Math.min(100, (spent / limitUSD) * 100);
  const isLow = !isUnlimited && remaining < 1.0 && remaining > 0;
  const isOut = !isUnlimited && remaining <= 0;

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  let alreadyRequested = false;
  if (isLifetime) {
    const subscription = await subscriptions.getByUserId(user._id.toString());
    alreadyRequested = Boolean(subscription?.upgradeRequestedAt);
  }

  return (
    <div className="px-3 py-2 text-xs">
      <div className="flex justify-between items-center mb-1">
        <span className="text-muted-foreground">AI spend</span>
        <span
          className={
            isOut
              ? "font-semibold text-destructive"
              : isLow
                ? "font-semibold text-foreground"
                : "font-medium"
          }
        >
          {isUnlimited ? `${fmt(spent)} (no cap)` : `${fmt(spent)} / ${fmt(limitUSD)}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
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
      )}
      <div className="text-muted-foreground mt-1">
        {isLifetime ? "one-time" : `Resets ${usage.periodEndsAt.toLocaleDateString()}`}
      </div>
      {isLifetime && (
        <RequestAccessButton
          emphasized={isOut || percentUsed >= 80}
          alreadyRequested={alreadyRequested}
        />
      )}
    </div>
  );
}
