import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  // Scheduled invocations carry no Clerk session. These routes authenticate
  // themselves with a CRON_SECRET bearer token instead.
  "/api/cron(.*)",
  // Creates a private demo account and mints a sign-in ticket for it, so by
  // definition the caller has no session yet. The route guards itself with a
  // kill switch, Turnstile, per-IP and global rate limits, and a live-demo cap.
  "/api/demo(.*)",
  // Shown after a demo expires. It ends the lingering session itself.
  "/demo-ended",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session.userId) {
    return session.redirectToSignIn();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
