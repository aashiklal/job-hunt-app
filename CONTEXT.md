# CONTEXT.md

What this app actually does today, written from the live code (May 2026), not from the original plans. CLAUDE.md is the operating manual for Claude (conventions, gotchas, command reference); this file is the product/architecture overview.

## What it is

A single-tenant, admin-gated job-hunt assistant for one user (and trusted invitees) to:

- Track job applications through a kanban + list UI with soft-delete trash.
- Manage multiple resumes and pick a default for AI use.
- Generate AI-tailored resumes, cover letters, JD analyses, interview prep, and a wide range of outreach messages from the job detail page.
- Compare offers side-by-side with an AI-written recommendation.
- Polish behavioral interview rough drafts into STAR format.
- Run a skills-gap analysis across every analyzed JD to produce a learning roadmap.
- Export resumes and cover letters to DOCX, optionally rendered against an admin-uploaded global template via a pixel-aware theming pipeline.

There is no PDF export, no per-user templates, no settings UI, and no public sign-up funnel. Everyone signs up via Clerk, lands in `pending`, and waits for an admin to approve them.

## User journey

1. New user signs up via Clerk hosted page; webhook creates a `User` doc with `status: "pending"`.
2. They land on `/pending` until an admin approves them from `/admin`.
3. Approved users enter `(dashboard)` and use every feature.
4. Admins additionally see `/admin`, `/admin/[userId]`, `/admin/audit`, and the template-manager card on `/admin`.
5. Rejected users see `/rejected` with a "request access again" action that flips status back to pending.

## Domain entities

All Mongoose-backed. Models live in `src/lib/models/`. Every read/write goes through `src/lib/repositories/` (enforced by ESLint).

- **User** - Clerk-synced. Has `status` (pending / approved / rejected), `isAdmin`, plus profile fields. Soft-state machine driven by webhook + admin actions.
- **Job** - Status pipeline: `saved -> applied -> screening -> interview -> assessment -> offer -> rejected | withdrawn`. Terminal states (`rejected`, `withdrawn`) can only re-enter at `saved`. Soft-deleted via `deletedAt`. See `src/lib/models/Job.ts` for `JobStatus`, `isValidTransition`, `InvalidTransitionError`.
- **Resume** - Markdown content + default flag. Plan-limited count. Hard-deleted (no trash); deleting the default auto-promotes the most-recently-updated remaining resume.
- **Document** - Every AI output is persisted here: `resume`, `cover_letter`, `jd_analysis`, `interview_prep`, and the outreach variants. Stores both structured JSON and rendered markdown. Holds the slot-fill cache used by the export pipeline.
- **Offer** - Compensation breakdown (base, equity, bonus, leave, location, level, notes). Used by the multi-offer comparison route.
- **StarStory** - Behavioral interview rough drafts. AI polish writes the STAR-formatted output back to the same record.
- **Subscription** - Per-user. Holds the active plan key plus optional admin-set custom limits (`customLimits.aiSpendLimitUSD`).
- **Usage** - Monthly USD AI spend keyed by `period: "YYYY-MM"`. 90-day TTL.
- **AuditLog** - Admin actions (approve, reject, set/clear limit, toggle admin). 90-day TTL.
- **Template** - Global, admin-only DOCX templates. Unique on `type` (`resume` or `cover_letter`). One template per type, no per-user templates.
- **Plan** - Feature flags + `aiSpendLimitUSD`. Seeded via `npm run seed:plans`. Some flags (`pdfParsingEnabled`, `pdfExportEnabled`, `docxParsingEnabled`) exist on the schema but are not enforced anywhere - keep until enforcement is wired in.

## Routes

All `(dashboard)` routes require approved + plan-bound user. `/admin/*` additionally requires `isAdmin`.

