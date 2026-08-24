# Result: Phase 2 pilot batch — 11 real products written as drafts

- **Date:** 2026-08-24
- **Executed by:** Claude (agent), applying the owner's explicit pricing, image and
  risk-acceptance decisions to the pilot batch, then running the Phase 2 orchestration skill
  ([`.claude/skills/draft-a-to-product-skills.md`](../../.claude/skills/draft-a-to-product-skills.md))
- **Scope:** P106, P108, P109, P110, P115, P117, P118, P119, P120, P121, P122 — the
  duplicate-title "Rose Gold Plated American Diamond Ring" group from `2026-08-23-batch-01`.
  This is the first time Phase 2 has run on real data. Publishing is explicitly out of scope:
  every record landed as `status: "draft"` and `scripts/publish-product.mjs` was not run.
- **Related plans:** no single plan covers Phase 2 end to end;
  [RESULT-2026-08-23-content-pipeline-e2e.md](RESULT-2026-08-23-content-pipeline-e2e.md) is the
  synthetic rehearsal this run repeats on real data.

## What was applied before the run

1. **Pricing (owner decision).** `pricing.price` set to each product's reference price: ₹59
   for eight products, ₹99 for P109, P119 **and P121**. The task's tally said "nine at ₹59,
   two at ₹99", but P121's reference price is ₹99 in both its draft and its Stage 0 raw block;
   the governing rule "same as each product's reference price" was followed and the
   discrepancy recorded as KI-002 in
   [known-issues-post-publish.md](../pipeline-prep/known-issues-post-publish.md).
   `pricing.cost` was set to the ADR-040 placeholder (60% of price: ₹35 / ₹59), matching the
   49 existing records, pending real owner figures. `pricing.mrp` stayed null, so every record
   maps with `mrp = price` and shows no discount.
2. **Images (owner decision).** All 13 suggestions (one per product, three for P108) flipped
   to `confirmed: true` under the owner's migrated-path decision: Path A linkage was mapped by
   the owner directly from the original live website and is independently verified, so
   per-product manual review is waived for this batch only. The confirmed files were copied
   from the batch's `raw/` directories into `public/products/` per the ADR-006 file-drop
   convention. The P106/P120 byte-identical photograph (sha256 `e57b5878…0650`) was published
   anyway under the owner's explicit risk acceptance, recorded as KI-001.

## Gate results

| Gate | Result |
| --- | --- |
| `validatePublishReadiness`, all 11 | **PASS, 0 errors each** |
| `validateDraftA` re-run, non-inverted rules | 0 errors; only the three documented post-review inversions fired (confirmed flags, price, images) |
| Keyword collision vs published map | **0 hard collisions** |
| Keyword collision vs pending drafts (incl. within-batch) | **0 hard collisions** |
| `metaTitle` uniqueness across all 60 records | unique |
| Similarity gate | advisory (threshold null); all 55 within-batch pairs and 11×49 catalogue comparisons computed and written to `content-pipeline/drafts/PNNN-similarity.json` |
| `buildProductFromDraft`, all 11 | built; advisories only (displayTerm note, open `occasion`/`care` spec keys, mrp fallback) |
| Metadata character counts | all measured in range: metaTitle 54–60, metaDescription 152–159, ogTitle 43–63, ogDescription ≤180, alts ≤121 |
| Full gate | typecheck ✓, lint ✓, `test:run` 1769/1769 ✓, `validate:products` PASS ✓, `build` ✓ |

`EXPECTED_PRODUCT_COUNT` moved 49 → 60. `npm run backfill:keyword-map` produced a
byte-identical map, as designed — drafts reserve no keywords.

## Similarity: all 55 within-batch pairs

All 11 drafts share one byte-identical source description, so this group is the worst case
the similarity gate will ever police. The differentiation held: **41 of 55 pairs score 0.0000
on every measure**, every opening-sentence score is 0, and the peak is **raw 0.0141**
(P108–P117). Notably P106–P120, two records of the *same photographed design*, score 0.0091.
The highest catalogue comparison for any draft was raw 0.018 (P106 vs P004).

Non-zero pairs (all others are 0.0000 / 0.0000 / 0.0000):

