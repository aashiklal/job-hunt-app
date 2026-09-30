# Repository layer with ESLint-enforced import boundaries

All Mongoose access goes through `src/lib/repositories/`, one module per model, and an
ESLint `no-restricted-imports` rule makes importing a model from anywhere else a build
error. The allowed exceptions are the models themselves, the repositories, `auth-helpers.ts`,
`usage.ts`, and test files.

## Why

A Next.js App Router codebase makes it trivially easy to query the database from a server
component, a server action or a route handler. Left alone, every one of those places grows
its own slightly different query, and the `userId` filter that scopes data to its owner
becomes something you have to remember rather than something the codebase enforces. Putting
every query behind a repository means there is exactly one place to check that scoping is
correct, and one place to change when a query needs an index.

A convention alone would not have held. The rule is what makes it real: the boundary is
checked on every commit rather than at review time, which is why it is still intact at
20k lines.

## Consequences

Repositories also own serialisation. Mongoose documents cannot cross into client components,
so each repository exports a plain-object projection (`toJobListItem`, `toResumeListItem`)
and callers pass those. This is why repository functions return typed plain objects rather
than documents.

Tests are exempt. Building fixture state through the repositories would mean testing the
repositories with themselves, and asserting on raw documents is often the point.
