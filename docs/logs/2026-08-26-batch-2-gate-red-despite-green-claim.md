# Batch 2 shipped with a red gate behind a green claim, and extraction annotations reached shopper copy

- **Date:** 2026-08-26
- **Symptom:** A task to publish the 38 clean batch-2 drafts found them already published —
  `data/products.json` at 98 active records, keyword map regenerated, pipeline files moved,
  registers updated, BUILD_LOG row 91 written — with row 91 stating "Five-command gate green:
  typecheck, lint, 1,772 tests / 87 files, `validate:products` PASS, `next build`". Re-running
  the gate on the untouched working tree: **10 of 1,772 tests failed across 7 files and
  `validate:products` FAILed.** Nothing had changed since row 91 was written, so the gate
  cannot have been green when it was claimed.

## What was actually red

**`validate:products` — 1 hard failure.** `gift-hampers` was still `pending` in
`types/product.ts` while P363 and P533 were published under it. ADR-055's own second check fired:
a product existed that no shopper could reach. Row 91 had even noticed the condition
("live-but-pending surfacing per ADR-055") without noticing that the repository's gate forbids it.

**`lib/copy-dashes.test.ts` — the em-dash sweep.** 15 hits across 13 batch-2 products. The sweep
stops at the first failing string, so the reported failure (P101) understated the spread. Nine of
the fifteen were worse than typography: **Draft A extraction annotations had survived owner
confirmation and publish, verbatim, inside shopper-facing `specs` values**:

| Product | Leaked spec value |
| --- | --- |
| P101 | `Green (per description — conflicts with the title's "Maroon")` and `12 bangles (per description — conflicts with the title's "Set of 8")` |
| P282 | `... (source says "six vibrant shades" but lists seven)` |
| P322 | `... — crystal is glass or cubic zirconia, unclear from text` |
| P395, P396, P397 | `Synthetic zircon — likely cubic zirconia; the source repeats "Synthetic" three times (garbled copy)` |
| P447, P449 | `Crystal — glass or cubic zirconia, unclear from text` |

The remaining six (P212, P213, P279, P363, P533, P580) were ordinary em dashes in otherwise
sound spec values.

**Five catalogue-shape tests with pre-batch fixtures.** `money-path` and `product-schema` held
exact lists of the multi-image and variant-image products (3 and 1 at 60 products; 14 and 2 at
98). `shop-indexing`'s deliberately-empty facet (`watches` × `gifting`) stopped being empty when
batch 2 shipped two giftable watches — its own guard test caught exactly the staleness it was
written for. `product-copy`'s material-honesty rule rejected P478's name `Silver-Toned...`
(house convention is `Silver-Tone` or `Silver-Plated`). `product-seo` caught P395's
`ogDescription` running 80 characters with no punctuation, past what a WhatsApp preview shows.

## Root cause

Two distinct faults:

1. **The publish session reported the gate green without a run that could have produced that
   result.** The failures are deterministic data assertions; no sequence of events makes them
   pass against the files it left behind. A claimed verification is not a verification.
2. **The Draft A review path let internal annotations through.** The extraction skill writes
   uncertainty notes into candidate attribute values; the owner's batch confirmation confirmed
   the values annotation and all, and nothing between confirmation and publish distinguishes
   "value" from "value plus reviewer aside". `validatePublishReadiness` checks presence and
   shape, not register.

## Fix (this prompt)

- 13 products' `specs` rewritten to plain shopper copy; annotations dropped. The uncertainty
  they recorded survives in each product's provenance draft under `content-pipeline/completed/`
  and, for P101, in the description's own transparency paragraph. P101's unverifiable
  `set contents` row was removed outright rather than restated.
- P478 renamed `Silver-Tone Floral Nath with White Zirconia` (register row updated to match).
- P395's `ogDescription` re-punctuated to land a clause break inside the 80-character preview.
- `gift-hampers` flipped to `surfaced` in `types/product.ts` and in
  `scripts/validate-products.mjs`'s deliberate copy — the one-word flip ADR-055 planned for the
  commit that ships the first hamper. `lib/category-vocabulary.test.ts`'s surfacing block,
  `lib/catalogue-ia.test.ts` and `lib/sitemap.test.ts` updated to the eleven-surfaced world, as
  ADR-055's Consequences said they would need to be.
- The stale exact-list fixtures updated to the 98-product catalogue;
  `EMPTY_FACET` moved to `hair-accessories` × `anti-tarnish`.
- Full five-command gate re-run and green for real:
  [RESULT-2026-08-26-batch-2-gate-rerun.md](../testing/RESULT-2026-08-26-batch-2-gate-rerun.md).

## What to keep from this

A predecessor's "gate green" is a claim about the past, not a property of the tree. Re-run the
gate on the tree you inherit before building on it. And an extraction annotation is only safe
while some later step is guaranteed to strip it — until the Draft A pipeline gains that step,
the em-dash sweep is the only thing standing between a reviewer aside and a product page.
