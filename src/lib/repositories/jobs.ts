import { Types } from "mongoose";
import connectDB from "@/lib/db/connect";
import Job, { IJob, JobStatus, InvalidTransitionError, isValidTransition } from "@/lib/models/Job";
import Doc from "@/lib/models/Document";

export type { JobStatus };
export { InvalidTransitionError, isValidTransition };

export type JobListItem = {
  _id: string;
  userId: string;
  company: string;
  role: string;
  location: string | null;
  status: JobStatus;
  url: string | null;
  salary: string | null;
  jobDescription: string | null;
  notes: string | null;
  appliedAt: string | null;
  contactName: string | null;
  contactTitle: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toJobListItem(doc: IJob): JobListItem {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    userId: (doc.userId as unknown as { toString(): string }).toString(),
    company: doc.company,
    role: doc.role,
    location: doc.location ?? null,
    status: doc.status,
    url: doc.url ?? null,
    salary: doc.salary ?? null,
    jobDescription: doc.jobDescription ?? null,
    notes: doc.notes ?? null,
    appliedAt: doc.appliedAt ? doc.appliedAt.toISOString() : null,
    contactName: doc.contactName ?? null,
    contactTitle: doc.contactTitle ?? null,
    deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export type JobCreateInput = {
  company: string;
  role: string;
  location?: string;
  jobDescription?: string;
  url?: string;
  salary?: string;
  status?: JobStatus;
  notes?: string;
  appliedAt?: Date | null;
};

export type JobUpdateInput = {
  company?: string;
  role?: string;
  location?: string;
  jobDescription?: string;
  url?: string;
  salary?: string;
  notes?: string;
  appliedAt?: Date | null;
  contactName?: string;
  contactTitle?: string;
};

export async function list(
  userId: string,
  options?: { includeDeleted?: boolean }
): Promise<JobListItem[]> {
  await connectDB();
  const filter: Record<string, unknown> = { userId };
  if (!options?.includeDeleted) {
    filter.deletedAt = null;
  }
  const docs = await Job.find(filter).sort({ updatedAt: -1 });
  return docs.map(toJobListItem);
}

export async function listDeleted(userId: string): Promise<JobListItem[]> {
  await connectDB();
  const docs = await Job.find({ userId, deletedAt: { $ne: null } }).sort({ deletedAt: -1 });
  return docs.map(toJobListItem);
}

export async function listByStatus(
  userId: string,
  status: JobStatus
): Promise<JobListItem[]> {
  await connectDB();
  const docs = await Job.find({ userId, status, deletedAt: null }).sort({ updatedAt: -1 });
  return docs.map(toJobListItem);
}

export async function getById(
  userId: string,
  jobId: string,
  options?: { includeDeleted?: boolean }
): Promise<JobListItem | null> {
  await connectDB();
  const filter: Record<string, unknown> = { _id: jobId, userId };
  if (!options?.includeDeleted) {
    filter.deletedAt = null;
  }
  const doc = await Job.findOne(filter);
  return doc ? toJobListItem(doc) : null;
}

export async function create(
  userId: string,
  data: JobCreateInput
): Promise<JobListItem> {
  await connectDB();
  const doc = await Job.create({
    userId,
    company: data.company,
    role: data.role,
    location: data.location,
    jobDescription: data.jobDescription,
    url: data.url,
    salary: data.salary,
    status: data.status ?? "saved",
    notes: data.notes,
    appliedAt: data.appliedAt ?? undefined,
    deletedAt: null,
  });
  return toJobListItem(doc);
}

export async function update(
  userId: string,
  jobId: string,
  data: JobUpdateInput
): Promise<JobListItem | null> {
  await connectDB();
  const allowedKeys: (keyof JobUpdateInput)[] = [
    "company",
    "role",
    "location",
    "jobDescription",
    "url",
    "salary",
    "notes",
    "appliedAt",
    "contactName",
    "contactTitle",
  ];
  const set: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in data && data[key] !== undefined) {
      set[key] = data[key];
    }
  }
  const doc = await Job.findOneAndUpdate(
    { _id: jobId, userId, deletedAt: null },
    { $set: set },
    { returnDocument: "after" }
  );
  return doc ? toJobListItem(doc) : null;
}

export async function setStatus(
  userId: string,
  jobId: string,
  status: JobStatus
): Promise<JobListItem | null> {
  await connectDB();
  const doc = await Job.findOneAndUpdate(
    { _id: jobId, userId, deletedAt: null },
    { $set: { status } },
    { returnDocument: "after" }
  );
  return doc ? toJobListItem(doc) : null;
}

export async function softDelete(
  userId: string,
  jobId: string
): Promise<JobListItem | null> {
  await connectDB();
  const doc = await Job.findOneAndUpdate(
    { _id: jobId, userId },
    { $set: { deletedAt: new Date() } },
    { returnDocument: "after" }
  );
  return doc ? toJobListItem(doc) : null;
}

export async function hardDelete(
  userId: string,
  jobId: string
): Promise<boolean> {
  await connectDB();
  const result = await Job.findOneAndDelete({
    _id: jobId,
    userId,
    deletedAt: { $ne: null },
  });
  if (result) {
    await Doc.deleteMany({ userId, jobId });
  }
  return result !== null;
}

export async function restore(
  userId: string,
  jobId: string
): Promise<JobListItem | null> {
  await connectDB();
  const doc = await Job.findOneAndUpdate(
    { _id: jobId, userId },
    { $set: { deletedAt: null } },
    { returnDocument: "after" }
  );
  return doc ? toJobListItem(doc) : null;
}

export async function countAll(): Promise<number> {
  await connectDB();
  return Job.countDocuments({ deletedAt: null });
}

