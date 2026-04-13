import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Briefcase, Clock } from "lucide-react";
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
    <main className="min-h-screen bg-background">
      <div className="absolute right-4 top-4">
        <UserButton />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-6">
        {/* Brand */}
        <div className="mb-10 flex items-center gap-2">
          <Briefcase className="size-5 text-foreground" strokeWidth={1.75} />
          <span className="text-base font-semibold tracking-tight text-foreground">
            JobHunt
          </span>
        </div>

        <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-8 shadow-xs">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Clock className="size-5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Awaiting approval
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your account has been created but hasn&apos;t been approved yet. An
            admin will review your request and grant access shortly. Check back
            later or sign out and return once you&apos;ve been notified.
          </p>
        </div>
      </div>
    </main>
  );
}
