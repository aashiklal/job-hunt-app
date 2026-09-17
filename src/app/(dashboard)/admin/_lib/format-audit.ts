import type { AuditAction } from "@/lib/repositories/audit-log";

export function formatAuditAction(
  action: AuditAction,
  details: Record<string, unknown> | null
): string {
  switch (action) {
    case "user.approved":
      return "Approved";
    case "user.rejected":
      return "Rejected";
    case "user.admin_granted":
      return "Granted admin";
    case "user.admin_revoked":
      return "Revoked admin";
    case "user.custom_limit_set": {
      const usd = details?.aiSpendLimitUSD;
      return `Set custom budget to ${typeof usd === "number" ? `$${usd.toFixed(2)}` : "?"}`;
    }
    case "user.custom_limit_cleared":
      return "Cleared custom limit";
    case "user.upgrade_granted":
      return "Granted full access";
    case "user.upgrade_declined":
      return "Declined access request";
    case "template.uploaded":
      return `Uploaded ${details?.templateType ?? "template"} template`;
    case "template.deleted":
      return `Deleted ${details?.templateType ?? "template"} template`;
    case "plan.updated": {
      const key = details?.planKey;
      return `Updated ${typeof key === "string" ? key : "unknown"} plan limits`;
    }
    default:
      return action;
  }
}
