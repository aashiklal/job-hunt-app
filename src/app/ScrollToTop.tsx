"use client";

import { useEffect, useState } from "react";
import { Briefcase, ArrowUp } from "lucide-react";

export function LandingLogo() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="Scroll to top"
    >
      <Briefcase className="size-5 text-foreground" strokeWidth={1.75} />
      <span className="text-base font-semibold tracking-tight text-foreground">
        JobHunt
      </span>
    </button>
  );
}

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background shadow-md transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="Scroll to top"
    >
      <ArrowUp className="size-4" strokeWidth={2} />
    </button>
  );
}
