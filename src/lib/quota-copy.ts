/**
 * Shared copy for quota-exceeded toasts. Plain client-safe module (no
 * "server-only") so every AI panel can render the same message instead of
 * each inlining its own string.
 */

export type QuotaErrorBody = {
  used?: number;
  limit?: number;
  budgetScope?: "monthly" | "lifetime" | null;
};

export function describeQuotaError(body: QuotaErrorBody): string {
  if (body.budgetScope === "lifetime") {
    return "You have used your free $0.50 credit. Request full access from the sidebar to keep going.";
  }
  const spent = typeof body.used === "number" ? `$${body.used.toFixed(2)}` : "your full";
  const limit = typeof body.limit === "number" ? `$${body.limit.toFixed(2)}` : "";
  return `Monthly AI budget reached (${spent} of ${limit} used). Quota resets soon.`;
}
