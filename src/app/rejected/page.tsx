import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth-helpers";

export const metadata = {
  title: "Access Not Approved | Job Hunt",
  description: "Your account access request was not approved.",
};

export default async function RejectedPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getCurrentUser();
  if (!user || user.status === "approved") redirect("/jobs");
  if (user.status === "pending") redirect("/pending");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <UserButton />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Access not approved</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-sm leading-relaxed">
            Your request for access wasn&apos;t approved. If you believe this is
            a mistake, please contact the administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
