# Test Result: the eleventh category and the vocabulary/surfacing split — 2026-08-23

- **Plan:** none. This implements an already-made owner decision
  ([ADR-055](../decisions/ADR-055-category-vocabulary-and-surfacing.md)) and the cases are stated
  in the suite rather than in a separate plan.
- **Commit:** working tree at prompt 73, on `main` after `fc53c6b`
- **Environment:** local container. No env vars, no credentials, no network, no database.
- **Suite:** `lib/category-vocabulary.test.ts` — **20 cases, all passing**. Full suite
  **1656 passing across 86 files**.

## What was checked

| Group | Cases | Result |
| --- | --- | --- |
| The vocabulary is eleven slugs, `gift-hampers` included, with a label and a status | 5 | Pass |
| All four enumerations hold the same eleven and cannot drift apart | 4 | Pass |
| A `gift-hampers` draft passes `validateDraftA` and `validatePublishReadiness` cleanly | 3 | Pass |
| The category is valid data that reaches no shopper — nav, sitemap, `?category=`, catalogue | 8 | Pass |

The enumeration-drift cases read the two plain scripts' source for their declared arrays rather
than importing them, because `scripts/validate-products.mjs` validates the catalogue and calls
`process.exit` at module scope. They compare `types/product.ts`,
`scripts/validate-products.mjs`, `scripts/validate-draft-a.mjs`,
`scripts/prepare-migration-batch.mjs` and `scripts/generate-placeholders.mjs` against one
sorted list of eleven.

## The two guards, each proved by breaking it

`scripts/validate-products.mjs` now checks the vocabulary/surfacing gap in both directions. Both
were deliberately broken, observed to fail, and restored.

**A published product in a category that is still pending.** `P001`'s category was changed to
`gift-hampers` in a working copy of `data/products.json`:

```
Category distribution
  gift-hampers      1  (pending — not surfaced)

FAIL — 1 problem(s):
  - category "gift-hampers" is still pending but has 1 published product(s) —
    flip its status to "surfaced" in types/product.ts, or nobody can reach them
```

`data/products.json` was restored from a backup taken before the probe and confirmed byte-for-byte
identical with `git diff --quiet`.

**An empty category marked surfaced.** The script's `SURFACED_CATEGORY_SLUGS` filter was
temporarily widened to include `gift-hampers`:

```
FAIL — 1 problem(s):
  - category "gift-hampers" is surfaced but has no published products —
    its listing would render empty
```

Restored, and `npm run validate:products` returned to `PASS — all checks green`.

Without the first guard, `pending` would be a way to lose products silently. Without the second,
the eleventh category would ship as an empty nav entry, an empty home tile, an empty filter
checkbox and a crawlable sitemap URL with nothing behind it.

## Existing suites that changed, and why

Four assertions encoded "ten categories" as a fact about the whole list. Each was narrowed to the
list it was actually about rather than having its number bumped:

| File | Was | Now |
| --- | --- | --- |
| `lib/catalogue-ia.test.ts` | `CATEGORIES` has 10 | vocabulary 11, surfaced 10, and the nav reads the surfaced list |
| `lib/sitemap.test.ts` | lists all ten categories | lists every **surfaced** category, and asserts no pending one appears |
| `lib/product-status.test.ts` | publishes every category | publishes every **surfaced** category |
| `lib/prepare-migration-batch.test.ts` | `gift-hampers` queued **with** a warning | queued clean, warnings empty — the ADR-054 gap is closed |

The Stage 0 manifest case that needed a warning-carrying record was re-pointed at a
`knownStub: true` record, which is now the remaining source of a queued warning, and it asserts a
clean record alongside it so the two statuses are still distinguished.

## The gate

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass — no output |
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm run test:run` | Pass — 1656 tests, 86 files |
| `npm run validate:products` | `PASS — all checks green`; `gift-hampers 0 (pending — not surfaced)` in the distribution |
| `npm run build` | Pass — compiled, 75 static pages |

## What this does not show

- **No gift-hamper product has ever been validated by `validate-products.mjs`,** because no such
  product exists and [ADR-021](../decisions/ADR-021-all-real-catalogue.md) forbids inventing one to
  make a test pass. What is proved instead is that the slug is in that script's vocabulary (by
  source comparison), that a record carrying it fails no *category* rule (by the pending-category
  probe above, which failed on the surfacing rule and on nothing else), and that a Draft A object
  carrying it passes both draft validators outright.
- **Nothing about whether the `Product` shape suits a hamper.** Contents lists, per-item
  provenance and expiry are untouched, and arrive with the first real record.
