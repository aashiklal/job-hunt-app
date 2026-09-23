import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import DashboardShell from "./DashboardShell";
import { UsageWidget } from "./_components/usage-widget";
import { DemoBanner } from "./_components/demo-banner";
import { isDemoUser } from "@/lib/demo";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireApprovedUserWithPlan();

  return (
    <DashboardShell
      isAdmin={user.isAdmin}
      usageWidget={<UsageWidget />}
      demoBanner={isDemoUser(user) ? <DemoBanner /> : null}
    >
      {children}
    </DashboardShell>
  );
}
