import type { Metadata } from "next";
import Link from "next/link";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import * as jobs from "@/lib/repositories/jobs";
import { ApplicationFunnel } from "./_components/application-funnel";
import { StatCards } from "./_components/stat-cards";
import { StaleApplications } from "./_components/stale-applications";
import { WeeklyActivity } from "./_components/weekly-activity";
import { WeeklyGoal } from "./_components/weekly-goal";

export const metadata: Metadata = {
  title: "Tracker — Job Hunt",
  description: "Analytics and insights for your job search.",
};

export default async function TrackerPage() {
  const { user } = await requireApprovedUserWithPlan();
  const userId = user._id.toString();

  const [stats, staleJobs, weeklyData] = await Promise.all([
    jobs.getTrackerStats(userId),
    jobs.getStaleJobs(userId),
    jobs.getWeeklyApplications(userId, 8),
  ]);

  const totalActive =
    stats.funnelCounts.applied +
    stats.funnelCounts.screening +
    stats.funnelCounts.interview +
    stats.funnelCounts.assessment +
    stats.funnelCounts.offer;

  const appliedThisMonth = weeklyData
    .filter((w) => {
      const weekDate = new Date(w.weekStart);
      const now = new Date();
      return (
        weekDate.getMonth() === now.getMonth() &&
        weekDate.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, w) => sum + w.count, 0);

  const hasAnyJobs = Object.values(stats.funnelCounts).some((n) => n > 0);

  if (!hasAnyJobs) {
    return (
      <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Tracker
        </h1>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <p className="text-base font-semibold text-foreground">
            Nothing to track yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add some jobs and start applying — your stats will appear here.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/jobs/new">Add your first job</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10 md:space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Tracker
      </h1>

      {/* Funnel — full width */}
      <ApplicationFunnel funnelCounts={stats.funnelCounts} />

      {/* Stat cards — 3-up on md+, stacked on mobile */}
      <StatCards
        responseRate={stats.responseRate}
        totalActive={totalActive}
        appliedThisMonth={appliedThisMonth}
      />

      {/* Two-column grid on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WeeklyActivity data={weeklyData} />
        <WeeklyGoal weeklyData={weeklyData} />
      </div>

      {/* Stale applications — full width, only shown when there are some */}
      {staleJobs.length > 0 && <StaleApplications jobs={staleJobs} />}
    </div>
  );
}
