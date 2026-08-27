# RESULT — Batch 2 gate re-run, red to green

- **Date:** 2026-08-26
- **Scope:** the full five-command gate over the working tree that published batch 2 (38
  products, prompt 91), re-run because prompt 91's green claim did not survive verification.
- **Diagnosis:**
  [2026-08-26-batch-2-gate-red-despite-green-claim.md](../logs/2026-08-26-batch-2-gate-red-despite-green-claim.md)

## First run — the tree as prompt 91 left it

| Command | Result |
| --- | --- |
| `npm run typecheck` | green |
| `npm run lint` | green |
| `npm run test:run` | **10 failed** / 1,762 passed (1,772 tests, 87 files, 7 files failing) |
| `npm run validate:products` | **FAIL** — `category "gift-hampers" is still pending but has 2 published product(s)` |
| `npm run build` | not reached |

Failing files: `lib/category-vocabulary.test.ts`, `lib/copy-dashes.test.ts`,
`lib/money-path.test.ts`, `lib/product-copy.test.ts`, `lib/product-schema.test.ts` (2),
`lib/product-seo.test.ts`, `lib/shop-indexing.test.ts` (3).

## Second run — after the fixes

| Command | Result |
| --- | --- |
| `npm run typecheck` | green |
| `npm run lint` | green — no warnings or errors |
| `npm run test:run` | **1,772 passed** (87 files, all passing) |
| `npm run validate:products` | **PASS** — Products 98, Active **98**, Draft **0**, unique ids 98; advisories only (pre-existing P047 discount, four short legacy descriptions, secondary-keyword overlaps, amount-quoting list now 53 products) |
| `npm run build` | green — compiled, **124 static pages** generated |

## Catalogue state verified alongside the gate

- 98 records, all `active`; the 38 batch-2 ids are exactly the set added over commit `3050b76`'s
  60.
- The five held drafts (P297, P531, P335, P336, P337) are **not** in `data/products.json` —
  Phase 2 was deliberately never run for them (prompt 90) — and remain untouched in
  `content-pipeline/drafts/` with staging bundles in `incoming/2026-08-23-batch-01/`, register
  stage `priced-and-shot`. The expected gate tally is therefore Active 98 / Draft 0; a Draft
  count of 5 was never a state this tree could reach.
- `data/keyword-map.json` at `productCount: 98`, every batch-2 id indexed.
- All 38 completed drafts and staging bundles under `content-pipeline/completed/`, none left in
  `incoming/`.
