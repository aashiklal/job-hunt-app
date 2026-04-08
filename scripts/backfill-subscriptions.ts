import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is not set in .env.local");
  process.exit(1);
}

// Inline schemas to avoid importing Next.js-aware modules
const UserSchema = new mongoose.Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
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

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    planKey: { type: String, required: true, default: "personal" },
    status: {
      type: String,
      enum: ["active", "canceled", "past_due", "trialing"],
      default: "active",
    },
    customLimits: {
      type: new mongoose.Schema(
        { aiGenerationsPerMonth: { type: Number, required: false } },
        { _id: false }
      ),
      required: false,
    },
    currentPeriodEnd: { type: Date, default: null },
  },
  { timestamps: true }
);

const User = mongoose.models.User ?? mongoose.model("User", UserSchema);
const Subscription = mongoose.models.Subscription ?? mongoose.model("Subscription", SubscriptionSchema);

async function main() {
  await mongoose.connect(MONGODB_URI as string, { dbName: "jobhunt" });
  console.log("Connected to MongoDB.");

  const approvedUsers = await User.find({ status: "approved" }).select("_id").lean();
  console.log(`Found ${approvedUsers.length} approved user(s).`);

  let backfilled = 0;
  let alreadyHad = 0;

  for (const user of approvedUsers) {
    const result = await Subscription.findOneAndUpdate(
      { userId: user._id },
      { $setOnInsert: { userId: user._id, planKey: "personal", status: "active" } },
      { upsert: true, new: false }
    );
    // findOneAndUpdate with new:false returns the pre-update doc (null if inserted)
    if (result === null) {
      backfilled++;
    } else {
      alreadyHad++;
    }
  }

  console.log(
    `Backfilled ${backfilled} subscription(s) for approved users (${alreadyHad} already had one).`
  );

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
