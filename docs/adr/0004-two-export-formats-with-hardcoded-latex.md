# Export offers LaTeX from hardcoded templates alongside template-driven DOCX

`GET /api/documents/[id]/export` serves two formats from one route, chosen by a `format`
query parameter, and only for `resume` and `cover_letter` documents.

- **`format=tex`** renders the document's structured JSON into a LaTeX source file using
  templates hardcoded in `src/lib/export/to-latex.ts`. Output is cached on the Document.
- **`format=docx`** (the default) renders into an admin-uploaded DOCX template, reusing that
  file's own styles and run-level formatting, and falls back to a generically built DOCX when
  no template exists.

## Why LaTeX, and why hardcoded

A tailored resume is judged partly on how it looks, and a generically generated DOCX looks
generated. LaTeX produces typographically good output from a structured source, and handing
the seeker a `.tex` file gives them something they can actually edit and recompile rather
than a binary they must fight.

The templates are compiled into the source rather than uploaded because per-template
management was tried and removed. Curating a LaTeX preamble is an infrequent, high-skill task
that produced an empty picker for every user who was not going to do it. Two good baked-in
templates serve everyone better than an empty slot each.

## Why the DOCX path survives

Not everyone wants LaTeX, and recruiters still ask for Word files. The DOCX branch keeps the
template machinery — theme analysis on upload (`analyze-docx-theme.ts`,
`extract-docx-styles.ts`, `extract-docx-structure.ts`), a style-role mapping, and a
pixel-width budget in `pixel-theme-contract.ts` so poured-in content does not overflow the
layout. A reader encountering the size of `src/lib/export/` will reasonably wonder why it is
this large; that budget is why.

## Consequences

**Three code paths, all live.** LaTeX, admin-templated DOCX, and generic DOCX. The generic
fallback in `to-docx.ts` is not dead code — it runs whenever no admin template is uploaded,
and the response marks it with `X-Template-Fallback: generic`.

**Export depends on `structuredContent`, not on `content`.** The LaTeX path re-validates the
stored JSON against the zod schema and returns 422 asking the user to regenerate if it does
not parse. Documents generated before a schema change are therefore not exportable to LaTeX.
The DOCX path is more forgiving because it can fall back to the markdown in `content`.

**The LaTeX cache is keyed on staleness, not on content.** `latexBodyCache` is used only
while `latexBodyCachedAt` is newer than the Document's `updatedAt`. Cache writes are
fire-and-forget: a failed write is logged and the export still succeeds.

Adding a new exportable type means extending the type guard in the route, adding a LaTeX
template, and teaching the DOCX theme analyzer about its block structure.
