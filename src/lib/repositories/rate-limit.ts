import connectDB from "@/lib/db/connect";
import RateLimit from "@/lib/models/RateLimit";

/**
 * Atomically increments the counter for one user, route and window, and
 * returns the resulting count.
 *
 * The upsert and the increment are a single operation, so concurrent callers
 * cannot both read the same value and both believe they are under the limit.
 */
export async function increment(args: {
  userId: string;
  route: string;
  windowStart: number;
  expiresAt: Date;
}): Promise<number> {
  await connectDB();

  const doc = await RateLimit.findOneAndUpdate(
    {
      userId: args.userId,
      route: args.route,
      windowStart: args.windowStart,
    },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        userId: args.userId,
        route: args.route,
        windowStart: args.windowStart,
        expiresAt: args.expiresAt,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  return doc?.count ?? 1;
}

