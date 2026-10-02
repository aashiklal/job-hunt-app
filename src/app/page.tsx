import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { Bricolage_Grotesque } from "next/font/google";
import * as users from "@/lib/repositories/users";
import { DemoSignInButton } from "./DemoSignInButton";
import { PostingStack, StageTrail } from "./_components/ApplicationTrail";
import { DemoExitButton } from "@/components/DemoExitButton";
import { BrandLogo } from "@/components/BrandLogo";
import { isDemoExpired, isDemoUser } from "@/lib/demo";
import { turnstileSiteKey } from "@/lib/turnstile";
import { isDemoDisabled } from "@/lib/demo-constants";

export const metadata: Metadata = {
  title: { absolute: "Offerstitch: every application, from posting to offer" },
  description:
    "Paste a job posting and Offerstitch pulls out the details, checks your resume against it, drafts a tailored resume and cover letter, and tracks the application until you hear back.",
};

/** Display face for the headline only; the product itself stays in Geist. */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  display: "swap",
});

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

export default async function LandingPage() {
  const { userId } = await auth();

  const currentUser = userId ? await users.getByClerkId(userId) : null;

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

  const primaryButton =
    "rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:px-6 sm:py-3";
  const secondaryButton =
    "rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:px-6 sm:py-3";

  const quietLink =
    "rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8 lg:px-12">
        <BrandLogo />
        <nav className="flex items-center gap-1">
          <ThemeToggle />
          {signedIn ? (
            <Link href="/jobs" className={quietLink}>
              Open your board
            </Link>
          ) : (
            <AuthLink demo={isDemoSession} href="/sign-in" className={quietLink}>
              Sign in
            </AuthLink>
          )}
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-10 px-4 py-6 sm:px-8 lg:gap-8 lg:px-12">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <h1
              className={`${display.className} max-w-xl text-5xl leading-none font-bold tracking-tight text-foreground font-stretch-condensed sm:text-6xl xl:text-7xl`}
            >
              Every application, from posting to offer.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              Paste a job posting. Offerstitch pulls out the details, checks your
              resume against it, and drafts a tailored resume and cover letter.
              Then you track it on one board until you hear back.
            </p>

            <div className="mt-8 max-w-md">
              {signedIn ? (
                <Link href="/jobs" className={primaryButton}>
                  Open your board
                </Link>
              ) : isDemoSession ? (
                <>
                  <div className="flex flex-wrap items-start gap-3">
                    <div>
                      <DemoSignInButton
                        alreadySignedIn
                        align="start"
                        turnstileSiteKey={siteKey ?? ""}
                      />
                    </div>
                    <AuthLink demo href="/sign-up" className={secondaryButton}>
                      Create an account
                    </AuthLink>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Your demo is still running. It is deleted 2 hours after you
                    started it.
                  </p>
                </>
              ) : demoAvailable && siteKey ? (
                <>
                  <div className="flex flex-wrap items-start gap-3">
                    <div>
                      <DemoSignInButton align="start" turnstileSiteKey={siteKey} />
                    </div>
                    <AuthLink demo={false} href="/sign-up" className={secondaryButton}>
                      Create an account
                    </AuthLink>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    No sign-up needed. Your demo is private and deleted after
                    2 hours.
                  </p>
                </>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <AuthLink demo={false} href="/sign-up" className={primaryButton}>
                    Create an account
                  </AuthLink>
                  <AuthLink demo={false} href="/sign-in" className={secondaryButton}>
                    Sign in
                  </AuthLink>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7">
            <PostingStack />
          </div>
        </div>

        <StageTrail />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
        <BrandLogo variant="muted" />
        <div className="flex items-center gap-2">
          <Link href="/privacy" className={quietLink}>
            Privacy
          </Link>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Offerstitch
          </p>
        </div>
      </footer>
    </main>
  );
}
