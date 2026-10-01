# Offerstitch

A single job seeker's application pipeline: the roles they are pursuing and the documents
they generate for each one. One user, one search, no collaboration or sharing.

## Language

### The search

**Job**:
A specific role at a specific company that the seeker is pursuing or considering.
_Avoid_: Application, listing, posting, opportunity

**Status**:
Where a **Job** currently sits in the pipeline: `saved`, `applied`, `screening`,
`interview`, `assessment`, `offer`, `rejected`, `withdrawn`.
A Job can move from any Status to any other, including out of `rejected` and `withdrawn`;
mis-drops and reopened roles both need it.
_Avoid_: Stage, phase, step

**Application**:
A **Job** that has left `saved`. Not a separate record: applying is a status change.
_Avoid_: Submission

**Pipeline**:
The set of a seeker's active **Jobs** arranged by **Status**, shown as the kanban board.
_Avoid_: Board, funnel (see below), workflow

**Funnel**:
The count of **Jobs** at each **Status**, shown on the tracker as an analytic. The
**Pipeline** is the working surface; the **Funnel** is the measurement of it.

**Stale application**:
A **Job** still in `applied` whose record has not been touched for 14 days. Derived on
read, never stored.

### Documents

**Resume**:
A base CV the seeker wrote and stores themselves, as plain text. Uploaded as PDF or
DOCX and extracted, or typed in. Input to generation, never output of it.
_Avoid_: CV, profile

**Default resume**:
The one **Resume** used for generation when the seeker does not pick another. Exactly
one per seeker while any exists.

**Document**:
A single piece of AI-generated output belonging to one **Job**, carrying a type
(`resume`, `cover_letter`, `jd_analysis`, `interview_prep`, and the outreach types).
_Avoid_: Generation, output, artifact

**Tailored resume**:
A **Document** of type `resume`. Distinct from a **Resume**, which is the seeker's own
input. See Flagged ambiguities.

**Template**:
A styling source a **Document** is rendered into on export. Two kinds: LaTeX templates
hardcoded in the source, and an admin-uploaded DOCX. Both are global to the installation,
never per-seeker.

### Access and spend

**Seeker**:
The person running a job search. Called a User in code, because that is also the Clerk
and database identity.

**Plan**:
A named tier defining a **Credit** allowance per **Period** (`monthlyCredits`), a resume cap
(`maxResumes`) and a price (`monthlyPriceUSD`). `-1` means unlimited. Admins edit plans
from the dashboard.

**Subscription**:
The link between one **Seeker** and their **Plan**. Carries the **Billing status** and
an admin's optional per-user **Credit** allowance, which replaces the plan's.

**Billing status**:
Where a **Subscription** stands financially, in Stripe's vocabulary: `active`,
`trialing`, `past_due`, `canceled`, `comped`. Only `active` counts as money collected;
`comped` is free access given on purpose, such as a **Demo account**. No payments exist
yet, so nobody is `active` today.

**Credit**:
The unit a **Seeker** sees and spends on AI features. Each feature has a fixed price in
credits set by its typical cost (a short outreach message is 2, a tailored resume is 6),
so a heavy feature cannot be run as cheaply as a light one. Known before the call,
unlike the USD cost. The only limit a **Seeker** can hit: they keep going until the
**Period's** credits are used up.
_Avoid_: Generation, token, quota (when talking to users)

**Usage**:
One **Seeker's** totals for one **Period**: **Credits** used and the real USD spent.

**Usage event**:
One AI call as it happened: the feature, model, token counts, real USD cost and
**Credits** charged. The record behind every cost and margin figure an admin sees.

