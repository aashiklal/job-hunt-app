# Job Hunt

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
A named tier defining limits, chiefly `aiSpendLimitUSD` and `maxResumes`. `-1` means
unlimited.

**Subscription**:
The link between one **Seeker** and their **Plan**, and the place an admin's per-user
override lives.

**Usage**:
One **Seeker's** accumulated AI spend in USD for one calendar month.

**Period**:
A calendar month in UTC, formatted `YYYY-MM`. The window a **Usage** total covers and
the interval after which spend resets.

**Reservation**:
Spend charged against a **Seeker** before a model call, on the estimate, and corrected
to the true cost afterwards. Exists so a spend limit holds under concurrent requests.

**Demo account**:
A shared public **Seeker** whose AI requests are served from fixtures and whose data is
restored nightly. Full read and write, no model spend.

## Relationships

- A **Seeker** has many **Jobs**, many **Resumes**, many **Offers** and many **STAR stories**
- A **Seeker** has exactly one **Subscription**, which names exactly one **Plan**
- A **Seeker** has one **Usage** record per **Period**
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

- **"Limit" was used for both spend and resource caps.** Resolved: spend caps are in USD
  per **Period** and enforced through a **Reservation**; resource caps like `maxResumes` are
  counts checked at both the page and the action. They share a **Plan** but nothing else.

- **"User" versus "seeker".** The domain actor is a **Seeker**; `User` in code is the
  identity record shared with Clerk. Admins are `User`s who are not acting as **Seekers**.
