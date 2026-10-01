import type { Metadata } from "next";
import Link from "next/link";
import { TimerOff } from "lucide-react";
import { EndDemoSession } from "./EndDemoSession";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "Demo ended",
  description: "Your private demo workspace has expired.",
};

export default function DemoEndedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-6">
      <EndDemoSession />

      <BrandLogo className="mb-10" />

      <section className="w-full max-w-md rounded-xl border border-border/60 bg-card p-8 shadow-xs">
        <div className="mb-5 flex size-10 items-center justify-center rounded-lg bg-muted">
          <TimerOff className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Your demo has ended
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Demo workspaces are private and are deleted after 2 hours, along with
          everything you changed. You can start a fresh one at any time, or sign
          up to keep your own data.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            Start a new demo
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            Sign up
          </Link>
        </div>
      </section>
    </main>
  );
}
