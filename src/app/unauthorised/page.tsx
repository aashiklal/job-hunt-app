import type { Metadata } from "next";
import { ShieldOff, Briefcase } from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";

export const metadata: Metadata = {
  title: "Access Denied: Job Hunt",
  description: "You are not authorised to access this application.",
};

export default function UnauthorisedPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-6">
        {/* Brand */}
        <div className="mb-10 flex items-center gap-2">
          <Briefcase className="size-5 text-foreground" strokeWidth={1.75} />
          <span className="text-base font-semibold tracking-tight text-foreground">
            JobHunt
          </span>
        </div>

        <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-8 shadow-xs text-center">
          <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <ShieldOff className="size-5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Access denied
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This app is private. If you believe this is an error, contact the
            owner.
          </p>
          <div className="mt-6">
            <SignOutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
