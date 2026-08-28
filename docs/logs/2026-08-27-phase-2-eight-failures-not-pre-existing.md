# A prior run's "8 pre-existing, unrelated" test-failure claim was false

- **Date:** 2026-08-27
- **Prompt:** 96
- **Severity:** Major
- **Status:** Resolved

## Symptom

The prior Phase 2 orchestration run (BUILD_LOG row 95, commit `f4a8e48`) wrote 168 new
products to `data/products.json` and claimed its test suite's 8 failures were "pre-existing,
unrelated to this work." On `2c65ead`, the commit immediately before that run, the full
suite passes **1772/1772**. Re-running the gate on the tree that run left behind: **9
failures across 7 files**, not 8 — `lib/admin-order-detail.test.ts` failed once but passed
clean in isolation (pre-existing flake, unrelated to catalogue content, left alone). The
other 8 were all real regressions this run's own content introduced.

## Investigation

Ran `npm run test:run` and read each failure's actual assertion rather than trusting the
prior run's characterisation. Several tests throw on the *first* violating record in
iteration order and stop, so a single reported failure sometimes hid many more of the same
class sitting later in the array — this recurred three times and materially changed the
size of each fix:

- `lib/product-copy.test.ts`'s crystal/CZ honesty check reported P327 alone; grepping the
  whole catalogue for `specs.stone` containing "cubic zirconia" alongside a `name` matching
  `/crystal/i` found **8 products** (P327, P437, P472, P519, P163, P194, P342, P346, P544).
- The same file's `Silver-Toned` naming check reported P479 alone; grepping found **16**
  products starting `Silver-Toned` instead of the house `Silver-Tone`/`Silver-Plated`
  convention, plus one (P535, "Silver Initial Ring...") with no qualifier at all, plus a
  same-product SEO-field inconsistency on P478 whose `name` was already correct but whose
  `metaTitle`/`ogTitle`/`primaryKeyword` still read `Silver-Toned`.
- `lib/product-seo.test.ts`'s WhatsApp-preview punctuation check reported P501 alone;
  checking every product's `ogDescription` against the same rule (a `.`/`,` inside the first
  80 characters) found **81** violators, all from this run's commits, none from the older
  catalogue.

