import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, FileText, Zap, Plus, Upload, Sparkles } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { LandingLogo, ScrollToTopButton } from "./ScrollToTop";
import * as users from "@/lib/repositories/users";
import * as jobs from "@/lib/repositories/jobs";
import * as documents from "@/lib/repositories/documents";
import { DemoSignInButton } from "./DemoSignInButton";
import { DemoExitButton } from "@/components/DemoExitButton";
import { BrandLogo } from "@/components/BrandLogo";
import { isDemoExpired, isDemoUser } from "@/lib/demo";
import { turnstileSiteKey } from "@/lib/turnstile";
import { isDemoDisabled } from "@/lib/demo-constants";

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

/**
 * Link to Clerk sign-in or sign-up. For a live demo session it warns, then ends
 * the demo first, because Clerk sends an already-signed-in visitor straight to
 * the dashboard.
 */
function AuthLink({
  demo,
  href,
  className,
  children,
}: {
  demo: boolean;
  href: "/sign-in" | "/sign-up";
  className: string;
  children: React.ReactNode;
}) {
  if (demo) {
    return (
      <DemoExitButton
        redirectUrl={href}
        intent={href === "/sign-up" ? "sign-up" : "sign-in"}
        className={className}
      >
        {children}
      </DemoExitButton>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function formatStat(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k+";
  }
  return n > 0 ? `${n}+` : "0";
}

export default async function LandingPage() {
  const { userId } = await auth();

  const [demoIds, currentUser] = await Promise.all([
    users.listDemoIds(),
    userId ? users.getByClerkId(userId) : Promise.resolve(null),
  ]);

  // Demo accounts carry a full set of sample data each, so they are kept out
  // of the public numbers.
  const [userCount, jobCount, docCount] = await Promise.all([
    users.countApproved(),
    jobs.countAll(demoIds),
    documents.countAll(demoIds),
  ]);

  // A demo that has run out still holds a Clerk session. /demo-ended ends it,
  // after which this page renders as signed out.
  if (isDemoExpired(currentUser)) redirect("/demo-ended");

  // Offer the demo only when it can actually start: not switched off, and a
  // Turnstile site key is configured. Otherwise the panel is omitted rather
  // than handing the visitor a button that fails.
  const siteKey = turnstileSiteKey();
  const demoAvailable =
    !isDemoDisabled() && siteKey !== null;

  // A demo visitor who comes back here sees the signed-out page (demo entry
  // point and sign-up). The session stays live until they pick an action:
  // AuthLink warns and ends the demo before sign-in/sign-up, and the demo button goes
  // straight back in. Signing out on page load instead races the demo button,
  // whose sign-in re-renders this page before it navigates to /jobs.
  const isDemoSession = userId !== null && isDemoUser(currentUser);
  // A session with no user record is treated as signed out. The session token
  // outlives a deleted account by up to a minute, so right after a demo ends
  // the visitor would otherwise be offered a "Dashboard" they cannot enter
  // instead of the demo panel.
  const signedIn = userId !== null && currentUser !== null && !isDemoSession;

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
            {signedIn ? (
              <Link
                href="/jobs"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85"
              >
                Dashboard →
              </Link>
            ) : (
              <>
                <AuthLink
                  demo={isDemoSession}
                  href="/sign-in"
                  className="text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground"
                >
                  Sign in
                </AuthLink>
                <AuthLink
                  demo={isDemoSession}
                  href="/sign-up"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85"
                >
                  Get started
                </AuthLink>
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
          {signedIn ? (
            <Link
              href="/jobs"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85"
            >
              Go to dashboard →
            </Link>
          ) : (
            <>
              <AuthLink
                demo={isDemoSession}
                href="/sign-up"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85"
              >
                Get started free
              </AuthLink>
              <AuthLink
                demo={isDemoSession}
                href="/sign-in"
                className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-accent"
              >
                Sign in
              </AuthLink>
            </>
          )}
        </div>

        {!signedIn && (demoAvailable || isDemoSession) && (
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-muted/40 p-6">
            {isDemoSession ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  Your demo is still running
                </p>
                <p className="text-sm text-muted-foreground">
                  Pick up where you left off. It stays private to you and is
                  deleted 2 hours after you started it.
                </p>
                <DemoSignInButton alreadySignedIn turnstileSiteKey={siteKey ?? ""} />
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Just looking around?
                </p>
                <p className="text-sm text-muted-foreground">
                  Open your own fully populated workspace in one click. No
                  sign-up, no password. It is private to you and deleted after
                  2 hours.
                </p>
                {siteKey && <DemoSignInButton turnstileSiteKey={siteKey} />}
              </>
            )}
          </div>
        )}
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
      {!signedIn && (
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
              <AuthLink
                demo={isDemoSession}
                href="/sign-up"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85"
              >
                Get started free
              </AuthLink>
              <AuthLink
                demo={isDemoSession}
                href="/sign-in"
                className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-accent"
              >
                Sign in
              </AuthLink>
            </div>
          </div>
        </section>
      )}

      <ScrollToTopButton />

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <BrandLogo variant="muted" />
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} JobHunt. All rights reserved.
          </p>
          {!signedIn && (
            <nav className="flex items-center gap-4">
              <AuthLink
                demo={isDemoSession}
                href="/sign-in"
                className="text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                Sign in
              </AuthLink>
              <AuthLink
                demo={isDemoSession}
                href="/sign-up"
                className="text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                Get started
              </AuthLink>
            </nav>
          )}
        </div>
      </footer>
    </main>
  );
}
