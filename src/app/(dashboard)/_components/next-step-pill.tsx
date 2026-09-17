import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { OnboardingStep } from "@/lib/onboarding";
import { SkipTourButton } from "./skip-tour-button";

/** Sidebar link to wherever the current onboarding step's target lives. */
export function NextStepPill({ step }: { step: OnboardingStep | null }) {
  if (!step || !step.href) return null;
  return (
    <div className="flex items-center gap-1">
      <Link
        href={step.href}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="truncate">Next: {step.label}</span>
        <ArrowRight className="size-3.5 shrink-0" strokeWidth={1.75} />
      </Link>
      <SkipTourButton />
    </div>
  );
}