**Period**:
A **Seeker's** billing month: from their anchor day to the same day next month, at
00:00 UTC. The anchor is the day they were approved (their **Subscription** was created);
a day past the end of a short month is clamped to its last day, so the 31st resets on
Feb 28 and then Mar 31. Keyed on **Usage** by its start date, `YYYY-MM-DD`. Records from
before per-user periods use the calendar month, `YYYY-MM`. Admin "this month" figures are
calendar months, not **Periods**. See `docs/adr/0008-per-user-billing-month.md`.
_Avoid_: Cycle (in user-facing copy, say "billing month")

**Reservation**:
A **Credit** price charged against a **Seeker** atomically before a model call, and
refunded if the call fails, so the allowance holds under concurrent requests.

**Margin**:
What an account pays against what it costs to serve, from its **Plan** price, its
**Billing status** and its **Usage events**. Shown to admins; only `active`,
`trialing` and `past_due` accounts count toward it.

**Demo account**:
A private, temporary **Seeker** created for one visitor when they click "Try the live demo",
seeded with sample data and deleted after 2 hours, or straight away if the visitor ends it
(exiting, or choosing to sign up or sign in). AI requests are served from fixtures, so it
spends no money, but each is charged the live feature's **Credits** against the demo's own
60-credit allowance, so the balance behaves as it does for a real **Seeker**. Full read and write within per-demo creation caps, never
visible to another visitor, and never listed among real users for admins.
_Avoid_: Demo user, guest, trial (a trial is a **Billing status**)

## Relationships

- A **Seeker** has many **Jobs** and many **Resumes**
- A **Seeker** has exactly one **Subscription**, which names exactly one **Plan**
- A **Seeker** has one **Usage** record per **Period**, and one **Usage event** per AI call
- A **Job** has many **Documents**, at most one current per type
- A **Document** belongs to exactly one **Job** and records which **Resume** it was generated from
- A **Template** belongs to the installation, not to a **Seeker**

## Example dialogue

> **Dev:** "When someone generates a tailored resume, does that update their **Resume**?"
>
> **Domain expert:** "No. Their **Resume** is what they wrote, it is the raw material. What
> comes out is a **Document** attached to that **Job**. If generation could overwrite the
> **Resume** you would lose the original after one bad generation."
>
> **Dev:** "So if they generate twice for the same **Job**?"
>
> **Domain expert:** "The second replaces the first. There is one current **Document** per
> type per **Job**. Nobody wants a list of seven cover letter drafts."
>
> **Dev:** "What makes an **Application** distinct from a **Job**?"
>
> **Domain expert:** "Only the **Status**. Everything in `saved` is a **Job** you are thinking
> about. The moment it leaves `saved` it is an **Application**, and it starts counting
> toward the response rate."

## Flagged ambiguities

- **"Resume" meant two different things.** The seeker's stored base CV, and the AI-generated
  tailored version. Resolved: **Resume** is only ever the seeker's own input. The generated
  one is a **Document** of type `resume`, referred to as a **tailored resume**. The code
  reflects this — they are separate models with separate repositories.

- **"Job" was used for both a tracked role and a submitted application.** Resolved: a
  **Job** is the record; an **Application** is a **Job** past `saved`. There is no separate
  entity, only a **Status** boundary. Response-rate maths depends on this line.

- **"Pipeline" and "funnel" were used interchangeably.** Resolved: the **Pipeline** is the
  kanban working surface; the **Funnel** is the per-status count shown as an analytic.

- **"Limit" meant different caps.** Resolved: the **Credit** allowance is the only AI limit
  and uses a **Reservation**; resource caps like `maxResumes` are counts checked at both the
  page and the action. There is no dollar limit: real spend is recorded, never enforced.

- **"Spend" meant both credits and dollars.** Resolved: talk to users only in **Credits**.
  Dollars are the real cost, shown to admins in **Usage events** and **Margin**, and never
  to a **Seeker**. "Budget" and "quota" are retired words: they belonged to the old dollar
  limit.

- **"User" versus "seeker".** The domain actor is a **Seeker**; `User` in code is the
  identity record shared with Clerk. Admins are `User`s who are not acting as **Seekers**.
