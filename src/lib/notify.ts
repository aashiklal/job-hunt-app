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

/** Fetch every admin's email address from the DB. */
async function getAdminEmails(): Promise<string[]> {
  const admins = await listAdmins();
  return admins.map((a) => a.email).filter(Boolean);
}

/**
 * NEXT_PUBLIC_APP_URL takes priority; falls back to Vercel's auto-injected
 * production URL (server-only, no https prefix), then empty string.
 */
function resolveAppUrl(): string {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  return rawUrl.replace(/\/$/, "");
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
  const adminUrl = `${resolveAppUrl()}/admin`;

  const html = `
    <p>Hi,</p>
    <p><strong>${displayName}</strong> (${user.email}) just signed up and is waiting for approval.</p>
    <p><a href="${adminUrl}">Review in the admin panel →</a></p>
  `.trim();

  const text = `${displayName} (${user.email}) just signed up and is waiting for approval.\n\nReview here: ${adminUrl}`;

  const telegramText = `New sign-up pending approval: ${displayName} (${user.email})\n\nReview here: ${adminUrl}`;

  await Promise.allSettled([
    getResend()
      .emails.send({
        from: FROM,
        to: adminEmails,
        subject: `New sign-up pending approval: ${displayName}`,
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

/**
 * Fire-and-forget notification to all admins when a free-plan user requests
 * full access. Never throws.
 */
export async function notifyAdminsUpgradeRequest(user: {
  _id: { toString(): string };
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<void> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return;

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const userUrl = `${resolveAppUrl()}/admin/${user._id.toString()}`;

  const html = `
    <p>Hi,</p>
    <p><strong>${displayName}</strong> (${user.email}) has requested full access.</p>
    <p><a href="${userUrl}">Review in the admin panel →</a></p>
  `.trim();

  const text = `${displayName} (${user.email}) has requested full access.\n\nReview here: ${userUrl}`;

  const telegramText = `Full access requested: ${displayName} (${user.email})\n\nReview here: ${userUrl}`;

  await Promise.allSettled([
    getResend()
      .emails.send({
        from: FROM,
        to: adminEmails,
        subject: `Full access requested: ${displayName}`,
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

/**
 * Fire-and-forget email to the user when an admin grants them full access.
 * Never throws.
 */
export async function notifyUserUpgraded(user: {
  email: string;
  firstName?: string | null;
}): Promise<void> {
  const greeting = user.firstName ? `Hi ${user.firstName},` : "Hi,";
  const appUrl = resolveAppUrl();

  const html = `
    <p>${greeting}</p>
    <p>You now have full access to Job Hunt. Your monthly AI budget has been upgraded.</p>
    <p><a href="${appUrl}">Open the app →</a></p>
  `.trim();

  const text = `${greeting}\n\nYou now have full access to Job Hunt. Your monthly AI budget has been upgraded.\n\nOpen the app: ${appUrl}`;

  await getResend()
    .emails.send({
      from: FROM,
      to: [user.email],
      subject: "You now have full access",
      html,
      text,
    })
    .catch((err) => console.error("[notify] Failed to send email notification:", err));
}
