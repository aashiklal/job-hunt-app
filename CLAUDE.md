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
    (dashboard)/                   # Route group; layout enforces requireApprovedUser()
      layout.tsx                   # Calls requireApprovedUser(), renders DashboardShell
      DashboardShell.tsx           # Sidebar nav (client component)
      jobs/ resume/ tracker/       # Core dashboard pages
      analyze/ cover-letter/ email/ settings/
      admin/
        layout.tsx                 # Calls requireAdmin() (notFound() if not admin)
        page.tsx                   # User access management table
        _actions.ts                # Server Actions: approve/reject users
        _components/               # Admin-only client components
    api/webhooks/clerk/route.ts    # Clerk user.created/updated/deleted webhook
    sign-in/ sign-up/              # Clerk hosted UI catch-all routes
    pending/ rejected/             # Holding pages for non-approved users
    unauthorised/
  lib/
    auth-helpers.ts                # requireApprovedUser(), requireAdmin(), getCurrentUser()
    anthropic.ts                   # Anthropic SDK singleton (server-only)
    db/
      connect.ts                   # MongoDB connection singleton (import this, not db.ts)
    models/                        # Mongoose models: User, Job, Resume, Document, Plan, Subscription, Usage
```

## Access Control Flow

New users land in `status: "pending"` (set by Clerk webhook or lazily in `requireApprovedUser()`). Admins approve/reject from `/admin`. Status gates:

- **pending** → redirected to `/pending`
- **rejected** → redirected to `/rejected` (can re-request access via Server Action)
- **approved** → enters `(dashboard)` route group
- **isAdmin: true** → can also access `/admin` (inside the dashboard group; non-admins get `notFound()`)

`proxy.ts` only enforces Clerk session presence (redirects unauthenticated users to sign-in). Business-level status checks happen in `src/lib/auth-helpers.ts`.

## Project Conventions

- MongoDB connection: import `connectDB` from `@/lib/db/connect` (not `@/lib/db`). Both files exist; `db/connect.ts` is the canonical one used by all current code.
- MongoDB models live in `src/lib/models/` (User, Job, Resume, Document, Plan, Subscription, Usage). Use the singleton pattern (`mongoose.models.X ?? mongoose.model(...)`) to avoid recompilation in dev.
- **Plan/Subscription/Usage** — Plans (seeded via `npm run seed:plans`) define feature limits by `key` (e.g. `"personal"`). Each approved user gets one Subscription (upserted in `approveUser` action). Usage tracks AI generation counts per month via `period` field (`"YYYY-MM"` format). `src/lib/usage-helpers.ts` contains helpers for reading/incrementing usage.
- Every API route and Server Action must call `auth()` from `@clerk/nextjs/server` and return 401 if no `userId`. All Mongo queries must filter by `userId`.
- Anthropic SDK is only ever imported in server code. Client is instantiated in `src/lib/anthropic.ts`.
- Use Server Actions for mutations where possible; use route handlers (`route.ts`) only for streaming responses or third-party inbound POSTs (e.g. Clerk webhooks).
- shadcn components are added via `npx shadcn@latest add <name>`. Do not hand-write components that shadcn already provides.
- Forms use `react-hook-form` + `zod` + `@hookform/resolvers`. Validation schemas live next to the form in a `schema.ts` file.
- Environment variables required: `MONGODB_URI`, `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`.
- Server Components inside `src/app/(dashboard)/**` can assume the user is approved (layout enforces this). Routes outside that group must call `requireApprovedUser()` or `requireAdmin()` themselves.
