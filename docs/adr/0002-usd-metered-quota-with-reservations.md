# USD-metered quota, enforced by reservation rather than a spend check

AI usage is capped in dollars per calendar month, not in number of generations. The cap is
enforced by atomically reserving an estimated cost before the model call and reconciling to
the true cost afterwards, rather than by reading current spend and comparing it to a limit.

## Why meter in dollars

Generation counts do not correspond to cost. A cover letter and a full interview-prep
breakdown differ by an order of magnitude in tokens, and the ratio changes whenever a prompt
is edited or a model is swapped. Counting generations means the real exposure drifts silently
every time someone touches `prompts.ts`. Metering the actual quantity being spent means the
limit keeps meaning the same thing.

The cost is that the user-facing number is less legible: "$1.40 of $5.00" is vaguer than
"7 of 20 generations". That was judged the better trade, because the limit exists to bound
spend and nothing else.

## Why reservations

The obvious implementation reads spend, compares it to the limit, calls the model, and
records the cost on success. That is a check-then-act race with a multi-second window. Under
concurrency every caller reads the same stale total, every caller passes, and the ceiling
only holds for serial traffic. This is not theoretical: `src/lib/usage.concurrency.test.ts`
reproduces it, and against the previous implementation twenty parallel requests drove a $5.00
budget to $14.99.

`reserveSpend()` performs the check and the charge as one conditional `findOneAndUpdate`, so
exactly one caller can win at the threshold. `reconcileSpend()` corrects the estimate to the
real cost once token counts are known; `releaseSpend()` refunds it when the call fails.

## Considered and rejected

**A MongoDB transaction around the check and the write.** Correct, but it would hold a
transaction open for the duration of the model call, and it requires a replica set. The
atomic update achieves the same guarantee without either.

**Rate limiting alone.** It bounds concurrency in practice without fixing the invariant. It
is worth having, and `src/lib/rate-limit.ts` does it, but as defence in depth rather than as
the spend control.

## Consequences

The estimate is deliberately pessimistic (`maxTokens` for both input and output), so a user
near their limit may be refused slightly early. Over-reserving is corrected downward within
seconds; under-reserving is what lets concurrent calls overshoot.

Reconciliation failures are logged rather than thrown. The API call has already succeeded and
the caller is entitled to its result; the cost is an over-charge equal to the unreconciled
reservation, which is the safe direction to fail in.
