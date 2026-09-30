# Credits for users, with a USD ceiling underneath

> Partly superseded by [ADR 0007](./0007-credits-are-the-only-limit.md): the USD ceiling
> described here was removed and credits are now the only limit. The reasoning for credits
> over dollars and over flat generation counts still stands.

Users see and spend a monthly allowance of credits. Each AI feature has a fixed credit
price. A USD spend ceiling still exists underneath, enforced the same way as before, but it
is a backstop rather than the limit anyone is meant to reach. This partly reverses
[ADR 0002](./0002-usd-metered-quota-with-reservations.md), which chose dollars as the
user-facing unit.

## Why credits

Dollars were the honest unit for bounding cost but a poor one to show people. "$1.40 of
$5.00" invites counting pennies instead of judging value, and it exposes the cost basis to
anyone evaluating the product.

A flat count of generations was already rejected in ADR 0002 and that reasoning still holds:
a tailored resume costs roughly five times a short outreach email, so a resume-heavy user on
a flat plan costs five times a note-heavy one for the same money.

Weighted credits keep the property that mattered, cost tracking what people actually do,
while giving users a number they can plan with. The weights in `src/lib/credits.ts` are
derived from measured token usage at roughly 1 credit per $0.006, and the usage widget turns
a balance into "About 12 tailored resumes or 25 cover letters".

## Why keep the USD ceiling

A credit price is a prediction. If a prompt grows or a model changes, a feature can start
costing more than its weight assumes, and credits alone would not notice. The USD ceiling
bounds real spend regardless, so a mis-set weight costs margin rather than an open-ended
bill. The per-user admin override also still sets this ceiling.

## How it is enforced

`callMeteredStructured` / `callMeteredText` in `src/lib/ai-execution.ts` reserve credits
first, then the USD estimate, then call the model:

- `reserveCredits()` is one conditional `findOneAndUpdate` that only matches when the whole
  price fits, so the allowance can never be overshot, even by one concurrent call. Credits
  are exact, so nothing is reconciled afterwards; they are refunded if the call fails.
- The USD reservation works as described in ADR 0002: pessimistic estimate, reconciled to
  the true cost, refunded on failure.
- Every call writes a `UsageEvent` with the feature, model, tokens, real cost and credits
  charged.

Admins get an unlimited allowance. A plan without `monthlyCredits` falls back to an
allowance derived from its own USD ceiling, so an unconfigured plan can never be more
generous than it was already allowed to spend.

## Consequences

Two limits can refuse a call, with different messages: running out of credits is the normal
case, while hitting the USD ceiling means a weight needs re-deriving.

Because every call records both credits charged and real cost, the admin margin view can
flag accounts or features whose real cost per credit runs well above target (more than 1.5
times). That flag is the signal to adjust `CREDIT_COSTS`.
