# Jobs are soft-deleted, resumes are not

`Job` carries a `deletedAt` timestamp and has a trash view with restore. `Resume` is deleted
outright, with no trash and no `deletedAt` field. The asymmetry is deliberate.

## Why

A deleted Job is expensive to lose and cheap to keep. It carries interview notes, contact
names, dates and generated Documents, none of which the user can reconstruct, and deletions
are usually housekeeping on a stale pipeline rather than a considered decision. Soft delete
with a trash bin matches that.

A Resume is the opposite. It is content the user still holds elsewhere, it is large, and the
usual reason to delete one is that it was superseded. A trash bin full of near-identical
resume drafts is clutter rather than safety.

## Consequences

Every active-record Job query must filter `deletedAt: null`, and it is a real trap: a query
that forgets it silently resurrects deleted Jobs into the pipeline. This is confined to
`repositories/jobs.ts` (see ADR 0001), which is the main reason the boundary is worth
enforcing.

Hard delete of a Job is permitted only on a record already in the trash, and it cascades to
that Job's Documents.

Deleting the default Resume promotes the most recently updated remaining one, so the
"exactly one default" invariant holds without the user being asked to fix it.