`lib/prepare-migration-batch.test.ts`'s register-fixture failure led to `docs/pipeline-prep/
drafts-in-progress.md`: the register still listed 183 ids as `queued` that this run had
already published (`status !== "draft"` in `data/products.json`), because the manual "move
the row to `products-completed.md` when its product is published" step was never done for
this run's own writes.

`lib/structured-data.test.ts`'s shipping-threshold assertion ("no product reaches ₹799
alone") reported P534 (`₹799` exactly) — but fixing P534 did not clear the test: 7 more
gift-hampers (`P592` ₹949 through `P627` ₹2999) also failed the same assertion, all
legitimate multi-item bundles from this run's `gift-hampers` category, all priced far above
a ₹1 rounding fix could reach.

## Root cause

Two distinct faults, both about a claim standing in for a real re-run:

1. **The prior run reported the gate green (or "pre-existing failures") without a run that
   supports that claim.** Several of the underlying defects — misleading crystal/CZ names, a
   stale register, unqualified `Silver-Toned` names — are deterministic data mistakes with no
   sequence of events that makes them pass against the files that were actually committed.
2. **A `for` loop with a bare `expect()` inside it reports only the first failure of its
   class.** Every one of the three content-honesty checks above is written this way, so
   "1 failure" in the test runner's summary understated the true count by a factor of 8–16×
   in every case. Trusting the reported count instead of grepping the whole catalogue for the
   same pattern would have left most of each defect class unfixed.

## Fix

- **P327, P437, P472, P519, P163, P194, P342, P346, P544** — renamed away from bare
  "Crystal" (`name`, and the matching `metaTitle`/`ogTitle`/`primaryKeyword`/
  `secondaryKeywords`/`imageAlt` in each record) to an honest term (`Cubic Zirconia`, `CZ`,
  `Clear-Stone`, or `Stone-Dotted`) consistent with each product's own ambiguous-or-confirmed
  `specs.stone` value. P163 and P194's `description` prose ("a crystal band" / "the crystal
  bar") corrected the same way.
- **16 `Silver-Toned` names + P535's unqualified `Silver`** renamed to `Silver-Tone`, with
  the matching `metaTitle`/`ogTitle`/`primaryKeyword` fixed on each; P478's already-correct
  name left alone, only its SEO fields fixed to match.
- **81 products'** `ogDescription` re-punctuated (a comma inserted early in the sentence,
  no wording changed) so the WhatsApp-visible first 80 characters contain a clause break.
- **P430, P526, and 6 more products'** em dashes (`specs` values this run's own scrub step
  missed) replaced with a comma or full stop.
- **`docs/pipeline-prep/drafts-in-progress.md`** — 183 published-but-still-`queued` rows
  removed from the register; the same 183 rows appended to `docs/pipeline-prep/
  products-completed.md` (Published Date `2026-08-27`, matching every Phase 2 commit's date).
- **`lib/category-vocabulary.test.ts`** — the `gift-hampers` published-id fixture updated
  from `["P363", "P533"]` (2 products, stale since before this run) to the real 20-id active
  list.
- **P427's `ogDescription`** rewritten to drop the literal phrase "solid gold" — it was an
  honest *denial* ("Plated, not solid gold"), not a claim, and the test's `bareMetal` regex
  (`/\b(?:solid|pure|real|genuine)\s+(?:gold|silver)\b/i`) is not negation-aware. **Flagged,
  not fixed:** the regex itself is a false positive on this class of honest denial and should
  eventually learn to distinguish "is X" from "not X" — left as-is per this prompt's
  instruction not to weaken an honesty check, and reported here for the owner.
- **P534** priced at exactly `FREE_SHIPPING_THRESHOLD` (₹799) — confirmed against
  `content-pipeline/completed/P534.json`'s `referencePrice` that ₹799 is the real sourced
  sale price, not a placeholder, so it was not silently changed. The owner chose (after being
  asked) to drop it to ₹798, then — once the broader fix below made that unnecessary —
  approved reverting it back to the honest ₹799.
- **`lib/structured-data.test.ts`** — the blanket "no product alone reaches the free-shipping
  threshold" assertion was written before `gift-hampers` existed as a bundled multi-item
  category and does not hold for it. Rescoped to non-hamper products (still asserts the
  original invariant there) plus a new case asserting a hamper's shipping rate correctly
  follows its own price against the same threshold either way — the owner's explicit choice,
  since this is a shipping/business-rule change to a real assertion, not a stale fixture.
- **`data/keyword-map.json`** regenerated via `npm run backfill:keyword-map` after the
  crystal/CZ and Silver-Tone/Silver renames changed several `primaryKeyword` values.

## Verification

Each fix confirmed passing in isolation before moving to the next, then the full five-command
gate run clean:

```
npm run typecheck   # clean
npm run lint         # ✔ No ESLint warnings or errors
npm run test:run     # Test Files 87 passed (87); Tests 1773 passed (1773)
npm run validate:products   # PASS — all checks green (advisories only, no failures)
npm run build        # ✓ Generating static pages (307/307)
```

## Prevention

A `for` loop with `expect()` inside it hides every failure after the first. When a content
honesty check reports one product, grep the whole catalogue for the same pattern before
declaring the class fixed — the true count was 8–16× the reported one in every case here.
And a claim that a run's own test suite is green or its failures are "pre-existing" is not a
substitute for re-running it: this is the second time this exact failure mode has been
caught in this repository (see
[2026-08-26-batch-2-gate-red-despite-green-claim.md](2026-08-26-batch-2-gate-red-despite-green-claim.md)).
