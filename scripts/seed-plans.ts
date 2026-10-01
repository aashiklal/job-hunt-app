import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";
import connectDB from "../src/lib/db/connect";
import Plan from "../src/lib/models/Plan";

/**
 * Credit allowances are the only limit users hit. 500 credits is priced to
 * cost roughly $3 of real AI spend a month at about $0.006 per credit, well
 * under the plan price.
 */
const PLANS = [
  {
    key: "personal",
    name: "Personal",
    monthlyPriceUSD: 12,
    monthlyCredits: 500,
    maxResumes: 5,
  },
];

async function main() {
  await connectDB();
  console.log("Connected to MongoDB.");

  for (const plan of PLANS) {
    await Plan.findOneAndUpdate(
      { key: plan.key },
      // Removes fields from retired designs: aiSpendLimitUSD (the old USD
      // ceiling) and per-plan feature flags that were never enforced. strict:false
      // lets the $unset reach documents even though the schema no longer has them.
      {
        $set: plan,
        $unset: {
          aiSpendLimitUSD: "",
          pdfParsingEnabled: "",
          docxParsingEnabled: "",
          pdfExportEnabled: "",
          active: "",
        },
      },
      { upsert: true, returnDocument: "after", strict: false }
    );
    console.log(
      `Seeded plan: ${plan.key} ($${plan.monthlyPriceUSD}/mo, ${plan.monthlyCredits} credits)`
    );
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding plans:", err);
  process.exit(1);
});
