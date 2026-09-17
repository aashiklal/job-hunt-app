import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import { getOnboardingProgress } from "@/lib/onboarding";
import DashboardShell from "./DashboardShell";
import { UsageWidget } from "./_components/usage-widget";
import { NextStepPill } from "./_components/next-step-pill";
import { TourController } from "./_components/tour-controller";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireApprovedUserWithPlan();

  // Only computed for users who haven't finished or dismissed the tour, so
  // steady-state page loads skip these extra reads entirely.
  const progress = user.onboardingDismissedAt
    ? null
    : await getOnboardingProgress(user._id.toString());
  const activeProgress = progress && !progress.complete ? progress : null;

  return (
    <DashboardShell
      isAdmin={user.isAdmin}
      usageWidget={<UsageWidget />}
      nextStepPill={
        activeProgress ? <NextStepPill step={activeProgress.currentStep} /> : undefined
      }
    >
      {activeProgress && <TourController progress={activeProgress} />}
      {children}
    </DashboardShell>
  );
}
