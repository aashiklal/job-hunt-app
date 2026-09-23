import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";
import connectDB from "../src/lib/db/connect";
import Plan from "../src/lib/models/Plan";

/**
 * Credit allowances are what users see and hit. The USD limit stays as a
 * backstop only. Free is deliberately small: at roughly $0.006 of spend per
 * credit, 60 credits costs at most about $0.36, which is enough to genuinely
 * try the product without funding someone's whole job search.
 */
const PLANS = [
  {
    key: "personal",
    name: "Personal",
    aiSpendLimitUSD: 5.0,
    monthlyCredits: 500,
    maxResumes: 5,
    pdfParsingEnabled: true,
    docxParsingEnabled: true,
    pdfExportEnabled: true,
    active: true,
  },
  {
    key: "free",
    name: "Free",
    aiSpendLimitUSD: 0.5,
    monthlyCredits: 60,
    maxResumes: 2,
    pdfParsingEnabled: true,
    docxParsingEnabled: true,
    pdfExportEnabled: true,
    active: true,
  },
];

async function main() {
  await connectDB();
  console.log("Connected to MongoDB.");

  for (const plan of PLANS) {
    await Plan.findOneAndUpdate(
      { key: plan.key },
      { $set: plan },
      { upsert: true, returnDocument: "after" }
    );
    console.log(
      `Seeded plan: ${plan.key} (${plan.monthlyCredits} credits, $${plan.aiSpendLimitUSD} ceiling)`
    );
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding plans:", err);
  process.exit(1);
});
