import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
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

  const primaryButton =
    "rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:px-6 sm:py-3";
  const secondaryButton =
    "rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:px-6 sm:py-3";

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3 sm:px-8 sm:py-4 lg:px-12">
          <BrandLogo />
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Link href="/jobs" className={primaryButton}>
                Dashboard
              </Link>
            ) : (
              <>
                <AuthLink
                  demo={isDemoSession}
                  href="/sign-in"
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                >
                  Sign in
                </AuthLink>
                <AuthLink demo={isDemoSession} href="/sign-up" className={primaryButton}>
                  Get started
                </AuthLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center sm:px-6 lg:px-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          AI-powered job tracker
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
          Land your next role,{" "}
          <span className="text-muted-foreground">faster</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base md:text-lg">
          Track applications, analyze job descriptions, and generate tailored
          cover letters in one place.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-8">
          {signedIn ? (
            <Link href="/jobs" className={primaryButton}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <AuthLink demo={isDemoSession} href="/sign-up" className={primaryButton}>
                Get started free
              </AuthLink>
              <AuthLink demo={isDemoSession} href="/sign-in" className={secondaryButton}>
                Sign in
              </AuthLink>
            </>
          )}
        </div>

        {!signedIn && (demoAvailable || isDemoSession) && (
          <div className="mt-6 flex w-full max-w-md flex-col items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 sm:mt-8 sm:p-5">
            {isDemoSession ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  Your demo is still running
                </p>
                <p className="mb-1 text-sm text-muted-foreground">
                  Pick up where you left off. It is private and deleted 2 hours
                  after you started it.
                </p>
                <DemoSignInButton alreadySignedIn turnstileSiteKey={siteKey ?? ""} />
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Just looking around?
                </p>
                <p className="mb-1 text-sm text-muted-foreground">
                  Your own populated workspace in one click. No sign-up, private,
                  deleted after 2 hours.
                </p>
                {siteKey && <DemoSignInButton turnstileSiteKey={siteKey} />}
              </>
            )}
          </div>
        )}

        <dl className="mt-6 grid w-full max-w-md grid-cols-3 gap-2 sm:mt-8">
          {stats.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center">
              <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
              <dd className="order-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-border/40 py-4">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
          <BrandLogo variant="muted" />
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} JobHunt
          </p>
        </div>
      </footer>
    </main>
  );
}
