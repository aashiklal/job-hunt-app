/**
 * Admin notification helpers.
 * Server-only — never import this in Client Components.
 */
import { Resend } from "resend";
import { listAdmins } from "@/lib/repositories/users";

const FROM = process.env.RESEND_FROM_EMAIL ?? "notifications@yourdomain.com";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

/** Fetch every admin's email address from the DB. */
async function getAdminEmails(): Promise<string[]> {
  const admins = await listAdmins();
  return admins.map((a) => a.email).filter(Boolean);
}

/**
 * Fire-and-forget email to all admins when a new user signs up.
 * Safe to `await` — errors are caught and logged so they never break the webhook response.
 */
export async function notifyAdminsNewSignup(user: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<void> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return;

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  // NEXT_PUBLIC_APP_URL takes priority; fall back to Vercel's auto-injected
  // production URL (server-only, no https prefix), then empty string.
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  const appUrl = rawUrl.replace(/\/$/, "");
  const adminUrl = `${appUrl}/admin`;

  const html = `
    <p>Hi,</p>
    <p><strong>${displayName}</strong> (${user.email}) just signed up and is waiting for approval.</p>
    <p><a href="${adminUrl}">Review in the admin panel →</a></p>
  `.trim();

  const text = `${displayName} (${user.email}) just signed up and is waiting for approval.\n\nReview here: ${adminUrl}`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to: adminEmails,
      subject: `New sign-up pending approval: ${displayName}`,
      html,
      text,
    });
  } catch (err) {
    // Never let a notification failure break the webhook
    console.error("[notify] Failed to send admin signup notification:", err);
  }
}
