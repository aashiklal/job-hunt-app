/**
 * Admin notification helpers.
 */
import "server-only";

import { Resend } from "resend";
import { listAdmins } from "@/lib/repositories/users";

async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "notifications@yourdomain.com";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

/**
 * Escapes text for an HTML email body. Names and emails come straight from a
 * stranger's Clerk sign-up, so unescaped they could inject a convincing link
 * into a message admins trust.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Removes line breaks so a value cannot add lines to an email header. */
export function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Fetch every admin's email address from the DB. */
async function getAdminEmails(): Promise<string[]> {
  const admins = await listAdmins();
  return admins.map((a) => a.email).filter(Boolean);
}

/**
 * Fire-and-forget email to all admins when a new user signs up.
 * Safe to await because errors are caught and logged instead of breaking the webhook response.
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
    <p><strong>${escapeHtml(displayName)}</strong> (${escapeHtml(user.email)}) just signed up and is waiting for approval.</p>
    <p><a href="${adminUrl}">Review in the admin panel →</a></p>
  `.trim();

  const text = `${displayName} (${user.email}) just signed up and is waiting for approval.\n\nReview here: ${adminUrl}`;

  const telegramText = `New sign-up pending approval: ${displayName} (${user.email})\n\nReview here: ${adminUrl}`;

  await Promise.allSettled([
    getResend()
      .emails.send({
        from: FROM,
        to: adminEmails,
        subject: `New sign-up pending approval: ${singleLine(displayName)}`,
        html,
        text,
      })
      .catch((err) =>
        console.error("[notify] Failed to send email notification:", err)
      ),
    sendTelegramMessage(telegramText).catch((err) =>
      console.error("[notify] Failed to send Telegram notification:", err)
    ),
  ]);
}
