import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";
import connectDB from "../src/lib/db/connect";
import * as subscriptions from "../src/lib/repositories/subscriptions";
import * as users from "../src/lib/repositories/users";

/**
 * Sets honest billing state on existing subscriptions.
 *
 * Every subscription defaulted to "active", which the margin dashboard reads
 * as paying. Nobody actually pays yet, so without this the dashboard would
 * report revenue that does not exist. Moves them to "trialing", which is what
 * they are, and marks demo accounts "comped".
 *
 * Safe to run repeatedly. Once Stripe exists it sets the status instead, and
 * this script should not be run again.
 */
async function main() {
  await connectDB();
  console.log("Connected to MongoDB.");

  const demoIds = new Set(await users.listDemoIds());

  const all = await subscriptions.listAll();
  let trialing = 0;
  let comped = 0;
  let untouched = 0;

  for (const sub of all) {
    const userId = (sub.userId as unknown as { toString(): string }).toString();

    if (demoIds.has(userId)) {
      if (sub.status !== "comped") {
        await subscriptions.setBillingStatus(userId, "comped");
        comped += 1;
      } else {
        untouched += 1;
      }
      continue;
    }

    // Only "active" is a claim of payment, so only that needs correcting.
    if (sub.status === "active") {
      await subscriptions.setBillingStatus(userId, "trialing");
      trialing += 1;
    } else {
      untouched += 1;
    }
  }

  console.log(`  ${trialing} moved to trialing`);
  console.log(`  ${comped} marked comped (demo accounts)`);
  console.log(`  ${untouched} already correct`);
  console.log(
    "\nRevenue now reads zero earned, which is accurate. Set a subscription to" +
      ' "active" when someone actually pays.'
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error backfilling billing status:", err);
  process.exit(1);
});
