import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import { getCurrentUsage } from "@/lib/usage";

export async function UsageWidget() {
  const { user } = await requireApprovedUserWithPlan();
  const usage = await getCurrentUsage(user._id.toString());

  if (usage.limit === 0) {
    // No subscription or no plan — should never happen for an approved user
    return null;
  }

  const used = usage.used;
  const limit = usage.limit;
  const remaining = Math.max(0, limit - used);
  const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const isLow = remaining <= 5;
  const isOut = remaining === 0;

  return (
    <div className="px-3 py-2 text-xs">
      <div className="flex justify-between items-center mb-1">
        <span className="text-muted-foreground">AI generations</span>
        <span
          className={
            isOut
              ? "font-semibold text-destructive"
              : isLow
                ? "font-semibold text-yellow-600"
                : "font-medium"
          }
        >
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={
            isOut
              ? "h-full bg-destructive"
              : isLow
                ? "h-full bg-yellow-500"
                : "h-full bg-primary"
          }
          style={{ width: `${Math.min(100, percentUsed)}%` }}
        />
      </div>
      <div className="text-muted-foreground mt-1">
        Resets {usage.periodEndsAt.toLocaleDateString()}
      </div>
    </div>
  );
}
