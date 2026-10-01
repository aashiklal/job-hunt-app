import Link from "next/link";
import { Briefcase } from "lucide-react";

/**
 * The Offerstitch logo, always a link to the landing page.
 *
 * The landing page decides what each visitor sees, so the logo never needs to
 * know who is clicking: signed-out visitors get the demo and sign-up, real
 * users get a dashboard link, a live demo gets "Back to your demo", and an
 * expired demo is sent to /demo-ended.
 */
export function BrandLogo({
  variant = "default",
  className = "",
}: {
  /** "muted" is the smaller, quieter footer treatment. */
  variant?: "default" | "muted";
  className?: string;
}) {
  const muted = variant === "muted";
  return (
    <Link
      href="/"
      aria-label="Offerstitch home"
      className={`flex items-center gap-2 rounded-md transition-opacity duration-200 hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${className}`}
    >
      <Briefcase
        className={muted ? "size-4 text-muted-foreground" : "size-5 text-foreground"}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span
        className={
          muted
            ? "text-sm font-medium text-muted-foreground"
            : "text-base font-semibold tracking-tight text-foreground"
        }
      >
        Offerstitch
      </span>
    </Link>
  );
}
