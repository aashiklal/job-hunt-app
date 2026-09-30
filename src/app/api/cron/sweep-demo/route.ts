import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  createDefaultDemoClerk,
  sweepExpiredDemoAccounts,
  sweepOrphanClerkDemoUsers,
} from "@/lib/demo-accounts";

/**
 * Deletes expired per-visitor demo accounts, the retired shared demo account,
 * and any demo Clerk users left without a database record.
 *
 * Invoked by the Vercel cron entry in vercel.json. Vercel sends the project's
 * CRON_SECRET as a bearer token, so the route is not callable by anyone who
 * merely knows the path. Demo creation also sweeps a few accounts each time,
 * so this is the backstop, not the only cleanup.
 */

export const maxDuration = 60;

const CRON_SWEEP_LIMIT = 500;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/sweep-demo] CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clerk = createDefaultDemoClerk();
    const accounts = await sweepExpiredDemoAccounts(clerk, {
      limit: CRON_SWEEP_LIMIT,
    });
    const orphans = await sweepOrphanClerkDemoUsers(clerk);
    return NextResponse.json({ ok: true, accounts, orphans });
  } catch (err) {
    console.error("[cron/sweep-demo] sweep failed:", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
