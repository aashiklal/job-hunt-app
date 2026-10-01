# Credits are the only limit a user can hit

A user's monthly credit allowance is the only thing that refuses an AI request. The USD
ceiling that sat underneath credits ([ADR 0006](./0006-credits-over-a-usd-backstop.md)) is
removed. Real cost is still recorded for every call.

## Why

The product promise is simple: a user gets their credits for the month, and only when those
are used up do they wait for the next month. The USD ceiling broke that promise. It could
refuse a user who still had credits left, with a message they could not act on, because it
measured something they never see.

It also protected less than it seemed. Every feature has a fixed credit price and a fixed
maximum output length, so credits already bound what one user can cost: typical use of the
500-credit plan is about $3 of real spend, and even a user who spent every credit on the most
expensive features at maximum length stays around $8, below the $12 plan price.

## What replaced the backstop

- **Pricing from worst cases, not just averages.** Two features could run well above the
  per-credit target on long outputs, which the ceiling used to absorb. Outreach messages went
  from 1 to 2 credits and LaTeX export from 2 to 3.
- **Monitoring instead of refusal.** Every call still writes a `UsageEvent` with its real
  cost, and `Usage.aiSpendUSD` still totals it per billing month
  ([ADR 0008](./0008-per-user-billing-month.md)). The admin margin view flags any
  account or feature running more than 1.5 times over the per-credit target, which is the
  signal to re-price.
- **Rate limits** per user and route stay, as protection against abuse rather than cost.
- **Admin overrides are in credits.** An admin can give one user their own monthly allowance
  (or unlimited) in place of the plan's.

A plan with no credit allowance gives its users none, rather than a guessed number, so a
configuration mistake refuses loudly instead of handing out the paid allowance.

## Consequences

The worst-case cost per user is now bounded only by credit prices and output limits. If a
prompt grows or the model changes, nothing refuses automatically; the margin view is where
it shows up, and `CREDIT_COSTS` in `src/lib/credits.ts` is where it is fixed.

The reservation design from [ADR 0002](./0002-usd-metered-quota-with-reservations.md) still
applies, now to credits alone: the full price is charged in one conditional update before
the call, so concurrent requests cannot overshoot the allowance, and refunded if the call
fails.
