import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as users from "@/lib/repositories/users";
import { isDemoExpired, type DemoCapableUser } from "@/lib/demo";

/**
 * Access check for route handlers. Route handlers cannot use
 * requireApprovedUserWithPlan() because its redirect() calls break the JSON
 * response contract, so this is the JSON equivalent.
 *
 * Checking that the Mongo user exists is not enough: a rejected or pending
 * user still has a record (and, once approved before, a subscription), and
 * without the status check could keep spending credits on live AI routes.
 */

type AccessCheckedUser = DemoCapableUser & {
  status: "pending" | "approved" | "rejected";
};

export type ApiAccessDenial = { status: 401 | 403 | 404; error: string };

/** Why this user may not use an API route, or null when they may. */
export function apiAccessDenial(
  user: AccessCheckedUser | null
): ApiAccessDenial | null {
  if (!user) return { status: 404, error: "User not found" };
  if (isDemoExpired(user)) return { status: 401, error: "This demo has ended." };
  if (user.status !== "approved") {
    return { status: 403, error: "Your account is not approved." };
  }
  return null;
}

type ApprovedApiUser = NonNullable<Awaited<ReturnType<typeof users.getByClerkId>>>;

export type ApiUserResult =
  | { ok: true; user: ApprovedApiUser }
  | { ok: false; response: NextResponse };

/**
 * Resolves the signed-in, approved app user for a route handler, or the error
 * response to return instead.
 */
export async function requireApprovedApiUser(): Promise<ApiUserResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = await users.getByClerkId(clerkUserId);
  const denial = apiAccessDenial(user);
  if (denial || !user) {
    const { status, error } = denial ?? { status: 404, error: "User not found" };
    return { ok: false, response: NextResponse.json({ error }, { status }) };
  }
  return { ok: true, user };
}
