"use server";

import { defineAction } from "@/lib/actions";
import { isDemoUser } from "@/lib/demo";
import { createDefaultDemoClerk, destroyDemoAccount } from "@/lib/demo-accounts";

/**
 * Ends the caller's own demo immediately: Clerk user first (which revokes the
 * session), then its data. Called when a visitor confirms "Exit demo" or
 * chooses to sign up or sign in from a demo.
 *
 * Deleting now rather than at expiry frees the visitor's live-demo slot and
 * removes the data the moment they are done with it.
 *
 * Only ever acts on the signed-in user, and does nothing for a real account:
 * `ended: false` tells the caller to stop rather than navigate.
 */
export const endDemo = defineAction(async (ctx) => {
  if (!isDemoUser(ctx.user)) {
    return { ended: false };
  }

  await destroyDemoAccount(
    { clerkId: ctx.user.clerkId, userId: ctx.user._id.toString() },
    createDefaultDemoClerk()
  );
  return { ended: true };
});
