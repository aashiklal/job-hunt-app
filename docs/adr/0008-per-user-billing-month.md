# Credits reset monthly on each user's approval day

Credits used to reset for everyone at the start of each calendar month (UTC). They now reset
monthly on the day each user was approved: a user approved on the 14th resets on the 14th of
every month, at 00:00 UTC.

## Why

A calendar month treats users unequally. Someone approved on the 28th got three days of
credits before the first reset, and someone approved on the 2nd got almost a full month. A
period anchored to the user gives everyone a full month from the start, and it is how
subscription billing normally works (Stripe's default billing anchor is the signup date).

**Monthly rather than every 28 days.** A fixed 28-day cycle was considered. It gives 13
allowances a year against a price set per month (`monthlyPriceUSD`), about 8% more credits
than the plan is priced for, and the margin view would need to scale the price to 28 days.
A monthly period keeps "monthly" accurate in plans, prices and the margin view, so the
`monthlyCredits` / `monthlyPriceUSD` field names stay.

**Approval rather than signup.** New accounts wait in `pending` until an admin approves them,
and credits only start then. Anchoring to signup would shorten the first period by however
long approval took. The anchor is `Subscription.createdAt`, which approval creates; admins
without a subscription fall back to `User.createdAt`.

## How

- `getCycle(anchor, now)` in `src/lib/usage.ts` is pure. A day past the end of a short month
  is clamped to its last day per month, so an anchor on the 31st resets on Feb 28 and then
  Mar 31; it never drifts to the 28th.
- `Usage.period` is the period's start date, `YYYY-MM-DD`. Older records keep their calendar
  month key, `YYYY-MM`, as history. Both start with `YYYY-MM`, which the monthly cost chart
  groups by, so a period counts toward the month it started in.
- A reservation returns the period it charged, and refunds and recorded spend use it, so a
  call that straddles a reset settles in the period that paid for it.
- Platform figures ("AI spend this month") stay calendar months and are built from
  `UsageEvent` timestamps, because per-user periods do not line up across users.

## Consequences

On rollout, each user's first new-style period starts at zero. It shipped on October 1, right
after the last calendar reset, so nobody lost credits in practice.
