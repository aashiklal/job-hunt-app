import { Types } from "mongoose";
import connectDB from "@/lib/db/connect";
import UsageEvent from "@/lib/models/UsageEvent";

export type UsageBucket = "day" | "week" | "month" | "year";

export type UsageTotals = {
  costUSD: number;
  credits: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
};

export type UsagePoint = UsageTotals & {
  /** Bucket start, ISO date (YYYY-MM-DD) or YYYY-MM / YYYY depending on bucket. */
  bucket: string;
};

export type FeatureTotals = UsageTotals & { feature: string };

export async function record(args: {
  userId: string;
  feature: string;
  aiModel: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  credits: number;
}): Promise<void> {
  await connectDB();
  await UsageEvent.create(args);
}

/**
 * Mongo date-format strings per bucket. Everything is computed in UTC so a
 * report does not shift depending on who is reading it.
 */
const BUCKET_FORMAT: Record<UsageBucket, string> = {
  day: "%Y-%m-%d",
  week: "%G-W%V", // ISO week-numbering year and week
  month: "%Y-%m",
  year: "%Y",
};

const EMPTY: UsageTotals = {
  costUSD: 0,
  credits: 0,
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
};

function matchStage(opts: { userId?: string; since?: Date }) {
  const match: Record<string, unknown> = {};
  if (opts.userId) match.userId = new Types.ObjectId(opts.userId);
  if (opts.since) match.createdAt = { $gte: opts.since };
  return match;
}

const SUM_FIELDS = {
  costUSD: { $sum: "$costUSD" },
  credits: { $sum: "$credits" },
  calls: { $sum: 1 },
  inputTokens: { $sum: "$inputTokens" },
  outputTokens: { $sum: "$outputTokens" },
};

/** Totals across all time, or since a cutoff, optionally for one user. */
export async function totals(
  opts: { userId?: string; since?: Date } = {}
): Promise<UsageTotals> {
  await connectDB();
  const [row] = await UsageEvent.aggregate([
    { $match: matchStage(opts) },
    { $group: { _id: null, ...SUM_FIELDS } },
  ]);
  if (!row) return { ...EMPTY };
  return {
    costUSD: row.costUSD ?? 0,
    credits: row.credits ?? 0,
    calls: row.calls ?? 0,
    inputTokens: row.inputTokens ?? 0,
    outputTokens: row.outputTokens ?? 0,
  };
}

/** A time series, newest bucket last, for charting. */
export async function series(opts: {
  bucket: UsageBucket;
  since?: Date;
  userId?: string;
  limit?: number;
}): Promise<UsagePoint[]> {
  await connectDB();
  const rows = await UsageEvent.aggregate([
    { $match: matchStage(opts) },
    {
      $group: {
        _id: {
          $dateToString: {
            format: BUCKET_FORMAT[opts.bucket],
            date: "$createdAt",
            timezone: "UTC",
          },
        },
        ...SUM_FIELDS,
      },
    },
    { $sort: { _id: -1 } },
    ...(opts.limit ? [{ $limit: opts.limit }] : []),
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({
    bucket: r._id as string,
    costUSD: r.costUSD ?? 0,
    credits: r.credits ?? 0,
    calls: r.calls ?? 0,
    inputTokens: r.inputTokens ?? 0,
    outputTokens: r.outputTokens ?? 0,
  }));
}

/** Spend split by feature, so it is obvious which button is expensive. */
export async function byFeature(
  opts: { since?: Date; userId?: string } = {}
): Promise<FeatureTotals[]> {
  await connectDB();
  const rows = await UsageEvent.aggregate([
    { $match: matchStage(opts) },
    { $group: { _id: "$feature", ...SUM_FIELDS } },
    { $sort: { costUSD: -1 } },
  ]);

  return rows.map((r) => ({
    feature: r._id as string,
    costUSD: r.costUSD ?? 0,
    credits: r.credits ?? 0,
    calls: r.calls ?? 0,
    inputTokens: r.inputTokens ?? 0,
    outputTokens: r.outputTokens ?? 0,
  }));
}

/** The heaviest users over a window, for spotting runaway cost. */
export async function topUsers(opts: {
  since?: Date;
  limit?: number;
}): Promise<Array<UsageTotals & { userId: string }>> {
  await connectDB();
  const rows = await UsageEvent.aggregate([
    { $match: matchStage(opts) },
    { $group: { _id: "$userId", ...SUM_FIELDS } },
    { $sort: { costUSD: -1 } },
    { $limit: opts.limit ?? 10 },
  ]);

  return rows.map((r) => ({
    userId: (r._id as { toString(): string }).toString(),
    costUSD: r.costUSD ?? 0,
    credits: r.credits ?? 0,
    calls: r.calls ?? 0,
    inputTokens: r.inputTokens ?? 0,
    outputTokens: r.outputTokens ?? 0,
  }));
}

export async function deleteAllForUser(userId: string): Promise<number> {
  await connectDB();
  const result = await UsageEvent.deleteMany({ userId });
  return result.deletedCount ?? 0;
}
