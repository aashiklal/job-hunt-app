import connectDB from "@/lib/db/connect";
import AuditLog, { IAuditLog, AuditAction } from "@/lib/models/AuditLog";

export type { AuditAction };

export type CreateAuditLogInput = {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  action: AuditAction;
  details?: Record<string, unknown>;
};

export async function create(input: CreateAuditLogInput): Promise<IAuditLog> {
  await connectDB();
  return AuditLog.create({
    adminId: input.adminId,
    adminEmail: input.adminEmail,
    targetUserId: input.targetUserId,
    targetUserEmail: input.targetUserEmail,
    action: input.action,
    details: input.details,
  });
}

export async function listRecent(limit: number = 100): Promise<IAuditLog[]> {
  await connectDB();
  return AuditLog.find().sort({ createdAt: -1 }).limit(limit);
}

export async function listForTargetUser(
  targetUserId: string,
  limit: number = 50
): Promise<IAuditLog[]> {
  await connectDB();
  return AuditLog.find({ targetUserId }).sort({ createdAt: -1 }).limit(limit);
}

// Serialization helper for client components
export type AuditLogItem = {
  _id: string;
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  action: AuditAction;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export function toAuditLogItem(doc: IAuditLog): AuditLogItem {
  return {
    _id: (doc._id as { toString(): string }).toString(),
    adminId: (doc.adminId as unknown as { toString(): string }).toString(),
    adminEmail: doc.adminEmail,
    targetUserId: (doc.targetUserId as unknown as { toString(): string }).toString(),
    targetUserEmail: doc.targetUserEmail,
    action: doc.action,
    details: doc.details ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}
