import Link from "next/link";
import { Info } from "lucide-react";

/**
 * Tells a demo visitor what they are looking at.
 *
 * Without this, canned AI output reads as broken rather than deliberate: a
 * visitor pasting a real job posting into quick import and getting a fixed
 * example back has no way to know that is intentional. Saying so up front
 * turns a suspected bug into a visible cost-control decision.
 */
export function DemoBanner() {
  return (
    <aside
      aria-label="Demo mode"
      className="border-b border-border bg-muted/50 px-4 py-2.5 sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:gap-3">
        <p className="flex items-start gap-2 text-foreground sm:items-center">
          <Info
            className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0"
            aria-hidden="true"
          />
          <span>
            <span className="font-medium">You are in the demo.</span>{" "}
            <span className="text-muted-foreground">
              Everything is editable and resets nightly. AI responses are
              pre-written examples, so no model is called.
            </span>
          </span>
        </p>
        <Link
          href="/sign-up"
          className="self-start rounded-md border border-border px-3 py-1 font-medium text-foreground transition-colors duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:ml-auto sm:self-auto sm:whitespace-nowrap"
        >
          Sign up to use real AI
        </Link>
      </div>
    </aside>
  );
}