// ---------------------------------------------------------------------------
// Demo seeding
// ---------------------------------------------------------------------------

export type JobSeedInput = JobCreateInput & {
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Bulk-inserts jobs with explicit timestamps. The regular create() path lets
 * Mongoose manage createdAt/updatedAt, which would stamp every seeded job with
 * "now" and leave the funnel, weekly-activity and stale-application widgets
 * with nothing to show. Seeding is the only legitimate caller.
 */
export async function createSeededMany(
  userId: string,
  rows: JobSeedInput[]
): Promise<JobListItem[]> {
  await connectDB();
  const docs = await Job.insertMany(
    rows.map((row) => ({ userId, deletedAt: null, ...row })),
    { timestamps: false }
  );
  return docs.map((doc) => toJobListItem(doc as IJob));
}

export async function deleteAllForUser(userId: string): Promise<number> {
  await connectDB();
  const result = await Job.deleteMany({ userId });
  return result.deletedCount ?? 0;
}

// ---------------------------------------------------------------------------
// Tracker stats
// ---------------------------------------------------------------------------

const STALE_THRESHOLD_DAYS = 14;

// Statuses that indicate the employer responded (moved past "applied")
const RESPONDED_STATUSES: JobStatus[] = [
  "screening",
  "interview",
  "assessment",
  "offer",
  "rejected",
];

export type TrackerStats = {
  funnelCounts: Record<JobStatus, number>;
  /** Percentage (0-100) of non-saved applications that got a response. null when there are no applications yet. */
  responseRate: number | null;
  /** Jobs sitting in "applied" status without any update for STALE_THRESHOLD_DAYS days. */
  staleCount: number;
};

export async function getTrackerStats(userId: string): Promise<TrackerStats> {
  await connectDB();

  const staleCutoff = new Date(
    Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  );

  const [result] = await Job.aggregate([
    { $match: { userId: new Types.ObjectId(userId), deletedAt: null } },
    {
      $facet: {
        byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        applications: [
          { $match: { status: { $ne: "saved" } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              responded: {
                $sum: {
                  $cond: [{ $in: ["$status", RESPONDED_STATUSES] }, 1, 0],
                },
              },
            },
          },
        ],
        stale: [
          {
            $match: {
              status: "applied",
              updatedAt: { $lt: staleCutoff },
            },
          },
          { $count: "count" },
        ],
      },
    },
  ]);

  const allStatuses: JobStatus[] = [
    "saved",
    "applied",
    "screening",
    "interview",
    "assessment",
    "offer",
    "rejected",
    "withdrawn",
  ];
  const funnelCounts = Object.fromEntries(
    allStatuses.map((s) => [s, 0])
  ) as Record<JobStatus, number>;
  for (const { _id, count } of result.byStatus) {
    funnelCounts[_id as JobStatus] = count;
  }

  const appStats = result.applications[0] as
    | { total: number; responded: number }
    | undefined;
  const responseRate =
    appStats && appStats.total > 0
      ? Math.round((appStats.responded / appStats.total) * 100)
      : null;

  const staleCount = (result.stale[0] as { count: number } | undefined)?.count ?? 0;

  return { funnelCounts, responseRate, staleCount };
}

// ---------------------------------------------------------------------------
// Stale jobs list
// ---------------------------------------------------------------------------

export type StaleJob = {
  _id: string;
  company: string;
  role: string;
  status: JobStatus;
  updatedAt: string;
  daysSinceUpdate: number;
};

export async function getStaleJobs(
  userId: string,
  thresholdDays: number = STALE_THRESHOLD_DAYS
): Promise<StaleJob[]> {
  await connectDB();

  const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
  const now = Date.now();

  const docs = await Job.find({
    userId,
    status: "applied",
    updatedAt: { $lt: cutoff },
    deletedAt: null,
  })
    .sort({ updatedAt: 1 }) // oldest first
    .select("company role status updatedAt")
    .lean();

  return docs.map((doc) => ({
    _id: (doc._id as { toString(): string }).toString(),
    company: doc.company,
    role: doc.role,
    status: doc.status,
    updatedAt: doc.updatedAt.toISOString(),
    daysSinceUpdate: Math.floor(
      (now - doc.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));
}

// ---------------------------------------------------------------------------
// Weekly applications (for activity chart)
// ---------------------------------------------------------------------------

export type WeeklyApplicationPoint = {
  /** ISO date string (YYYY-MM-DD) of the Monday that starts this week. */
  weekStart: string;
  count: number;
};

export async function getWeeklyApplications(
  userId: string,
  weeksBack: number = 8
): Promise<WeeklyApplicationPoint[]> {
  await connectDB();

  // Find the Monday of the current week (locale-independent)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - daysToMonday);
  currentMonday.setHours(0, 0, 0, 0);

  // Build the ordered list of week-start dates
  const slots: Date[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() - i * 7);
    slots.push(d);
  }

  const rangeStart = slots[0];

  // Fetch only the appliedAt field for jobs applied since rangeStart
  const docs = await Job.find({
    userId,
    appliedAt: { $gte: rangeStart },
    deletedAt: null,
  })
    .select("appliedAt")
    .lean();

  // Bucket each job into the correct week slot
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const counts = new Array<number>(weeksBack).fill(0);
  for (const doc of docs) {
    if (!doc.appliedAt) continue;
    const weekIndex = Math.floor(
      (doc.appliedAt.getTime() - rangeStart.getTime()) / msPerWeek
    );
    if (weekIndex >= 0 && weekIndex < weeksBack) {
      counts[weekIndex]++;
    }
  }

  return slots.map((weekStart, i) => ({
    weekStart: weekStart.toISOString().split("T")[0],
    count: counts[i],
  }));
}
