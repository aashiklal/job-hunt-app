import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";
import connectDB from "../src/lib/db/connect";
import Plan from "../src/lib/models/Plan";

const planData = {
  key: "personal",
  name: "Personal",
  aiGenerationsPerMonth: 50,
  maxResumes: 5,
  maxJobs: -1,
  pdfParsingEnabled: true,
  docxParsingEnabled: true,
  pdfExportEnabled: true,
  active: true,
};

async function main() {
  await connectDB();
  console.log("Connected to MongoDB.");

  await Plan.findOneAndUpdate(
    { key: "personal" },
    { $set: planData },
    { upsert: true, new: true }
  );

  console.log("Seeded plan: personal");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding plans:", err);
  process.exit(1);
});
