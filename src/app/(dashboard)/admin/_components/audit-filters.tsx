"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { AuditAction } from "@/lib/repositories/audit-log";

const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "user.approved": "Approved user",
  "user.rejected": "Rejected user",
  "user.admin_granted": "Granted admin",
  "user.admin_revoked": "Revoked admin",
  "user.custom_limit_set": "Set custom budget",
  "user.custom_limit_cleared": "Cleared custom limit",
  "user.upgrade_granted": "Granted full access",
  "user.upgrade_declined": "Declined access request",
  "template.uploaded": "Uploaded template",
  "template.deleted": "Deleted template",
  "plan.updated": "Updated plan limits",
};

export function AuditFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAction = searchParams.get("audit_action") ?? "";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newParams = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      newParams.set("audit_action", e.target.value);
    } else {
      newParams.delete("audit_action");
    }
    newParams.set("audit_page", "1");
    router.push("?" + newParams.toString());
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="audit-action-filter"
        className="text-sm text-muted-foreground"
      >
        Filter by action
      </label>
      <select
        id="audit-action-filter"
        value={currentAction}
        onChange={handleChange}
        className="text-sm border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <option value="">All actions</option>
        {(Object.entries(AUDIT_ACTION_LABELS) as [AuditAction, string][]).map(
          ([action, label]) => (
            <option key={action} value={action}>
              {label}
            </option>
          )
        )}
      </select>
    </div>
  );
}
