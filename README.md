# Job Hunt

A full-stack AI-powered job application tracker. Track every application through a Kanban pipeline, generate tailored resumes and cover letters with Claude, and stay on top of your job search — all in one place.

---

## Features

**Job Tracker**
- Add jobs manually or paste a job posting for AI-assisted quick import (extracts company, role, location, salary, and description automatically)
- Kanban pipeline view with drag-and-drop status management
- Table list view for scanning at a glance
- Soft-delete with a trash bin and restore support

**Resume Management**
- Upload PDF or DOCX resumes and extract the text automatically
- Store multiple resume versions and set a default
- Plan-gated limits enforced at both the UI and server action layer

**AI Generation**
- Tailored resume generation — rewrites your resume to match a specific job description
- Cover letter generation — produces a targeted, professional cover letter
- JD analysis — structured breakdown of the job description with key requirements and fit signals
- All AI usage is metered in USD against a monthly budget; admins can set per-user overrides

**DOCX Export**
- Export AI-generated content as a DOCX file
- Template priority: user-uploaded template → admin global template → generic fallback
- Template-driven formatting preserves the original run styles (fonts, sizes, bold, etc.)
- Slot-fill output is cached per document so re-exports are instant unless the template changes

**Dashboard & Analytics**
- Application funnel chart, stat cards, and weekly activity view
- Stale application alerts
- Weekly goal widget

**Admin Panel**
- Approve, reject, and manage user access
- Set or clear per-user AI spend overrides
- Toggle admin privileges
- Full paginated audit log of every admin action
- Real-time email notification when a new user signs up and is waiting for approval

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Radix UI |
| Auth | Clerk |
| Database | MongoDB via Mongoose |
| AI | Anthropic Claude (via `@anthropic-ai/sdk`) |
| Drag and Drop | dnd-kit |
| Forms | react-hook-form + Zod |
| DOCX generation | docx, mammoth |
| PDF extraction | unpdf |
| Markdown rendering | react-markdown, remark-gfm |
| Toast notifications | sonner |
| Theming | next-themes |
| Webhook verification | svix |
| Email notifications | Resend |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A MongoDB database (MongoDB Atlas free tier works)
- A [Clerk](https://clerk.com) application
- An [Anthropic](https://console.anthropic.com) API key
- A [Resend](https://resend.com) account (free tier works)

### Environment Variables

Create a `.env.local` file in the project root:

```env
MONGODB_URI=your_mongodb_connection_string
ANTHROPIC_API_KEY=your_anthropic_api_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_WEBHOOK_SIGNING_SECRET=your_clerk_webhook_signing_secret

# Email notifications (Resend)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

> `RESEND_FROM_EMAIL` can be `onboarding@resend.dev` for testing (delivers only to your Resend account email). For production, verify a sending domain in Resend and use `noreply@yourdomain.com`.

### Installation

```bash
npm install
```

### Database Setup

Seed the subscription plans (required before any user can access the dashboard):

```bash
npm run seed:plans
```

### Clerk Webhook

The app syncs Clerk user events (`user.created`, `user.updated`, `user.deleted`) into MongoDB. Configure a webhook in the Clerk dashboard:

1. Go to **Clerk Dashboard → Webhooks → Add Endpoint**
2. Set the URL to `https://<your-domain>/api/webhooks/clerk`
3. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
4. Copy the **Signing Secret** and set it as `CLERK_WEBHOOK_SIGNING_SECRET`

For local development, use [ngrok](https://ngrok.com) to expose port 3000 and register the ngrok URL as the endpoint.

### Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The first user to sign up will be in `pending` status. Promote yourself to admin:

```bash
npm run bootstrap:admin
```

Then approve yourself (and other users) from the `/admin` panel.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (Turbopack, port 3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run bootstrap:admin` | Promote a user to admin by email |
| `npm run seed:plans` | Seed Plan documents into MongoDB |
| `npm run backfill:subscriptions` | Create Subscription records for existing approved users |
| `npm run test:generate` | Run a one-shot AI generation test against your local env |

---

## Access Control

New users land in `pending` status after sign-up. Admins approve or reject access from `/admin`. The flow:

```
sign-up → pending → (admin approves) → approved → dashboard
                  → (admin rejects)  → rejected  → can re-request
```

Admin routes are inside the `(dashboard)` group and additionally gate on `isAdmin: true` — non-admins receive a 404.

---

## AI Quota

AI usage is tracked in USD per calendar month against each user's plan limit. Admins bypass the quota entirely and can set per-user custom limits from the admin panel.

---

## Project Structure

```
src/
  proxy.ts                    # Clerk auth proxy (Next.js 16 replacement for middleware.ts)
  app/
    layout.tsx                # Root layout
    page.tsx                  # Public landing page
    (dashboard)/              # Protected route group
      layout.tsx              # Enforces approved user + plan check
      DashboardShell.tsx      # Sidebar + mobile nav
      jobs/                   # Job tracker (list, kanban, detail, create, edit, trash)
      resume/                 # Resume management (list, create, edit)
      tracker/                # Dashboard analytics
      admin/                  # Admin panel (users, audit log)
    api/
      webhooks/clerk/         # Clerk user sync webhook
      generate/               # AI generation (streaming + non-streaming)
      generate/export/        # DOCX export
      jobs/parse/             # Quick import — AI job posting parser
      resume/parse-pdf/       # PDF text extraction
      resume/parse-docx/      # DOCX text extraction
      admin/templates/        # Global DOCX template management
  lib/
    auth-helpers.ts           # requireApprovedUserWithPlan(), requireAdminWithPlan()
    actions.ts                # defineAction() / defineAdminAction() wrappers
    usage.ts                  # AI quota: checkBudget(), addSpend(), calculateCost()
    anthropic.ts              # Anthropic SDK singleton (server-only)
    prompts.ts                # All prompt builders
    db/connect.ts             # MongoDB connection singleton
    models/                   # Mongoose models
    repositories/             # All database access (one file per model)
    export/                   # DOCX export pipeline
```

---

## Deployment

The app is designed for [Vercel](https://vercel.com). Set all environment variables from the section above in the Vercel project settings, then push to your connected branch. The production URL is resolved automatically via `VERCEL_PROJECT_PRODUCTION_URL` — no extra config needed for admin notification links to work.

After the first deployment, run the seed script once against your production database:

```bash
MONGODB_URI=your_production_uri npm run seed:plans
```

### Admin Recovery

If you ever get locked out of the admin panel:

```bash
npx tsx scripts/bootstrap-admin.ts your@email.com
```

Sets `status: "approved"` and `isAdmin: true` for that email. Safe to run multiple times.
