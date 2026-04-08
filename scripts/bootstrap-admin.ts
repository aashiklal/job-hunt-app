import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
import mongoose from "mongoose";

const adminEmail = process.argv[2];

if (!adminEmail) {
  console.error("Error: email argument is required.");
  console.error("Usage: npx tsx scripts/bootstrap-admin.ts <email>");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is not set in .env.local");
  process.exit(1);
}

// Inline schema to avoid importing Next.js-aware modules
const UserSchema = new mongoose.Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: false }
);

const User =
  mongoose.models.User ?? mongoose.model("User", UserSchema);

async function main() {
  await mongoose.connect(MONGODB_URI as string, { dbName: "jobhunt" });
  console.log("Connected to MongoDB.");

  // Promote the target admin user, creating a placeholder doc if needed
  let adminUser = await User.findOne({ email: adminEmail });

  if (!adminUser) {
    console.warn(
      `No user found for "${adminEmail}" — creating a placeholder document.`
    );
    console.warn(
      "Once this user signs in via Clerk, the webhook will fill in clerkId and name fields."
    );
    adminUser = await User.create({
      clerkId: `pending_${Date.now()}`,
      email: adminEmail,
      status: "approved",
      isAdmin: true,
    });
    console.log(`Placeholder created for: ${adminUser.email}`);
  } else {
    await User.updateOne(
      { email: adminEmail },
      { status: "approved", isAdmin: true }
    );
    adminUser = await User.findOne({ email: adminEmail });
    console.log(`Admin promoted: ${adminUser!.email} (clerkId: ${adminUser!.clerkId})`);
  }

  // Backfill existing users that have no status set (undefined → approved)
  const backfillResult = await User.updateMany(
    { status: { $exists: false }, email: { $ne: adminEmail } },
    { $set: { status: "approved" } }
  );

  if (backfillResult.modifiedCount > 0) {
    console.log(
      `Backfilled ${backfillResult.modifiedCount} existing user(s) to status "approved".`
    );
  } else {
    console.log("No existing users needed backfilling.");
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
