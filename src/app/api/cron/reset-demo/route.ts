import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ensureDemoUser, seedDemoData } from "@/lib/demo-seed";

/**
 * Restores the public demo account to its seeded state.
 *
 * Invoked by the Vercel cron entry in vercel.json. Vercel sends the project's
 * CRON_SECRET as a bearer token, so the route is not callable by anyone who
 * merely knows the path.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/reset-demo] CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await ensureDemoUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Demo user does not exist. Run seed:demo first." },
      { status: 404 }
    );
  }

  try {
    const summary = await seedDemoData(userId);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron/reset-demo] reset failed:", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
