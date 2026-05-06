type Props = {
  responseRate: number | null;
  totalActive: number;
  appliedThisMonth: number;
};

type StatCardProps = {
  label: string;
  value: string;
  sub: string;
};

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums leading-none text-foreground">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export function StatCards({ responseRate, totalActive, appliedThisMonth }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatCard
        label="Response rate"
        value={responseRate !== null ? `${responseRate}%` : "-"}
        sub={
          responseRate !== null
            ? "of applications moved past Applied"
            : "No applications yet"
        }
      />
      <StatCard
        label="Active pipeline"
        value={String(totalActive)}
        sub="jobs in Applied → Offer"
      />
      <StatCard
        label="Applied this month"
        value={String(appliedThisMonth)}
        sub={
          appliedThisMonth === 1
            ? "application logged this month"
            : "applications logged this month"
        }
      />
    </div>
  );
}
