# Test Result: Draft A content pipeline, end to end — 2026-08-23

- **Plan:** none. This is an exploratory dry run of the whole pipeline
  ([ADR-051](../decisions/ADR-051-draft-a-content-pipeline.md) Phase 1,
  [ADR-053](../decisions/ADR-053-draft-a-to-product-orchestration.md) Phase 2), run once against a
  synthetic product before the owner runs it against real content for the first time.
- **Commit:** `d1dac14`
- **Environment:** local container, no Cashfree calls, no database. The order path was exercised
  through `buildOrderFromCart` against the server-side pricing catalogue rather than over HTTP.
- **Fixture:** `P050`, "Test Ring TX01", a fabricated listing describing no real piece. Created,
  published, and removed again inside this run. **No row was added to
  [`products-completed.md`](../pipeline-prep/products-completed.md)** — the product was never real.

## What this run was for

Every stage of the pipeline had unit tests. None of them had ever been run in sequence against one
product, which is the only way to find the seams between them. It found three, all recorded below
under [Findings](#findings). The pipeline itself worked as designed at every step.

## Result summary

| Step | What was checked | Result |
| --- | --- | --- |
| 1 | Synthetic raw block authored: Colour variant with two values, a material phrase, a stone trade name needing a proposed candidate, plus boilerplate, review markup and a brand mismatch to exercise `flaggedContent` | Pass |
| 2 | Draft A produced per `draft-a-skills.md`; `productId` derived from the catalogue, not assumed | Pass — `P050` |
| 3 | Saved to `content-pipeline/drafts/P050.json`, row added to `drafts-in-progress.md` | Pass |
| 4 | `scripts/validate-draft-a.mjs` pre-review structural checks | Pass — exit 0, 0 errors, 0 warnings |
| 5 | Owner review simulated: every attribute confirmed, `personalized` resolved, image and price assigned | Pass |
| 6 | `validatePublishReadiness` (Part D) against the reviewed object | Pass — 0 errors |
| 7 | `draft-a-to-product-skills.md`: copy, SEO, keyword gate, similarity gate, mapping, record written | Pass — `status: "draft"` |
| 8 | `data/keyword-map.json` correctly NOT modified by the draft write | Pass — byte-identical |
| 9 | Draft invisible on every read surface and genuinely unbuyable | Pass — 20/20 |
| 10 | `scripts/publish-product.mjs P050` | Pass — status flipped, file moved, map regenerated |
| 11 | Product visible on every surface, the mirror of step 9 | Pass — 20/20 |
| 12 | Full cleanup, byte-for-byte | Pass — both data files identical to baseline |

**20 passed, 0 failed** on the surface battery in each direction. **Three findings**, none of them
a defect in the pipeline's own logic, all three in the scaffolding around it.

## The three gate runs

The full gate is `npm run typecheck && npm run lint && npm run test:run && npm run
validate:products && npm run build`.

| | (a) baseline, before starting | (b) step 11, synthetic product live | (c) after full cleanup |
| --- | --- | --- | --- |
| `typecheck` | exit 0 | exit 0 | exit 0 |
| `lint` | exit 0, no warnings | exit 0, no warnings | exit 0, no warnings |
| `test:run` | 84 files, 1464 passed, 103 skipped | 85 files, 1484 passed, 103 skipped | 84 files, 1464 passed, 103 skipped |
| `validate:products` | `PASS — all checks green` | `PASS — all checks green` | `PASS — all checks green` |
| `build` | exit 0, 75 static pages | exit 0, 76 static pages | exit 0, 75 static pages |

Gate (b) required nine hand-edits before it would pass. That is [finding 1](#finding-1). The extra
test file at (b) is this run's own temporary surface battery, deleted at cleanup.

## Step-by-step evidence

### Step 1 — the synthetic raw block

```
Test Ring TX01 — synthetic fixture for pipeline validation, not a real product

★★★★☆ (7 reviews)

A test-fixture band from Morchadi Jewels, made in gold-plated brass with a lightly hammered
surface. The band carries a single American Diamond stone set flush into the centre, so nothing
stands proud of the metal or catches on fabric.

Available in Golden and Silver.

Band width 4 mm, free size, opens at the back to adjust. Weighs about 3 g. Custom sizing
available on request.

MRP ₹599. Now ₹249.

Dispatch within 2 working days. Free returns within 7 days. Cash on delivery available across India.
```

Deliberately loaded: a wrong brand, review markup, a shipping/returns/COD paragraph, two price
figures, an ambiguous customisation phrase, and a stone trade name with no entry in a
`data/stone-terms.json` that does not exist.

### Step 2 — the Draft A, and the id

The id was derived rather than assumed:

```
catalogue ids: P001 .. P049 | count 49
gaps in sequence: (none)
next available id: P050
--- ids already claimed by draft files ---
(no draft files — no id reserved outside the catalogue)
(no completed files)
```

`P050` was correct, but only by coincidence of nothing having changed. The struck-through example
row in `drafts-in-progress.md` names `P050` and explicitly disclaims being a reservation; the
check above is what actually established the number.

Six attributes were proposed, every one `confirmed: false`, every one carrying the exact quoted
source phrase. `pricing.price` and `pricing.mrp` null, both price figures collapsed into
`referencePrice: "MRP ₹599, now ₹249 (old site listing, reference only)"`. `images` empty.
`personalized: null` with a note, because "Custom sizing available on request" is
customisation-adjacent but names no engraving, initial or chosen name. All three `flaggedContent`
types fired.

### Step 4 — pre-review validation

```
Draft A validation — structure and provenance only, no phrase allow-list
Target: content-pipeline/drafts/P050.json (1 file(s))

  PASS  P050         content-pipeline/drafts/P050.json

Batch summary
  objects checked   1
  passed clean      1
  failed (hard)     0
  with warnings     0

PASS — every Draft A object is well-formed and its provenance checks out.
```

### Step 5 — simulated owner review

| Field | Before | After |
| --- | --- | --- |
| attributes confirmed | 0 of 6 | 6 of 6 |
| `category` | `"rings"` | `"rings"` (already resolved at extraction) |
| `personalized` | `null` | `false` |
| `images.general` | `[]` | `["/products/P050.webp"]` |
| `pricing.price` | `null` | `249` |
| `pricing.mrp` / `cost` | `null` / `null` | `599` / `149` |
| `Stone` value | `"cubic zirconia or glass, unclear from text"` | `"cubic zirconia"` |

The stone value was edited and its `source.quotedPhrase` deliberately left untouched, to check that
the provenance re-run at step 6 still passes when review changes a claim.

### Step 6 — publish readiness

```
=== validatePublishReadiness (Part D) ===
PASS — 0 errors, 0 warnings
```

`validateDraftA` was re-run over the same reviewed object, as the orchestration skill's step 1
requires. It raised 9 errors: 6 × `confirmed: true`, `pricing.price`, `pricing.mrp`,
`images.general`. Every one is a documented inversion. **Zero unexpected errors** — the source
pairing and quoted-phrase containment still held after review, including on the attribute whose
value review had changed.

### Step 7 — orchestration

**Keyword collision gate:**

```
candidate primaryKeyword: "gold-plated hammered band ring"
published.hard       []
pendingDrafts.hard   []
VERDICT: PASS — no product, published or draft, owns this primary keyword
metaTitle uniqueness across all records, drafts included: PASS — unclaimed
  secondary "free size ring" overlaps P004, P011 (advisory, permitted)
```

**Every character count measured**, per `meta-skills.md` rule 7:

| Field | Measured | Range | |
| --- | --- | --- | --- |
| `metaTitle` | 50 | 50–60 | OK |
| `metaDescription` | 156 | 140–160 | OK, after two rewrites from 139 then 161 |
| `imageAlt` | 83 | ≤125 | OK |
| `ogTitle` | 46 | 40–70 | OK |
| `ogDescription` | 159 | ≤200 | OK |
| `description` | 244 words | 150–300 | OK |

Banned vocabulary: none. Em/en dashes: none. Precious-metal claim: none. Review metadata in the
description field: none. Shortest sentence 4 words, longest 37.

**Similarity gate, advisory:**

```
SIMILARITY_THRESHOLD: null
comparisons        : 49
blocked            : false
ADVISORY (SIMILARITY_THRESHOLD is null, nothing blocks): highest raw 0.007 against P034,
across 49 active product(s).
  P034 peak 0.0069 via raw
  P008 peak 0.0065 via raw
  P043 peak 0.0047 via raw
exceeded: 0
```

The gate ran, scored, logged and did not block — correct while the threshold is `null`. The report
was written to `content-pipeline/drafts/P050-similarity.json` as the skill requires on every run.

**Mapping.** No errors. Three advisories, all of them the ones the design intends to raise:

```
attributes[1].stoneSource: "Stone" was proposed as an unverified guess. Confirmation cleared it
  for publication; this is a note that it never had a reference list behind it
attributes[1].displayTerm: specs.stone carries the technical value "Cubic zirconia"; the trade
  name "American Diamond" is not written to the record
attributes[3].label: "Surface finish" is not a known spec label, so it keeps its own key
  specs.surface finish and renders as "Surface finish"
```

`specs`: `material, stone, type, surface finish, size, weight`. `status: "draft"`.
`options`: `[{"name":"Colour","type":"swatch","values":["Golden","Silver"],"default":"Golden"}]`.
`media.variantImages` omitted entirely rather than written as `{}`. `collections` omitted, empty.
`specs.stone` reads `Cubic zirconia`, never `American Diamond` — the honesty rule held.

### Step 8 — the keyword map was correctly not touched

```
hash before backfill: 0ca0721b1c1c14b0b5c7b90e666b08b6a26194d8d209d9473933b64c9e150390
hash after  backfill: 0ca0721b1c1c14b0b5c7b90e666b08b6a26194d8d209d9473933b64c9e150390
git diff --stat data/keyword-map.json: (empty)
does the map mention P050? 0 — absent, correct for a draft
```

`npm run backfill:keyword-map` was run and produced a byte-identical file, which is how the skill
says to confirm it rather than assume it. `"free size ring"` still listed `P004, P011` only.

### Step 9 — invisible and unbuyable

Twenty assertions across the fourteen surfaces of
[ADR-052](../decisions/ADR-052-product-status-field.md), run against the real record in the real
file rather than a mocked one. All 20 passed with `visible=false`: `getAllProducts`, its category
listing, resolution by id, the new-arrivals row, `isActiveProduct`, `generateStaticParams`, every
page of the unfiltered shop listing, the category facet, the result total, the sitemap, the shop
`ItemList` graph, the site-wide graph, and all four order catalogues.

The buy attempt, `buildOrderFromCart` against `getOrderPricingCatalogue()`:

```json
{
  "valid": false,
  "errors": [
    { "productId": "P050", "code": "UNKNOWN_PRODUCT",
      "message": "This piece is no longer in our catalogue." }
  ],
  "lineItems": [], "subtotal": 0, "shipping": 0, "total": 0
}
pricing catalogue size: 49
```

Forty-nine entries in the pricing catalogue while fifty records sat in the file. The draft was not
merely hidden, it had no price the server would honour.

There is no free-text search route in this storefront. Discovery is the shop facets, the sitemap
and the structured data, and all three were covered above.

### Step 10 — publish

```
Morchadi Gems — publishing P050

  status            draft -> active
  name              Hammered Free Size Test Band TX01
  keyword map       rewritten, 50 published product(s)
  draft filed       content-pipeline/completed/P050.json
```

All three confirmed independently: `status` read back as `active`; `content-pipeline/drafts/`
held only its README and the similarity report while `content-pipeline/completed/P050.json`
existed; the map hash moved `0ca0721…` → `0fbfbb97…` and gained

```
primary   :: gold-plated hammered band ring -> P050
secondary :: adjustable brass ring          -> P050
secondary :: cubic zirconia band ring       -> P050
secondary :: free size ring                 -> P004,P011,P050
secondary :: hammered finish ring           -> P050
```

The script left `P050-similarity.json` in `drafts/` on purpose and said so. It did not touch the
two hand-maintained registers, and printed the reminder instead — as designed, and see
[finding 3](#finding-3).

### Step 11 — visible, and priced

The same twenty assertions re-run with `visible=true`: all 20 passed. The product resolved by id,
took a static param, appeared on the shop listing and in the result total, gained a sitemap URL,
appeared in the listing `ItemList`, and entered all four order catalogues.

The same buy attempt now returned `valid: true` with `lineItems[0].unitPrice === 249` — the server
priced it from `data/products.json`, which is the rule that matters.

### Step 12 — cleanup

Record removed from `data/products.json` programmatically, `content-pipeline/completed/P050.json`
and `P050-similarity.json` deleted, `public/products/P050.webp` deleted, the map regenerated, the
`drafts-in-progress.md` row removed, and every temporary edit reverted.

```
=== sha256sum -c against baseline ===
data/products.json:    OK
data/keyword-map.json: OK

=== cmp, byte for byte ===
data/products.json:    IDENTICAL
data/keyword-map.json: IDENTICAL

=== git status ===
(empty = tree clean)
```

`data/products.json` was rebuilt by filtering the record out and re-serialising, not by
`git checkout`. It came back byte-identical, which additionally proves the pipeline's
serialisation round-trips the file exactly.

## Findings

Three. None is a defect in the pipeline's logic. All three are in the scaffolding around it, and
all three would land on the owner during their first real run.

### Finding 1

**Adding any product to the catalogue fails the gate until eight hardcoded counts are updated by
hand, and nothing in the pipeline says so.**

`npm run validate:products` failed the moment the record was appended, while it was still a draft:

```
FAIL — 1 problem(s):
  - expected exactly 49 products, found 50
```

`EXPECTED_PRODUCT_COUNT` in `scripts/validate-products.mjs:19` counts every record in the file,
drafts included — deliberate, per ADR-052, and its comment says "Bump it when real stock arrives."
Bumping it exposed seven more in the test suite:

| File | Line | Assertion |
| --- | --- | --- |
| `scripts/validate-products.mjs` | 19 | `EXPECTED_PRODUCT_COUNT = 49` |
| `lib/product-schema.test.ts` | 12 | `CATALOGUE_SIZE = 49` |
| `lib/product-seo.test.ts` | 39 | `toHaveLength(49)` |
| `lib/structured-data.test.ts` | 488 | `toHaveLength(49)` |
| `lib/content-similarity.test.ts` | 322 | `toHaveLength(49)` |
| `lib/sitemap.test.ts` | 55, 58 | `toHaveLength(49)` × 2 |
| `lib/keyword-collision-check.test.ts` | 198 | `productCount).toBe(49)` |
| `lib/content-similarity-gate.test.ts` | 40 | see [finding 2](#finding-2) |

Eight edits across eight files, none mentioned by `draft-a-to-product-skills.md` step 6, by
`publish-product.mjs`, or by ADR-053. The skill's step 6 says "run the full gate" and stops there.
The owner's first real product will produce a red gate and eight failures with no instruction
attached.

The count being exact rather than a floor is the right call and should stay. What is missing is
that the pipeline never tells anyone about it. Worth either a note in the skill's step 6 and in the
publish script's closing output, or deriving the test-suite counts from the file the way
`lib/product-status.test.ts` already derives `PUBLISHED_COUNT`.

### Finding 2

**`lib/content-similarity-gate.test.ts` uses `P050` as its synthetic candidate id — the exact id
the pipeline assigns next.**

Line 40 builds a fixture "not in the catalogue" with `id: "P050"`. `compareAgainstCatalogue`
filters out `entry.id === candidate.id`, so the moment a real `P050` exists the comparison
population silently drops by one and the test fails:

```
FAIL lib/content-similarity-gate.test.ts > scores a candidate against all of them ...
AssertionError: expected 49 to be 50
```

This is not a count that needs bumping, it is a fixture id collision that will recur. The fixture
should use an id outside the catalogue's range — `P900`, as `lib/product-status.test.ts` already
does. Changing it to `P900` was one of the nine edits gate (b) needed.

### Finding 3

**`publish-product.mjs` does not remove the `drafts-in-progress.md` row, by design — worth
confirming, since the task expected it might.**

The script prints the two register edits as a reminder and deliberately does not make them. Its
own header explains why: the registers are hand-maintained human indexes over an untracked
directory, and a script editing them would make them a derived artefact that nothing derives. The
row was removed by hand at cleanup, and no row was added to `products-completed.md` because this
product was never real. This is correct behaviour, recorded here only because a reader might
otherwise expect the move to be automatic.

### Not a finding, but worth stating

The task specified a fake image path such as `TX01-test.webp`. That cannot work:
`validate-products.mjs:367-380` requires `media.images[0]` to be exactly `/products/{id}.webp`
**and** requires the file to exist under `public/`. A fabricated filename fails the gate at step
11 twice over. The run used `/products/P050.webp` with a placeholder generated by
`npm run generate:placeholders`, and deleted it at cleanup. Any real run needs a real file at the
id-keyed path before publish, not a placeholder name.

## Summary

**Every step succeeded in the order specified.** The pipeline's own logic did what its design says
at all twelve steps: the extraction refused to invent, the pre-review validator passed, the
post-review validator inverted exactly the three fields it documents, the keyword gate checked
published and draft records separately, the similarity gate scored and declined to block, the
mapper wrote `Cubic zirconia` rather than the trade name, the keyword map stayed untouched for a
draft and regenerated at publish, the draft was invisible and unpriceable on all fourteen
surfaces, and the published product was visible and priceable on all fourteen.

All three gate runs are green. `data/products.json` and `data/keyword-map.json` are byte-identical
to their pre-task state, confirmed by `sha256sum -c` and by `cmp`. The working tree carries only
this file and a `BUILD_LOG.md` row.

The three findings are all in the scaffolding, and finding 1 is the one that matters: the pipeline
is complete and correct, and then hands the owner a red gate it never warned them about.
**Recommend fixing findings 1 and 2 before the owner's first real run.**
