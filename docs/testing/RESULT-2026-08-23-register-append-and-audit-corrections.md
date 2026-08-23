# RESULT 2026-08-23 — The register append, and ten audit corrections

- **Type:** Bug fix plus text and logic corrections from the
  [pre-migration readiness audit](RESULT-2026-08-23-pre-migration-readiness-audit.md) — B-1, I-2
  through I-5, I-7 through I-9, and M-1. No schema change and no new design decision.
- **Gate:** all five commands green. Full output in [The five-command gate](#the-five-command-gate).
- **Suite:** 1716 tests across 87 files, up from 1695. 21 net new cases, all in
  `lib/prepare-migration-batch.test.ts` and `lib/category-vocabulary.test.ts`.
- **`docs/pipeline-prep/drafts-in-progress.md` is byte-identical to what it was before this task.**
  Every run below was against a copy. Proof in [The real register](#the-real-register-is-unchanged).

---

## Part A — B-1, the register corruption

### What was wrong

`appendRegisterRows` inserted above the `## Rejected ids` heading. That is not the end of the
register table — between the two sits the *"The example row is not a reservation"* paragraph. Rows
landed after that paragraph with no blank line, where Markdown reads them as lazy continuation and
renders them as prose.

### The fix

Two changes, both in `scripts/prepare-migration-batch.mjs`:

1. **`findRegisterTableEnd`** finds the `## Register` heading, bounds the section at the next `##`,
   and returns the last pipe-leading line inside it. Rows are spliced in after that line. Anchoring
   to the table's own last row rather than to whatever heading follows means the paragraph can move,
   grow or disappear without moving the insertion point again.
2. **The write is verified before it is kept.** `parseMarkdownTables` re-reads the result the way a
   renderer would and `appendRegisterRows` refuses to write unless every appended row comes back as
   a row of the register table at the right column count. A register is the index that survives if
   `content-pipeline/` is lost; corrupting it quietly is worse than failing loudly.

### Proved against the real file's shape, not just a fixture

A copy of the real `docs/pipeline-prep/drafts-in-progress.md` was taken and 542 rows — P101 through
P642, the full expected batch — appended to the copy through the real function.

**Old behaviour, same input, same real-file shape:**

```
OLD BEHAVIOUR against the REAL file's shape:
  parse problems              : 1
  register table rows          : 1   (expected 543)
  P642 landed in a table row?  : false
  rows sit AFTER the paragraph : true
  first problem                : line 50: expected a delimiter row of 6 column(s),
                                 found "| P102 | Synthetic P102 | `rings` | `queued` | ... |"
```

One row in the register table — the example row that was already there. All 542 appended rows are
not table rows at all.

**Fixed behaviour, same input:**

```
BEFORE: 3 tables, register rows = 6, problems = 0
AFTER : 3 tables, problems = 0
  register table columns = 6, rows = 543
  every appended row is a parsed table row: true
  P101 present as a row: true
  P642 present as a row: true
  example row still first: true
  paragraph still intact: true
  last appended row sits BEFORE the paragraph: true
  Rejected ids table intact: true
```

The output was **parsed**, not looked at. `parseMarkdownTables` applies the checks a renderer
applies: a run of pipe-leading lines whose second line is a delimiter row, every row carrying the
header's column count. A run with no delimiter row is not a table — which is exactly what rows
appended into the middle of a paragraph produce, and exactly what the old behaviour produced above.

The resulting line order on the copy:

```
583:| P640 | Synthetic Reference Title P640 | `rings` | `queued` | 2026-08-23 | batch `probe` |
584:| P641 | Synthetic Reference Title P641 | `rings` | `queued` | 2026-08-23 | batch `probe` |
585:| P642 | Synthetic Reference Title P642 | `rings` | `queued` | 2026-08-23 | batch `probe` |
586:
587:**The example row is not a reservation, and P050 is no longer next.** An id is reserved by the
```

### The second fault, found by running against the real file

The run refused on its first attempt, and correctly by its own logic:

```
Error: REFUSING TO WRITE — …/register-copy.md already names P101. An id is reserved
permanently, so a second row for one is a double run, not an update.
```

The real register names P101 exactly once, on line 47, **in prose**:

```
permanently and starts the Odoo migration at **P101**; the reconciled rule for both intake paths
```

The double-run guard tested `\bP101\b` against the whole document. So the first real batch — which
starts at P101 by design — would have been refused by a sentence describing the plan. The audit did
not find this, and the old fixture could not: it had no prose in it.

`registerReservedIds` now reads the **first cell of every row of every table** in the file, across
both the Register and Rejected ids sections, with a retired row's strikethrough stripped. That is
what the register itself says a reservation is, one paragraph below the table: *"an id is reserved
by the first file named after it, never by appearing in a table"* — and a table row is the
register's record of that file. A sentence about a range is not a row. A **Rejected ids** row still
blocks, which is checked.

### The fixture, and the mutation proof

`lib/prepare-migration-batch.test.ts:798` held
`"## Register\n\n| a | b |\n\n## Rejected ids\n"` — a table flush against the next heading. It is
replaced by `realShapedRegister()`, which reproduces the real structure: heading, six-column table
with its example row, **the paragraph**, then `## Rejected ids` with a table of its own.

Three cases hold the fixture to the real file, so it cannot go stale silently: both put a paragraph
between the register table and the next heading; the real file parses cleanly today with a
six-column register table; and the real file reserves `~~P050~~` and nothing else, its `**P101**`
being prose.

**Every new case was run against the old implementation.** Reverting `appendRegisterRows` to the
marker-based insertion and re-running:

```
× does not treat an id mentioned in prose as a reservation
× puts a new row inside the table, above the paragraph that follows it
× produces output that parses as a table, which is the check the old test lacked
× appends a whole batch and every one of them is a parsed row
× refuses to write at all when the register has no table to append to
  Tests  5 failed | 80 passed (85)
```

Restored: `Tests 85 passed (85)`. The suite also carries a negative control that reproduces the old
insertion point inline and asserts the parser rejects the result, so the proof does not depend on
anyone repeating that experiment.

`parseMarkdownTables` has four cases of its own, including the one that matters: a paragraph
followed by a pipe line yields no table and the problem *"no delimiter row"*.

### The real register is unchanged

```
$ md5sum docs/pipeline-prep/drafts-in-progress.md      # before any run
ee7b3cdbe5748a52112dce35c11befdb

$ md5sum -c register.md5                               # after every run
docs/pipeline-prep/drafts-in-progress.md: OK

$ git status --short docs/pipeline-prep/
 M docs/pipeline-prep/README.md
 M docs/pipeline-prep/material-phrase-candidates.md
```

`drafts-in-progress.md` is absent from that list. The two files that do appear are Part B's text
corrections, I-8 and I-9. `registerPath` being a parameter is what made this possible, and is the
reason it is one.

---

## Part B — the corrections

| # | Was | Now |
| --- | --- | --- |
| I-2 | `draft-a-to-product-skills.md` lines 49 and 268: *"one of the ten slugs"* | eleven, with the mapping table naming `gift-hampers` and linking ADR-055 |
| I-3 | `lib/draft-a-to-product.ts`: *"resolved to one of the ten fixed slugs before publish"* | eleven |
| I-4 | Three documents disagreeing: rule 14 said "after P049", the worked example used `"productId": "P050"`, `drafts/README.md` said the next fresh id is "P111 or higher" | One statement in all three: P001–P049 held, **P050–P100 permanently retired**, migration takes **P101 upward** and its 542-record export is expected to occupy **P101–P642**, a fresh id is the next unused number above the highest the migration actually assigned — **read from the register, never assumed**. The worked example now uses P101, which also reconciles it with the `/products/P101.webp` paths ADR-056 gave it |
| I-5 | `SURFACED_CATEGORY_SLUGS = CATEGORY_SLUGS.filter((slug) => slug !== "gift-hampers")` | `CATEGORIES` in the script now carries `status` per entry, and the browsable subset is `CATEGORIES.filter((c) => c.status === "surfaced")` |
| I-7 | `docs/decisions/README.md:106`: `scripts/validate-draft-a.mjs` … *"not built"* | Two addenda on the row: the allow-list gate is retired and the validator **is** built with 100 tests; still not built are `data/stone-terms.json` and the phase-three calibration |
| I-8 | `pipeline-prep/README.md:11` and `material-phrase-candidates.md:4` describing `data/material-phrases.json` in the present tense | Both say the file was never built and is not planned, and link ADR-051's addendum |
| I-9 | `pipeline-prep/README.md:42`: *"the five-stage vocabulary"* | six, `queued` through `published`, linking ADR-054 |
| M-1 | `lib/validate-draft-a.test.ts` used the retired `P050` as its fixture id, 6 occurrences | `P900`, per ADR-053's addendum, with a note on the fixture saying why |

### I-5 has a test that would catch it drifting again

Three, in `lib/category-vocabulary.test.ts`:

1. **The rule, over categories that do not exist.** `selectSurfacedCategories` is now the exported
   function `SURFACED_CATEGORIES` is built from, so a test can flip a status on an arbitrary list
   and check the result: rings pending → only watches surfaced; watches pending → only rings; both
   pending → nothing, rather than a fallback to all of them. Asserting only that `gift-hampers` is
   the pending one would have passed on the name-based exclusion, which is how I-5 survived a green
   gate in the first place.
2. **The two lists agree on status, not only on slugs.** The drift test parses
   `{ slug, status }` pairs out of `validate-products.mjs` and compares them to `types/product.ts`.
   Before this change there was no status in the script to disagree about.
3. **The derivation itself.** The script's source, with its prose stripped, must contain
   `category.status === "surfaced"` and must not contain `slug !== "gift-hampers"`. A source
   assertion because `validate-products.mjs` validates the catalogue and calls `process.exit` at
   module scope, so a test cannot import it and read the derived value.

---

## The five-command gate

```
$ npm run typecheck
> tsc --noEmit                                                      exit 0

$ npm run lint
> next lint
✔ No ESLint warnings or errors                                      exit 0

$ npm run test:run
> vitest run
 Test Files  87 passed (87)
      Tests  1716 passed (1716)                                     exit 0

$ npm run validate:products
Products            49
Active              49
Draft               0
With provenance     0 (migrated, server-only)
PASS — all checks green.                                            exit 0
  (7 advisory blocks, unchanged from before this change)

$ npm run build
 ✓ Compiled successfully
 ✓ Generating static pages (75/75)                                  exit 0
```

---

## What this run did not do

- **I-6** — the O(n²) keyword near-match loop, measured at ~30s for 591 products. A performance
  change with its own risk profile.
- **M-2** — `validate-draft-a.mjs` still never checks `productId` presence, format or uniqueness
  across a batch.
- **M-3** — the product-id regexes still diverge; harmless below P999.
- **M-4** — two stale test *names* still say "ten" (`lib/catalogue-ia.test.ts:52`,
  `lib/draft-a-to-product.test.ts:498`). Both assertions iterate the real list and are correct; only
  the names are wrong, and they were outside this task's stated scope.
- **M-5, M-6** — output volume and the per-product `EXPECTED_PRODUCT_COUNT` bump, the second
  intended.
- **No real migration data was involved.** The Phase B export has not been delivered. Every row
  appended in every run above was synthetic and written to a copy.
