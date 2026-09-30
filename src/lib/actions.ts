import {
  requireApprovedUserWithPlan,
  requireAdminWithPlan,
  type ApprovedUserContext,
} from "@/lib/auth-helpers";
import { CreditsExceededError, QuotaExceededError } from "@/lib/usage";
import { creditsExhaustedMessage } from "@/lib/ai-limit-response";
import { DemoLimitError } from "@/lib/demo-limits";

export type ActionContext = ApprovedUserContext;

export type ActionError =
  | { code: "QUOTA_EXCEEDED"; message: string; limit: number; periodEndsAt: string }
  | { code: "CREDITS_EXHAUSTED"; message: string; limit: number; periodEndsAt: string }
  | { code: "VALIDATION"; message: string; fieldErrors?: Record<string, string> }
  | { code: "NOT_FOUND"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "INTERNAL"; message: string };

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

function isNextNavigationError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "digest" in err &&
    typeof (err as { digest: unknown }).digest === "string" &&
    (
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (err as { digest: string }).digest.startsWith("NEXT_NOT_FOUND")
    )
  );
}

function handleError(err: unknown): ActionResult<never> {
  // Re-throw Next.js navigation errors so the framework can handle them
  if (isNextNavigationError(err)) throw err;

  if (err instanceof QuotaExceededError) {
    return {
      ok: false,
      error: {
        code: "QUOTA_EXCEEDED",
        message: err.message,
        limit: err.limit,
        periodEndsAt: err.periodEndsAt.toISOString(),
      },
    };
  }

  if (err instanceof CreditsExceededError) {
    return {
      ok: false,
      error: {
        code: "CREDITS_EXHAUSTED",
        message: creditsExhaustedMessage(err),
        limit: err.limit,
        periodEndsAt: err.periodEndsAt.toISOString(),
      },
    };
  }

  if (err instanceof DemoLimitError) {
    return { ok: false, error: { code: "FORBIDDEN", message: err.message } };
  }

  // Duck-type ZodError to avoid importing zod solely for instanceof
  if (
    err !== null &&
    typeof err === "object" &&
    "name" in err &&
    (err as { name: string }).name === "ZodError"
  ) {
    const zodErr = err as { issues?: Array<{ path: (string | number)[]; message: string }> };
    const fieldErrors: Record<string, string> = {};
    for (const issue of zodErr.issues ?? []) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Validation failed", fieldErrors },
    };
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("[action error]", {
    message,
    stack: err instanceof Error ? err.stack : undefined,
  });
  return {
    ok: false,
    error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
  };
}

/**
 * Wraps a Server Action with auth, error handling, and uniform result shape.
 * The handler receives the approved user's context (user, subscription, plan)
 * as the first argument and the action's typed input as the second.
 *
 * @example
 * export const createJob = defineAction(async (ctx, input: { company: string; role: string }) => {
 *   const job = await jobs.create(ctx.user._id.toString(), input);
 *   revalidatePath("/jobs");
 *   return { jobId: job._id.toString() };
 * });
 */
export function defineAction<TInput, TOutput>(
  handler: (ctx: ActionContext, input: TInput) => Promise<TOutput>
) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    try {
      const ctx = await requireApprovedUserWithPlan();
      const data = await handler(ctx, input);
      return { ok: true, data };
    } catch (err) {
      return handleError(err);
    }
  };
}

/**
 * Wraps a Server Action with admin-only auth, error handling, and uniform result shape.
 * The handler receives the admin user's context (user, subscription, plan)
 * as the first argument and the action's typed input as the second.
 *
 * @example
 * export const setUserLimit = defineAdminAction(async (ctx, input: { userId: string; limit: number }) => {
 *   await subscriptions.setCustomLimit(input.userId, input.limit);
 *   revalidatePath("/admin");
 * });
 */
export function defineAdminAction<TInput, TOutput>(
  handler: (ctx: ActionContext, input: TInput) => Promise<TOutput>
) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    try {
      const ctx = await requireAdminWithPlan();
      const data = await handler(ctx, input);
      return { ok: true, data };
    } catch (err) {
      return handleError(err);
    }
  };
}