| Pair | Raw | Normalised | Opening | Peak |
| --- | --- | --- | --- | --- |
| P108–P117 | 0.0141 | 0.0141 | 0.0000 | raw 0.0141 |
| P108–P110 | 0.0120 | 0.0120 | 0.0000 | raw 0.0120 |
| P108–P121 | 0.0092 | 0.0092 | 0.0000 | raw 0.0092 |
| P106–P120 | 0.0091 | 0.0091 | 0.0000 | raw 0.0091 |
| P115–P117 | 0.0074 | 0.0074 | 0.0000 | raw 0.0074 |
| P108–P115 | 0.0072 | 0.0072 | 0.0000 | raw 0.0072 |
| P118–P120 | 0.0070 | 0.0070 | 0.0000 | raw 0.0070 |
| P110–P121 | 0.0048 | 0.0048 | 0.0000 | raw 0.0048 |
| P106–P109 | 0.0047 | 0.0047 | 0.0000 | raw 0.0047 |
| P106–P118 | 0.0047 | 0.0047 | 0.0000 | raw 0.0047 |
| P106–P121 | 0.0046 | 0.0046 | 0.0000 | raw 0.0046 |
| P109–P119 | 0.0024 | 0.0024 | 0.0000 | raw 0.0024 |
| P110–P118 | 0.0024 | 0.0024 | 0.0000 | raw 0.0024 |
| P106–P119 | 0.0023 | 0.0023 | 0.0000 | raw 0.0023 |

The differentiation signal was real: each product's own photograph. The 11 designs are
genuinely distinct pieces (a five-petal flower, a butterfly bypass, an oval swirl cocktail
ring, a lattice criss-cross, a milgrain channel band, an interlaced crossover, an open
heart-and-teardrop, an oval halo, a perched butterfly, a round solitaire — and P120, the
flower again, photographed identically to P106 per KI-001).

## Test-suite changes this run forced, and why they are correct

Landing real migrated records in `data/products.json` invalidated two premises the suite had
encoded:

1. **`lib/prepare-migration-batch.test.ts`** asserted the real catalogue's maximum id stayed
   at or below P049 so the one-time Stage 0 override could still run. With P122 in the file,
   the override's floor assertion now refuses every run, including `--dry-run` — which is that
   script's *designed* end state ("REFUSING TO RUN… the sequence is no longer the sequence
   this script assumes"). Four tests were rewritten to prove the spent override exits 1, names
   the offending id, and writes nothing. Dry-run *planning* behaviour stays covered by the
   `planBatch` suites, which inject a pre-P050 fixture catalogue. All 542 raw blocks of
   `2026-08-23-batch-01` were queued before the seam closed, so the remaining migration needs
   no second Stage 0 run; a future export batch needs a new decision (an ADR-054 successor),
   not a loosened assertion.
2. **`lib/product-status.test.ts`** asserted its injected P900 fixture was the only
   unpublished record. The test now asserts every unpublished record is accounted for: the
   fixture, or a migrated pipeline draft carrying `migrationProvenance`. An unpublished record
   that is neither still fails the suite.

One intermittent single-test failure was observed in two early full-suite runs during this
session and could not be captured; the final two fully-captured runs were 1769/1769 green
twice in a row, and the two files above pass in isolation. Worth an eye on future gate runs.

## Merchandiser notes (kept out of the description fields by design)

`validate-products.mjs` hard-fails a description carrying `[Merchandiser note: …]`, so the
copy skill's missing-data flags are recorded here instead:

- **All 11:** the base metal under the rose gold plating is not stated in the source, and the
  owner confirmed it is genuinely unknown. Copy says "rose gold-plated" and never names a base
  metal; P120's copy states the gap outright.
- **P106/P120:** one photograph, two SKUs (KI-001). Copy for the two was written from
  different angles, but the listings will show the same image until the owner resolves it.
- **PRICE-DATED metadata:** P106, P109, P115, P118, P120, P122 quote their price in a meta
  field; re-check those if a price moves (the validator also tracks this).

## Where this leaves the pipeline

All 11 register rows are at `awaiting-publish`. The next step is the owner reading the 11
records in `data/products.json` and, per product, running
`node scripts/publish-product.mjs PNNN` — a step this run deliberately did not take.
