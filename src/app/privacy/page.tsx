import type { Metadata } from "next";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Offerstitch stores, who processes it, and how to have your data deleted.",
};

/** Where deletion and privacy requests go. One place to change it. */
const CONTACT_EMAIL = "aashiklal.ma@gmail.com";

const linkClass =
  "rounded-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <BrandLogo className="mb-10 w-fit" />

        <article className="space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Privacy
            </h1>
            <p>
              Offerstitch is a personal project run by one developer. This page says
              plainly what it keeps about you and what happens to it.
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">What is stored</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Your account: name and email address, handled by Clerk, the sign-in
                provider.
              </li>
              <li>
                What you add: resumes, jobs, notes and application status.
              </li>
              <li>
                What the app generates for you: tailored resumes, cover letters,
                analyses and messages.
              </li>
              <li>
                Usage records: which AI features you used and when, to enforce the
                credit allowance for each billing month.
              </li>
            </ul>
            <p>
              This is kept in a MongoDB database. The app is hosted on Vercel.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">
              What is sent to the AI model
            </h2>
            <p>
              When you use an AI feature, the job description and the resume it
              needs are sent to Anthropic&apos;s API to produce the result.
              Anthropic does not use data sent through its API to train its models
              by default. Its{" "}
              <a
                href="https://www.anthropic.com/legal/privacy"
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                privacy policy
              </a>{" "}
              covers how long it keeps that data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">What is not done</h2>
            <p>
              Your data is not sold or used for advertising, and there is no
              analytics or tracking script. Beyond the services named on this page,
              the only place your details go is a sign-up notice: your name and
              email are sent to the admin by email (through Resend) and Telegram so
              your account can be approved.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">Demo accounts</h2>
            <p>
              The live demo creates a temporary account with sample data. It is
              deleted, with everything in it, when you leave the demo or after two
              hours, whichever comes first.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-foreground">
              Deleting your data
            </h2>
            <p>
              Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                {CONTACT_EMAIL}
              </a>{" "}
              from the address on your account and your account and everything in
              it will be deleted. You can also ask for a copy of your data the same
              way.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