| Route | What it shows |
|---|---|
| `/` | Public landing page with live stats. |
| `/sign-in`, `/sign-up` | Clerk-hosted. |
| `/pending`, `/rejected`, `/unauthorised` | Status gates. |
| `/jobs` | Tabs: list view + kanban pipeline (drag-and-drop with `useOptimistic`). |
| `/jobs/new`, `/jobs/[id]/edit` | Create / edit forms. |
| `/jobs/[id]` | Detail page with AI generation panel (every generation type) and JD analysis panel. |
| `/jobs/trash` | Soft-deleted jobs; restore or hard-delete. |
| `/resume`, `/resume/[id]` | List + detail/edit. New form gated by plan limit. |
| `/offers`, `/offers/new`, `/offers/[id]` | Offer CRUD. List page hosts the compare panel. |
| `/star-stories`, `/star-stories/new`, `/star-stories/[id]` | Behavioral story CRUD; detail page has the polish action. |
| `/tracker` | Funnel stats, weekly activity chart, stale-app alerts, weekly goal (hardcoded at 5 - no settings UI yet). |
| `/admin` | User access table, audit log preview, template manager. |
| `/admin/[userId]` | Per-user plan controls + audit history. |
| `/admin/audit` | Full paginated audit log. |

## Server actions

All defined via `defineAction` / `defineAdminAction` in `src/lib/actions.ts`. Return `ActionResult<T>` (`{ ok: true, data }` or `{ ok: false, error }`). Never call `auth()` or `requireApprovedUserWithPlan()` inline.

- **jobs/_actions.ts**: `createJob`, `updateJob`, `setJobStatus`, `softDeleteJob`, `hardDeleteJob`, `restoreJob`.
- **resume/_actions.ts**: `createResume`, `updateResume`, `setDefaultResume`, `deleteResume`.
- **offers/_actions.ts**: `createOffer`, `updateOffer`, `deleteOffer`.
- **star-stories/_actions.ts**: `createStarStory`, `updateStarStory`, `deleteStarStory`.
- **admin/_actions.ts**: `approveUser`, `rejectUser`, `setUserCustomLimit`, `clearUserCustomLimit`, `toggleUserAdmin`.
- **rejected/_actions.ts**: `requestAccessAgain`.

## API routes

Route handlers exist for streaming, file uploads, third-party webhooks, and admin file ops. Everything else is a Server Action.

- `POST /api/generate` - The big one. Branches on `type`. Streams text for `resume` and `cover_letter`; returns structured JSON for everything else. Quota-gated (USD).
- `GET /api/documents/[id]/export` - DOCX export of a saved Document. Routes through the pixel-theme renderer if an admin template exists; falls back to generic DOCX otherwise. `X-Template-Fallback: generic` header signals the fallback.
- `POST /api/jobs/parse` - Quick import. Paste a job posting; AI extracts company / role / location / salary / description. Quota-gated.
- `POST /api/skills-gap` - Aggregates `jd_analysis` Documents across the user's jobs into a missing-skills + learning-roadmap response.
- `POST /api/offers/compare` - Compares two or more of the user's offers. Returns table + pros/cons + recommendation + negotiation hints.
- `POST /api/star-stories/polish` - Polishes a story's rough draft into STAR format.
- `POST /api/resume/parse-pdf` - PDF text extraction via `unpdf`. 5 MB limit.
- `POST /api/resume/parse-docx` - DOCX text extraction via `mammoth` (markdown output preferred over raw text). 5 MB limit.
- `POST /api/admin/templates` (upload, 10 MB) and `DELETE` - Admin-only template CRUD. On upload, runs theme analysis and caches `themeAnalysis`, `pixelThemeMap`, `styleRoleMap` on the Template doc.
- `POST /api/webhooks/clerk` - Clerk user.created / user.updated / user.deleted with Svix signature validation.

## AI features today

Active model: `claude-sonnet-4-5` for all generation. Export-time slot-fill: `claude-haiku-4-5-20251001` (cheaper, structured).

`POST /api/generate` accepts these `type` values (matches the Zod enum in the route):

1. `resume` - structured JSON via `buildStructuredResumePrompt`, persisted as a Document, streamed back as text.
2. `cover_letter` - same shape via `buildStructuredCoverLetterPrompt`.
3. `jd_analysis` - `{ summary, seniorityLevel, requiredSkills, niceToHaves, keywordsForResume, interviewLikelyFocus, redFlags }`.
4. `interview_prep` - `{ behavioral, technical, roleSpecific, cultureFit, questionsToAskThem }`.
5. `linkedin_note` - <=300 char connection note.
6. `linkedin_dm` - 60-100 word cold DM to recruiter.
7. `followup_email` - post-application follow-up.
8. `thankyou_email` - subject + body.
9. `linkedin_followup_dm` - <50 word follow-up DM.
10. `cold_email` - speculative outreach (subject + body).
11. `checkin_email` - check-in after silence.
12. `salary_negotiation` - counter-offer email.

