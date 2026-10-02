import Image from "next/image";
import Link from "next/link";

/** Display the supplied artwork without its surrounding page whitespace. */
function LogoArtwork({
  part,
  className,
}: {
  part: "mark" | "wordmark";
  className: string;
}) {
  const crop = part === "mark"
    ? { x: 400, y: 242, width: 454, height: 566 }
    : { x: 178, y: 866, width: 900, height: 164 };

  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden ${className}`}
      style={{ aspectRatio: `${crop.width} / ${crop.height}` }}
    >
      <Image
        src="/brand/offerstitch.png"
        alt=""
        width={1254}
        height={1254}
        sizes={part === "mark" ? "80px" : "200px"}
        loading="eager"
        className="pointer-events-none absolute max-w-none dark:invert"
        style={{
          width: `${(1254 / crop.width) * 100}%`,
          height: "auto",
          left: `${(-crop.x / crop.width) * 100}%`,
          top: `${(-crop.y / crop.height) * 100}%`,
        }}
      />
    </span>
  );
}

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
  iconOnly = false,
  className = "",
}: {
  /** "muted" is the smaller, quieter footer treatment. */
  variant?: "default" | "muted";
  /** The collapsed dashboard keeps the document symbol and accessible name. */
  iconOnly?: boolean;
  className?: string;
}) {
  const muted = variant === "muted";
  return (
    <Link
      href="/"
      aria-label="Offerstitch home"
      className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-md mix-blend-multiply transition-opacity duration-200 hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none dark:mix-blend-screen ${muted ? "opacity-65" : ""} ${className}`}
    >
      <LogoArtwork
        part="mark"
        className={muted ? "w-5" : "w-6"}
      />
      {!iconOnly && (
        <LogoArtwork
          part="wordmark"
          className={muted ? "w-24" : "w-28"}
        />
      )}
    </Link>
  );
}
