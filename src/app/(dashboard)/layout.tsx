import { requireApprovedUser } from "@/lib/auth-helpers";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await requireApprovedUser(); // used in Step C (admin sidebar link)

  return <DashboardShell>{children}</DashboardShell>;
}
