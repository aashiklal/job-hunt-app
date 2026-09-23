import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";
import { createClerkClient } from "@clerk/backend";
import connectDB from "../src/lib/db/connect";
import { DEMO_EMAIL, ensureDemoUser, seedDemoData } from "../src/lib/demo-seed";
import * as users from "../src/lib/repositories/users";

/**
 * Creates and populates the public demo account, end to end.
 *
 * Deliberately does everything: creates the Clerk identity if it is missing,
 * mirrors it into MongoDB, approves it, flags it as the demo, and fills it
 * with data. Requiring a human to sign up through a browser first made this a
 * three-step process that was easy to half-finish.
 *
 * Safe to run repeatedly. Re-running resets the demo data.
 */

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`\n${name} is not set in .env.local.\n`);
    process.exit(1);
  }
  return value;
}

/** Creates the Clerk user if absent. Returns its Clerk ID either way. */
async function ensureClerkUser(password: string): Promise<string> {
  const clerk = createClerkClient({
    secretKey: requireEnv("CLERK_SECRET_KEY"),
  });

  const existing = await clerk.users.getUserList({
    emailAddress: [DEMO_EMAIL],
  });

  if (existing.data.length > 0) {
    const user = existing.data[0];
    console.log(`Clerk user already exists (${user.id}).`);

    // Keep the published password in step with the environment, so rotating
    // DEMO_ACCOUNT_PASSWORD is a one-variable change.
    try {
      await clerk.users.updateUser(user.id, { password });
      console.log("Updated the demo password to match DEMO_ACCOUNT_PASSWORD.");
    } catch (err) {
      console.warn(
        "Could not update the demo password:",
        err instanceof Error ? err.message : err
      );
    }

    return user.id;
  }

  console.log(`Creating Clerk user ${DEMO_EMAIL}...`);
  const created = await clerk.users.createUser({
    emailAddress: [DEMO_EMAIL],
    password,
    firstName: "Demo",
    lastName: "User",
    skipPasswordChecks: true,
  });
  console.log(`Created Clerk user (${created.id}).`);
  return created.id;
}

async function main() {
  const password = requireEnv("DEMO_ACCOUNT_PASSWORD");

  const clerkId = await ensureClerkUser(password);

  await connectDB();
  console.log("Connected to MongoDB.");

  // Mirror the Clerk identity into Mongo. The webhook would normally do this,
  // but it does not fire for a backend-API creation.
  await users.upsertFromClerk({
    clerkId,
    email: DEMO_EMAIL,
    firstName: "Demo",
    lastName: "User",
  });

  const userId = await ensureDemoUser();
  if (!userId) {
    console.error(
      `\nFailed to resolve the demo user after creating it. This usually means ` +
        `the plans have not been seeded. Run "npm run seed:plans" first.\n`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const summary = await seedDemoData(userId);

  console.log(`\nDemo account ready: ${DEMO_EMAIL}`);
  console.log(`  ${summary.jobs} jobs`);
  console.log(`  ${summary.resumes} resumes`);
  console.log(`  ${summary.offers} offers`);
  console.log(`  ${summary.starStories} STAR stories`);
  console.log(`  ${summary.documents} generated documents`);
  console.log(`\nSign in at /sign-in with ${DEMO_EMAIL}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding demo data:", err);
  process.exit(1);
});
