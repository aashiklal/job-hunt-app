import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";
import connectDB from "../src/lib/db/connect";
import Plan from "../src/lib/models/Plan";

const plans = [
  {
    key: "personal",
    name: "Full access",
    aiSpendLimitUSD: 5.0,
    budgetScope: "monthly" as const,
    maxResumes: 5,
    maxJobs: -1,
    pdfParsingEnabled: true,
    docxParsingEnabled: true,
    pdfExportEnabled: true,
    active: true,
  },
  {
    // Given to self-serve sign-ups when AUTO_APPROVE_SIGNUPS=true. A one-time
    // lifetime credit, not a monthly allowance: enough for one full pass
    // through the app's core workflow. Once spent, the user requests full
    // access from the sidebar.
    key: "free",
    name: "Free",
    aiSpendLimitUSD: 0.5,
    budgetScope: "lifetime" as const,
    maxResumes: 2,
    maxJobs: -1,
    pdfParsingEnabled: true,
    docxParsingEnabled: true,
    pdfExportEnabled: true,
    active: true,
  },
];

async function main() {
  await connectDB();
  console.log("Connected to MongoDB.");

  for (const plan of plans) {
    await Plan.findOneAndUpdate(
      { key: plan.key },
      { $set: plan },
      { upsert: true, returnDocument: "after" }
    );
    console.log(`Seeded plan: ${plan.key}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding plans:", err);
  process.exit(1);
});
