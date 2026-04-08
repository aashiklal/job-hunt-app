import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireApprovedUserWithPlan();

  return <DashboardShell isAdmin={user.isAdmin}>{children}</DashboardShell>;
}
