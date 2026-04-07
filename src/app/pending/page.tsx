import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth-helpers";

export const metadata = {
  title: "Awaiting Approval | Job Hunt",
  description: "Your account is pending admin approval.",
};

export default async function PendingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getCurrentUser();
  if (user?.status === "approved") redirect("/jobs");
  if (user?.status === "rejected") redirect("/rejected");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <UserButton />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Awaiting approval</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-sm leading-relaxed">
            Your account has been created but hasn&apos;t been approved yet. An
            admin will review your request and grant access shortly. Check back
            later or sign out and return once you&apos;ve been notified.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
