type StatsBarProps = {
  counts: { pending: number; approved: number; rejected: number };
  totalSpendUSD: number;
  activeUserCount: number;
  newSignupsCount: number;
};

export function StatsBar({
  counts,
  totalSpendUSD,
  activeUserCount,
  newSignupsCount,
}: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-2xl font-semibold">{counts.approved}</p>
        <p className="text-sm text-muted-foreground">approved users</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <p
          className={
            counts.pending > 0
              ? "text-2xl font-semibold text-destructive"
              : "text-2xl font-semibold"
          }
        >
          {counts.pending}
        </p>
        <p className="text-sm text-muted-foreground">pending requests</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-2xl font-semibold">
          ${totalSpendUSD.toFixed(2)}
        </p>
        <p className="text-sm text-muted-foreground">AI spend this month</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-2xl font-semibold">{activeUserCount}</p>
        <p className="text-sm text-muted-foreground">active this month</p>
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-lg font-medium">{newSignupsCount}</p>
          <p className="text-sm text-muted-foreground">new this week</p>
        </div>
      </div>
    </div>
  );
}
