# JobHunt

A single job seeker's application pipeline: the roles they are pursuing, the documents
they generate for each one, and the offers they end up weighing. One user, one search,
no collaboration or sharing.

## Language

### The search

**Job**:
A specific role at a specific company that the seeker is pursuing or considering.
_Avoid_: Application, listing, posting, opportunity

**Status**:
Where a **Job** currently sits in the pipeline: `saved`, `applied`, `screening`,
`interview`, `assessment`, `offer`, `rejected`, `withdrawn`.
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

### Offers and stories

**Offer**:
A compensation package received for a role, recorded separately from its **Job** so
several can be compared side by side.

**STAR story**:
A reusable behavioural interview answer in Situation-Task-Action-Result form, belonging
to the seeker rather than to any one **Job**. Holds a rough draft and optionally a
polished version.
_Avoid_: Anecdote, example, story

### Access and spend

**Seeker**:
The person running a job search. Called a User in code, because that is also the Clerk
and database identity.

**Plan**:
A named tier defining a monthly **Credit** allowance (`monthlyCredits`), a USD spend
ceiling (`aiSpendLimitUSD`), a resume cap (`maxResumes`) and a price (`monthlyPriceUSD`).
`-1` means unlimited. Admins edit plans from the dashboard.

**Subscription**:
The link between one **Seeker** and their **Plan**. Carries the **Billing status** and
the place an admin's per-user override lives (a USD ceiling, not a credit allowance).

**Billing status**:
Where a **Subscription** stands financially, in Stripe's vocabulary: `active`,
`trialing`, `past_due`, `canceled`, `comped`. Only `active` counts as money collected;
`comped` is free access given on purpose, such as a **Demo account**. No payments exist
yet, so nobody is `active` today.

**Credit**:
The unit a **Seeker** sees and spends on AI features. Each feature has a fixed price in
credits set by its typical cost (a short outreach message is 1, a tailored resume is 6),
so a heavy feature cannot be run as cheaply as a light one. Known before the call,
unlike the USD cost.
_Avoid_: Generation, token, quota (when talking to users)

**Usage**:
One **Seeker's** totals for one **Period**: **Credits** used and the real USD spent.

**Usage event**:
One AI call as it happened: the feature, model, token counts, real USD cost and
**Credits** charged. The record behind every cost and margin figure an admin sees.

**Period**:
A calendar month in UTC, formatted `YYYY-MM`. The window a **Usage** total covers and
the interval after which spend resets.

**Reservation**:
An amount charged against a **Seeker** atomically before a model call, so a limit holds
under concurrent requests. **Credits** are reserved exactly and refunded if the call
fails; USD is reserved on a pessimistic estimate and corrected to the true cost
afterwards.

**Margin**:
What an account pays against what it costs to serve, from its **Plan** price, its
**Billing status** and its **Usage events**. Shown to admins; only `active`,
`trialing` and `past_due` accounts count toward it.

**Demo account**:
A private, temporary **Seeker** created for one visitor when they click "Try the live demo",
seeded with sample data and deleted after 2 hours, or straight away if the visitor ends it
(exiting, or choosing to sign up or sign in). AI requests are served from fixtures, so it
spends no credits and no money. Full read and write within per-demo creation caps, never
visible to another visitor, and never listed among real users for admins.
_Avoid_: Demo user, guest, trial (a trial is a **Billing status**)

## Relationships

- A **Seeker** has many **Jobs**, many **Resumes**, many **Offers** and many **STAR stories**
- A **Seeker** has exactly one **Subscription**, which names exactly one **Plan**
- A **Seeker** has one **Usage** record per **Period**, and one **Usage event** per AI call
- A **Job** has many **Documents**, at most one current per type
- A **Document** belongs to exactly one **Job** and records which **Resume** it was generated from
- An **Offer** is recorded independently; it does not have to correspond to a **Job**
- A **STAR story** belongs to a **Seeker** and is deliberately not attached to any **Job**
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
> **Dev:** "And an **Offer** — that hangs off the **Job** in `offer` status?"
>
> **Domain expert:** "It is recorded separately. People get offers through routes that were
> never tracked as a **Job**, and the point of the **Offer** record is comparing packages
> against each other, not tracing where each came from."
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

- **"Limit" meant three different caps.** Resolved: the **Credit** allowance is the limit a
  **Seeker** sees and hits; the USD ceiling is a backstop underneath it in case a credit
  price is set too low; resource caps like `maxResumes` are counts checked at both the page
  and the action. All three live on a **Plan**; only the first two use a **Reservation**.

- **"Spend" meant both credits and dollars.** Resolved: talk to users only in **Credits**.
  Dollars are the real cost, shown to admins in **Usage events** and **Margin**, and never
  to a **Seeker**.

- **"User" versus "seeker".** The domain actor is a **Seeker**; `User` in code is the
  identity record shared with Clerk. Admins are `User`s who are not acting as **Seekers**.
