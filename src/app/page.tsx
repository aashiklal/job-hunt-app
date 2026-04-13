import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Briefcase, FileText, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "JobHunt — Land your next role",
  description:
    "AI-powered job application tracker. Analyze job descriptions, generate cover letters, and track every application in one place.",
};

const features = [
  {
    icon: Briefcase,
    title: "Track everything",
    description:
      "Kanban pipeline and list view for every application — from wishlist to offer.",
  },
  {
    icon: FileText,
    title: "Tailored documents",
    description:
      "Generate a tailored resume and cover letter for each job using your base resume.",
  },
  {
    icon: Zap,
    title: "JD analysis",
    description:
      "Instant keyword and requirements analysis on any job description.",
  },
];

export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 md:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Briefcase className="size-5 text-foreground" strokeWidth={1.75} />
          <span className="text-base font-semibold tracking-tight text-foreground">
            JobHunt
          </span>
        </div>
        <nav className="flex items-center gap-3">
          {userId ? (
            <Link
              href="/jobs"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85"
            >
              Dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center md:px-6 md:py-28 lg:px-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          AI-powered job tracker
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl">
          Land your next role,{" "}
          <span className="text-muted-foreground">faster</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
          Track applications, analyze job descriptions, and generate tailored
          cover letters — all in one place.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {userId ? (
            <Link
              href="/jobs"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85"
            >
              Go to dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/sign-up"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85"
              >
                Get started free
              </Link>
              <Link
                href="/sign-in"
                className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-accent"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-5xl px-4 pb-24 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-border/60 bg-card p-6 shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] hover:shadow-sm"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-4 text-foreground" strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
