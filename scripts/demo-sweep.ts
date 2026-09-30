import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";
import connectDB from "../src/lib/db/connect";
import {
  createDefaultDemoClerk,
  sweepExpiredDemoAccounts,
  sweepOrphanClerkDemoUsers,
} from "../src/lib/demo-accounts";

/**
 * npm run demo:sweep
 *
 * Deletes expired per-visitor demo accounts, the retired shared demo account
 * (demo@jobhunt.app) with all of its data, and demo Clerk users that have no
 * database record. The same work the daily cron does, runnable by hand.
 *
 * Safe to run repeatedly.
 */
async function main() {
  await connectDB();
  console.log("Connected to MongoDB.");

  const clerk = createDefaultDemoClerk();

  let total = { deleted: 0, failed: 0 };
  // Loop until nothing is left, in batches, so a large backlog cannot time out.
  for (;;) {
    const batch = await sweepExpiredDemoAccounts(clerk, { limit: 100 });
    total = {
      deleted: total.deleted + batch.deleted,
      failed: total.failed + batch.failed,
    };
    if (batch.deleted === 0) break;
  }
  console.log(`Demo accounts: ${total.deleted} deleted, ${total.failed} failed.`);

  const orphans = await sweepOrphanClerkDemoUsers(clerk);
  console.log(
    `Orphaned Clerk demo users: ${orphans.deleted} deleted, ${orphans.failed} failed.`
  );

  await mongoose.disconnect();
  if (total.failed > 0 || orphans.failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
