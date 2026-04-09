import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import DashboardShell from "./DashboardShell";
import { UsageWidget } from "./_components/usage-widget";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireApprovedUserWithPlan();

  return (
    <DashboardShell isAdmin={user.isAdmin} usageWidget={<UsageWidget />}>
      {children}
    </DashboardShell>
  );
}
