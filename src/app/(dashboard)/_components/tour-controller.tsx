"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { OnboardingProgress, OnboardingStepId } from "@/lib/onboarding";

/**
 * Maps each step to its data-tour selector on the CURRENT page. A step only
 * spotlights when its target actually exists on the page being viewed; the
 * sidebar's next-step pill handles getting the user there otherwise.
 */
const STEP_SELECTORS: Record<OnboardingStepId, string> = {
  add_resume: '[data-tour="upload-resume"], [data-tour="submit-resume"]',
  add_job: '[data-tour="quick-import"], [data-tour="submit-job"]',
  analyze_jd: '[data-tour="analyze-jd"]',
  tailor_resume: '[data-tour="generate-resume"]',
  write_cover_letter: '[data-tour="generate-cover-letter"]',
  prep_interview: '[data-tour="generate-prep"]',
  draft_outreach: '[data-tour="draft-outreach"]',
  polish_story: '[data-tour="polish-story"]',
};

const RETRY_INTERVAL_MS = 150;
const RETRY_ATTEMPTS = 12; // ~1.8s total

/**
 * Spotlights the current onboarding step's target when it exists on the page
 * being viewed. Progress is recomputed server-side on every navigation, so a
 * step's spotlight disappears on its own once that step is done - no
 * client-side completion tracking is needed here.
 *
 * Two things make a single synchronous lookup unreliable, so this polls
 * briefly instead of checking once:
 * - The sidebar pill links to a URL hash (e.g. "#prep"). Following it from
 *   the SAME job page is a hash-only change: the route does not remount, so
 *   an effect keyed on the pathname never re-runs. A `hashchange` listener
 *   catches that case.
 * - On a fresh page load, the tab component itself reads the hash inside its
 *   own effect (to avoid a hydration mismatch) and only then mounts the
 *   target tab's content, one render after this component's first check.
 *   A short retry window covers that race instead of depending on it.
 */
export function TourController({ progress }: { progress: OnboardingProgress }) {
  const pathname = usePathname();

  useEffect(() => {
    const step = progress.currentStep;
    if (!step) return;

    const selector = STEP_SELECTORS[step.id];
    if (!selector) return;

    let instance: ReturnType<typeof driver> | null = null;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function tryHighlight() {
      const el = document.querySelector(selector);
      if (!el) {
        attempts += 1;
        if (attempts < RETRY_ATTEMPTS) {
          retryTimer = setTimeout(tryHighlight, RETRY_INTERVAL_MS);
        }
        return;
      }
      instance?.destroy();
      instance = driver({ showProgress: false, allowClose: true });
      instance.highlight({
        element: el,
        popover: { title: step!.label, description: step!.description },
      });
    }

    function handleHashChange() {
      attempts = 0;
      if (retryTimer) clearTimeout(retryTimer);
      tryHighlight();
    }

    tryHighlight();
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("hashchange", handleHashChange);
      instance?.destroy();
    };
    // `progress` is a fresh object from the server on every navigation, so
    // depending on it (rather than picking fields out) re-checks correctly
    // whenever the route or the underlying data changes.
  }, [pathname, progress]);

  return null;
}
