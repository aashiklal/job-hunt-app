# One private demo account per visitor

"Try the live demo" creates a fresh Clerk user and Mongo user for that visitor, seeds it with
sample data, and deletes it after 2 hours. It replaced a single shared demo account that was
reset nightly.

## Why

A shared account made every visitor's actions visible to the next. Anything typed into a job
or a note, offensive or not, stayed on show until the nightly reset. Clerk's account menu let
any visitor rename the shared account, give it an avatar, change its email or password, sign
out every other visitor, or delete it. Rate limits are per user, so one visitor could make the
demo and its AI buttons report "busy" for everyone. Filtering content or patching each hole
would never be complete; isolation removes the whole class.

## Consequences

Account creation is now reachable anonymously, so it is guarded in layers, cheapest first: a
`DEMO_DISABLED` kill switch, Cloudflare Turnstile (fails closed without a secret), a per-IP
limit, a global limit, and a cap on concurrently live demos. Per-demo creation caps bound how
much any one session can write.

Cleanup is designed so that no failure extends a demo or strands data. The Mongo record and
its expiry are written before seeding, so a crash mid-creation leaves something the sweep can
find. Deletion removes the Clerk user first, so no session can outlive a half-deleted account,
and keeps the Mongo record if Clerk refuses so the next sweep retries. Expiry is checked on
every request rather than trusted to the sweep, because Vercel Hobby crons run once a day.

Each demo is a Clerk user, so demos count toward Clerk's monthly active users. The live cap
and the 2-hour TTL keep that bounded.

Demo accounts are excluded from admin user lists, and the Clerk webhook ignores them, so they
never enter the approval queue or trigger admin notifications.

Leaving and ending are different actions. The logo and "Back to your demo" keep the demo
running. Ending it ("Exit demo", or signing up or signing in from a demo) asks for
confirmation, then deletes the account immediately rather than waiting for expiry, which also
frees the visitor's live-demo slot.

A Clerk session token outlives its user by up to a minute, so for a short while after a demo
is deleted requests still arrive carrying it. The access check sends such a session to sign-in
instead of recreating the user, the landing page treats it as signed out, and the demo buttons
leave with a full page load rather than a client-side navigation, so the next request carries
a fresh session.

AI requests are served from fixtures and never reach Anthropic, but each is charged the live
feature's credits against a 60-credit allowance set on the demo's subscription
(`DEMO_CREDITS`). A balance stuck at 500 misrepresented the app, and a small allowance lets a
visitor see what running out looks like. No spend or `UsageEvent` is recorded, so demos never
appear in admin cost figures.
