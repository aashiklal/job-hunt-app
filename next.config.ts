import type { NextConfig } from "next";

/**
 * Clerk's Frontend API host is instance-specific and encoded in the
 * publishable key: pk_(test|live)_<base64("<host>$")>. Reading it from the key
 * keeps the CSP correct for both the dev and the production instance.
 */
function clerkFrontendApiHost(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const encoded = key.split("_")[2];
  if (!encoded) return null;
  try {
    const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}

const isDev = process.env.NODE_ENV === "development";
const clerkHost = clerkFrontendApiHost();
const turnstile = "https://challenges.cloudflare.com";

/**
 * 'unsafe-inline' scripts are still needed for Next.js and next-themes inline
 * bootstraps (no nonce plumbing yet), so the main value here is img-src,
 * connect-src and frame-ancestors: injected content cannot load images from,
 * or send data to, hosts outside this list.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${clerkHost ?? ""} ${turnstile}`,
  `connect-src 'self' ${clerkHost ?? ""} ${turnstile}`,
  "img-src 'self' data: blob: https://img.clerk.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `frame-src ${turnstile}`,
  "worker-src 'self' blob:",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
]
  .map((directive) => directive.replace(/\s+/g, " ").trim())
  .join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["resend"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // Report-only until sign-in, the demo and Turnstile have been
          // checked against it in a browser; then rename the key to
          // Content-Security-Policy to enforce it.
          { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
