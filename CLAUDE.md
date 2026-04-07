# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # Start dev server (Turbopack, port 3000)
npm run build     # Production build (Turbopack)
npm run start     # Start production server
npm run lint      # Run ESLint directly (eslint)
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
  app/
    layout.tsx   # Root layout — Geist font, sets html/body shell
    page.tsx     # Home route (placeholder)
    globals.css  # Global styles
public/          # Static assets
```

Clerk provider and MongoDB connection setup are not yet implemented.

## Project Conventions

- All MongoDB models live in `src/lib/models/` as Mongoose schemas with TypeScript interfaces. Use a singleton pattern to avoid model recompilation in dev.
- MongoDB connection helper lives at `src/lib/db.ts` and caches the connection on `global` for hot-reload safety.
- Every API route under `src/app/api/**` and every Server Action must call `auth()` from `@clerk/nextjs/server` first and return 401 if no `userId`. All Mongo queries must filter by `userId`.
- Anthropic SDK is only ever imported in server code (route handlers, server actions, server components). Never in a client component. The client is instantiated in `src/lib/anthropic.ts`.
- Use Server Actions for mutations where possible; use route handlers (`route.ts`) only when streaming responses or when a third party needs to POST in (e.g. Clerk webhooks).
- shadcn components are added via `npx shadcn@latest add <name>`. Do not hand-write components that shadcn already provides.
- Forms use `react-hook-form` + `zod` + `@hookform/resolvers`. Validation schemas live next to the form in a `schema.ts` file.
- Environment variables required: `MONGODB_URI`, `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`.
