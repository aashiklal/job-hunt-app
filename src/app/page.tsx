import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Briefcase, FileText, Zap, Plus, Upload, Sparkles } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { LandingLogo, ScrollToTopButton } from "./ScrollToTop";
import * as users from "@/lib/repositories/users";
import * as jobs from "@/lib/repositories/jobs";
import * as documents from "@/lib/repositories/documents";

export const metadata: Metadata = {
  title: "JobHunt: Land your next role",
  description:
    "AI-powered job application tracker. Analyze job descriptions, generate cover letters, and track every application in one place.",
};

const features = [
  {
    icon: Briefcase,
    title: "Track everything",
    description:
      "Kanban pipeline and list view for every application, from wishlist to offer.",
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

const steps = [
  {
    number: "01",
    icon: Plus,
    title: "Add your jobs",
    description:
      "Paste any job posting and let AI extract the company, role, and key details for you automatically.",
  },
  {
    number: "02",
    icon: Upload,
    title: "Upload your resume",
    description:
      "Upload a base resume as a PDF or DOCX. It becomes the foundation for every tailored document you generate.",
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Generate and track",
    description:
      "Get a tailored cover letter, resume, and full JD analysis in seconds, then track every stage in your pipeline.",
  },
];

function formatStat(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k+";
  }
  return n > 0 ? `${n}+` : "0";
}

export default async function LandingPage() {
  const { userId } = await auth();

  const [userCount, jobCount, docCount] = await Promise.all([
    users.countApproved(),
    jobs.countAll(),
    documents.countAll(),
  ]);

  const stats = [
    { value: formatStat(userCount), label: "job seekers" },
    { value: formatStat(jobCount), label: "applications tracked" },
    { value: formatStat(docCount), label: "documents generated" },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 lg:px-12">
          <LandingLogo />
          <nav className="flex items-center gap-2">
            <ThemeToggle />
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
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          AI-powered job tracker
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl">
          Land your next role,{" "}
          <span className="text-muted-foreground">faster</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
          Track applications, analyze job descriptions, and generate tailored
          cover letters in one place.
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

      {/* Live stats strip */}
      <div className="border-y border-border/40 bg-muted/30">
        <div className="mx-auto grid max-w-4xl grid-cols-1 divide-y divide-border/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {stats.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center px-8 py-8">
              <span className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {value}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            From job posting to application in minutes
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map(({ number, icon: Icon, title, description }) => (
            <div key={number} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold tracking-tighter text-border md:text-5xl">
                  {number}
                </span>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4 text-foreground" strokeWidth={1.75} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How access works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            How access works
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Start free, upgrade when you are ready
          </h2>
        </div>
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h3 className="text-sm font-semibold text-foreground">Free</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              $0.50 of AI credit, enough for one complete workflow. No expiry.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <h3 className="text-sm font-semibold text-foreground">Full access</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              A monthly AI budget, granted on request.
            </p>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Features
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Everything you need to stay organised
          </h2>
        </div>
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

      {/* Bottom CTA */}
      {!userId && (
        <section className="border-t border-border/40 bg-muted/30 py-20">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Ready to take control of your job search?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground md:text-base">
              Join job seekers who track every application, generate tailored
              documents, and move faster through the hiring process.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
            </div>
          </div>
        </section>
      )}

      <ScrollToTopButton />

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-muted-foreground" strokeWidth={1.75} />
            <span className="text-sm font-medium text-muted-foreground">JobHunt</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} JobHunt. All rights reserved.
          </p>
          {!userId && (
            <nav className="flex items-center gap-4">
              <Link
                href="/sign-in"
                className="text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                Get started
              </Link>
            </nav>
          )}
        </div>
      </footer>
    </main>
  );
}
