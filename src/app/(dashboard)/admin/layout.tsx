import { requireAdminWithPlan } from "@/lib/auth-helpers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminWithPlan();
  return <>{children}</>;
}
