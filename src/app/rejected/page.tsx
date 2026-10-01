import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-helpers";
import { RequestAccessButton } from "./_components/RequestAccessButton";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata = {
  title: "Access not approved",
  description: "Your account access request was not approved.",
};

export default async function RejectedPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getCurrentUser();
  if (!user || user.status === "approved") redirect("/jobs");
  if (user.status === "pending") redirect("/pending");

  return (
    <main className="min-h-screen bg-background">
      <div className="absolute right-4 top-4">
        <UserButton />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-6">
        {/* Brand */}
        <BrandLogo className="mb-10" />

        <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-8 shadow-xs">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <XCircle className="size-5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Access not approved
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your request for access wasn&apos;t approved. If you believe this is
            a mistake, you can submit a new request below.
          </p>
          <RequestAccessButton />
        </div>
      </div>
    </main>
  );
}