Prompt builders for all of these live in `src/lib/prompts.ts`. Structured-JSON helpers are in `src/lib/ai.ts` (`callStructured`) and `src/lib/generated-documents.ts` (schemas + `generatedDocumentToMarkdown`).

## Export pipeline

Lives in `src/lib/export/`. The flow:

1. User hits `GET /api/documents/[id]/export`.
2. The route looks up the Document and the global Template for that type.
3. **Admin template present** -> `render-themed-docx.ts` renders against the template using `pixel-theme-contract.ts` (style-role mapping + pixel-width budget). This branch preserves run-level `rPr` formatting from the template paragraphs and aligns dates against tab stops. If `Document.docxSlotCache` is fresher than `Template.uploadedAt`, the AI slot-fill is skipped entirely.
4. **No template** -> `to-docx.ts` builds a generic DOCX from the Document's markdown. Response includes `X-Template-Fallback: generic`.

Supporting modules:

- `parse-markdown.ts` - markdown -> structured lines.
- `analyze-docx-theme.ts`, `extract-docx-structure.ts`, `extract-docx-styles.ts` - run on template upload.
- `map-pixel-theme.ts`, `map-styles-to-roles.ts`, `build-from-styles.ts` - feed the renderer.
- `from-template.ts` - older slot-fill path; still used by some flows.
- `template-data.ts` - shared types / helpers.

## Quota model

USD-based monthly cap, not generation-count-based.

- `Plan.aiSpendLimitUSD` is the budget.
- `checkBudget(userId, feature)` runs **before** the Anthropic call; throws `QuotaExceededError` (handled by `defineAction`).
- `addSpend(userId, feature, costUSD)` runs **after** success. For streaming routes, spend is recorded in the stream's close handler from the final `message_delta` token counts.
- `calculateCost(model, inputTokens, outputTokens)` consults the `MODEL_PRICING` table in `src/lib/usage.ts`. Update that table if Anthropic re-prices.
- Admins bypass the budget entirely.
- Per-user override: `subscriptions.setCustomLimit(userId, usd)` / `subscriptions.clearCustomLimit(userId)`.

Non-AI plan limits (e.g. `plan.maxResumes`) are enforced twice: in the `new/page.tsx` (redirect away from a form they cannot submit) and in the `_actions.ts` (guard against direct API calls). `-1` means unlimited.

## What is intentionally not built

- **No `/settings` route.** Weekly goal is hardcoded at 5 in `tracker/_components/weekly-goal.tsx`.
- **No PDF export.** DOCX only.
- **No per-user templates.** Templates are global and admin-only.
- **`Plan.pdfParsingEnabled`, `Plan.pdfExportEnabled`, `Plan.docxParsingEnabled`** are schema-only - never read.
- **No automated test runner.** `scripts/test-generate.ts` and `scripts/test-docx-export.ts` are manual smoke tests. The DOCX harness is fixture-driven against `tmp/fixtures/` (each fixture has `document.json`, `template-meta.json`, `template.docx`; harness writes `output.docx` + `output-document.xml` and runs structural assertions).

## Where to find things

| Concern | Location |
|---|---|
| Routes / pages | `src/app/(dashboard)/<feature>/` |
| Server actions | `src/app/(dashboard)/<feature>/_actions.ts` |
| API handlers | `src/app/api/**/route.ts` |
| Mongoose models | `src/lib/models/` |
| Data access | `src/lib/repositories/` |
| AI prompts | `src/lib/prompts.ts` |
| Structured-JSON helpers | `src/lib/ai.ts`, `src/lib/generated-documents.ts`, `src/lib/generated-document-blocks.ts` |
| Export pipeline | `src/lib/export/` |
| Auth gates | `src/lib/auth-helpers.ts`, `src/proxy.ts` |
| Quota / pricing | `src/lib/usage.ts` |
| Notifications | `src/lib/notify.ts` (Resend + optional Telegram) |
| One-shot scripts | `scripts/` (`bootstrap-admin`, `seed-plans`, `backfill-subscriptions`, `test-generate`, `test-docx-export`, `generate-cover-letter-template`, `dump-export-fixture`) |
| Operating instructions for Claude | `CLAUDE.md` |
