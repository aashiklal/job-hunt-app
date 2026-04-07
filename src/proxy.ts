import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const allowedEmail = process.env.ALLOWED_USER_EMAIL;
  if (!allowedEmail) {
    throw new Error(
      "ALLOWED_USER_EMAIL environment variable is not set. " +
        "Set it to the email address that is permitted to access this app."
    );
  }

  // Let unauthenticated users through to public routes; Clerk handles the redirect.
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // Require authentication for all other routes.
  const session = await auth();
  if (!session.userId) {
    return session.redirectToSignIn();
  }

  // Skip email check on the unauthorised page to avoid a redirect loop.
  if (request.nextUrl.pathname === "/unauthorised") {
    return NextResponse.next();
  }

  // Fetch the full user record to get the primary email address.
  const client = await clerkClient();
  const user = await client.users.getUser(session.userId);

  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress;

  if (!primaryEmail || primaryEmail.toLowerCase() !== allowedEmail.toLowerCase()) {
    return NextResponse.redirect(new URL("/unauthorised", request.url));
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
