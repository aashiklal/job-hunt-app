# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # Start dev server (Turbopack, port 3000)
npm run build     # Production build (Turbopack)
npm run start     # Start production server
npm run lint      # Run ESLint directly (eslint)

# One-time setup scripts (use tsx, require .env.local)
npm run bootstrap:admin         # Promote a user to admin by clerkId
npm run seed:plans              # Seed Plan documents into MongoDB
npm run backfill:subscriptions  # Create Subscription records for existing approved users
```

No test runner is configured yet.

## Tech Stack

- **Next.js 16.2.2** — App Router only; Turbopack is the default bundler
- **React 19** — Server Components by default
- **TypeScript** — strict mode; path alias `@/*` → `src/*`
- **Tailwind CSS v4** — configured via PostCSS (`@tailwindcss/postcss`)
- **shadcn/ui** — component library built on `radix-ui` + `class-variance-authority` + `tailwind-merge`
- **Clerk** (`@clerk/nextjs` v7) — authentication
- **Mongoose** — MongoDB ODM for data persistence
- **Anthropic SDK** (`@anthropic-ai/sdk`) — AI features

## Next.js 16 Breaking Changes

This project runs **Next.js 16**, which has several breaking changes from prior versions. **Read `node_modules/next/dist/docs/` before writing code.**

### Linting
`next lint` is removed. Use ESLint directly:
```bash
npx eslint .   # or npm run lint
```
`next build` no longer runs linting automatically.

### Turbopack by default
`next dev` and `next build` both use Turbopack. Custom `webpack` config in `next.config.ts` will cause `next build` to fail. Migrate webpack config to Turbopack, or pass `--webpack` to opt out.

### Caching (`use cache` directive)
The old `fetch` cache model is superseded by the `use cache` directive when `cacheComponents: true` is set in `next.config.ts`. Without that flag, use the [old model guide](node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md).

```ts
// next.config.ts — opt in to new cache model
const nextConfig: NextConfig = { cacheComponents: true }
```

Usage:
```ts
export async function getData() {
  'use cache'
  cacheLife('hours')
  return db.query(...)
}
```

### Middleware → Proxy
The `middleware.ts` convention is deprecated in favour of `proxy.ts`. See `node_modules/next/dist/docs/01-app/02-guides/` for the proxy guide.

### Removed APIs
- `serverRuntimeConfig` / `publicRuntimeConfig` — use `process.env` in Server Components or `NEXT_PUBLIC_` vars in Client Components
- `getConfig()` from `next/config` — removed
- AMP (`next/amp`, `useAmp`) — removed
- `devIndicators.appIsrStatus`, `buildActivity`, `buildActivityPosition` — removed
- `experimental.dynamicIO` — renamed to `cacheComponents`

### Instant navigation
For client-side navigations to feel instant with Cache Components, export `unstable_instant` from the route. See `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.mdx`.

## Project Structure

```
src/
  proxy.ts                         # Clerk auth proxy (replaces middleware.ts in Next.js 16)
  app/
    layout.tsx                     # Root layout — Geist font, ClerkProvider
    page.tsx                       # Public landing page
    (dashboard)/                   # Route group; layout enforces requireApprovedUserWithPlan()
      layout.tsx                   # Calls requireApprovedUserWithPlan(), renders DashboardShell
      DashboardShell.tsx           # Sidebar nav (client component)
      jobs/ resume/ tracker/       # Core dashboard pages
      analyze/ cover-letter/ email/ settings/
      admin/
        layout.tsx                 # Calls requireAdminWithPlan() (notFound() if not admin)
        page.tsx                   # User access management table
        _actions.ts                # Server Actions: approve/reject users (defineAdminAction)
        _components/               # Admin-only client components
    api/webhooks/clerk/route.ts    # Clerk user.created/updated/deleted webhook
    sign-in/ sign-up/              # Clerk hosted UI catch-all routes
    pending/ rejected/             # Holding pages for non-approved users
    unauthorised/
  lib/
    auth-helpers.ts                # requireApprovedUserWithPlan(), requireAdminWithPlan(), getCurrentUser()
    actions.ts                     # defineAction() / defineAdminAction() wrappers + ActionResult type
    usage.ts                       # checkAndIncrementUsage(), decrementUsage(), getCurrentUsage(), QuotaExceededError
    anthropic.ts                   # Anthropic SDK singleton (server-only)
    db/
      connect.ts                   # MongoDB connection singleton (import this, not db.ts)
    models/                        # Mongoose models: User, Job, Resume, Document, Plan, Subscription, Usage
    repositories/                  # One file per model; all Mongo access goes through here
```

## Access Control Flow

New users land in `status: "pending"` (set by Clerk webhook or lazily in `requireApprovedUserWithPlan()`). Admins approve/reject from `/admin`. Status gates:

- **pending** → redirected to `/pending`
- **rejected** → redirected to `/rejected` (can re-request access via Server Action)
- **approved** → enters `(dashboard)` route group
- **isAdmin: true** → can also access `/admin` (inside the dashboard group; non-admins get `notFound()`)

`proxy.ts` only enforces Clerk session presence (redirects unauthenticated users to sign-in). Business-level status checks happen in `src/lib/auth-helpers.ts`.

`requireApprovedUserWithPlan()` and `requireAdminWithPlan()` are memoised with React `cache()` so calling them multiple times in the same request (layout + page) costs only one DB round-trip.

## Server Action Pattern

All Server Actions must be defined using the wrappers from `src/lib/actions.ts` — never call `requireApprovedUserWithPlan()` or `requireAdminWithPlan()` inline.

```ts
// Regular action — approved user required
export const createJob = defineAction(
  async (ctx, input: { company: string; role: string }) => {
    const job = await jobs.create(ctx.user._id.toString(), input);
    revalidatePath("/jobs");
    return { jobId: job._id.toString() };
  }
);

// Admin-only action
export const approveUser = defineAdminAction(
  async (_ctx, input: { userId: string }) => {
    await users.setStatus(input.userId, "approved");
    revalidatePath("/admin");
    return { userId: input.userId };
  }
);
```

Actions return `ActionResult<T>` — always `{ ok: true, data }` or `{ ok: false, error }`. Call sites check `result.ok` rather than catching. The wrapper handles `QuotaExceededError`, `ZodError`, and re-throws Next.js navigation errors (`redirect()` / `notFound()`).

**`actions.ts` must not have `"use server"` at the top** — that directive belongs on the individual `_actions.ts` files that export the wrapped functions.

## Repository Layer

All Mongoose queries go through `src/lib/repositories/`. Direct model imports outside of `src/lib/models/`, `src/lib/repositories/`, `src/lib/auth-helpers.ts`, and `src/lib/usage.ts` are blocked by ESLint (`no-restricted-imports`). The lint rule will catch violations before they reach review.

Each repository file calls `connectDB()` internally, so callers never need to.

Use `returnDocument: "after"` for all `findOneAndUpdate` / `findByIdAndUpdate` calls — not `{ new: true }` (that's the Mongoose v5 option; this project uses the MongoDB driver option).

## Plan / Subscription / Usage

Plans are seeded via `npm run seed:plans` and define feature limits by `key` (e.g. `"personal"`). Each approved user gets one `Subscription` (upserted in `subscriptions.ensureForUser()`). `Usage` tracks AI generation counts per month via a `period` field (`"YYYY-MM"` UTC format).

To gate an AI feature behind the quota:

```ts
import { checkAndIncrementUsage, decrementUsage } from "@/lib/usage";

// Throws QuotaExceededError if at limit; increments atomically if not
const { used, limit } = await checkAndIncrementUsage(ctx.user._id, "aiGeneration");
try {
  // ... Anthropic call ...
} catch (err) {
  await decrementUsage(ctx.user._id, "aiGeneration"); // refund on failure
  throw err;
}
```

`QuotaExceededError` is handled automatically by `defineAction` — it surfaces as `{ ok: false, error: { code: "QUOTA_EXCEEDED", ... } }`.

Admins can override per-user limits via `subscriptions.setCustomLimit()` / `subscriptions.clearCustomLimit()`.

## Project Conventions

- MongoDB connection: import `connectDB` from `@/lib/db/connect` (not `@/lib/db`). Both files exist; `db/connect.ts` is the canonical one.
- MongoDB models live in `src/lib/models/`. Use the singleton pattern (`mongoose.models.X ?? mongoose.model(...)`) to avoid recompilation in dev.
- Every API route handler must call `auth()` from `@clerk/nextjs/server` and return 401 if no `userId`. Server Actions use `defineAction`/`defineAdminAction` instead — never call `auth()` directly in actions. All Mongo queries must filter by `userId`.
- Anthropic SDK is only ever imported in server code. Client is instantiated in `src/lib/anthropic.ts`.
- Use Server Actions for mutations; use route handlers (`route.ts`) only for streaming responses or third-party inbound POSTs (e.g. Clerk webhooks).
- shadcn components are added via `npx shadcn@latest add <name>`. Do not hand-write components that shadcn already provides.
- Forms use `react-hook-form` + `zod` + `@hookform/resolvers`. Validation schemas live next to the form in a `schema.ts` file.
- Environment variables required: `MONGODB_URI`, `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`.
- Server Components inside `src/app/(dashboard)/**` can assume the user is approved (layout enforces this). Routes outside that group must call `requireApprovedUserWithPlan()` or `requireAdminWithPlan()` themselves.
