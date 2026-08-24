# Result: Stage 0 vs. the real Odoo export — field reconciliation

- **Date:** 2026-08-23
- **Kind:** Read-only diagnostic. **No code, schema, or data was modified.** Stage 0 was not run
  in write mode against the real batch.
- **Subject:** [`scripts/prepare-migration-batch.mjs`](../../scripts/prepare-migration-batch.mjs)
  (Stage 0, [ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md)) against
  `content-pipeline/incoming/2026-08-23-batch-01/draft-a-input.jsonl`
- **Headline:** **0 of 542 records pass Stage 0 validation today.** Every one of them fails the
  same three checks, for one reason: the export nests under `sourceNotes` and `sourceImages` what
  Stage 0 reads from the top level. Behind those three lie **four further mismatches that fail
  silently** — they do not reject a record, they write a wrong value into `raw-block.json`.
- **Gate:** all five commands green (no change was made; this is the baseline). See
  [The five-command gate](#the-five-command-gate).

---

## Method

1. **All 542 lines** of `draft-a-input.jsonl` were parsed and every path in every record walked to
   build a complete field inventory — name, nesting, type, and present-vs-null counts. Not a
   sample.
2. All 1,072 lines of `prepare-migration-batch.mjs` were read, and every `record.*` access
   catalogued.
3. Stage 0's own exported `validateSourceRecord` was imported and run over the real records, so
   the rejection reasons below are the script's, not a re-implementation of it.
4. A **reshape probe** mapped the real field names onto the names Stage 0 expects and re-ran the
   same validator, to find the residual failures that the three naming faults currently mask.
5. `--dry-run` was run against the full real file. **The flag already existed** (`runCli`,
   `scripts/prepare-migration-batch.mjs:979`, documented in ADR-054 line 312), so nothing was
   added and the reconciliation stayed read-only.

---

## Part 1 — What the real export actually contains

542 records, 0 JSON parse errors, 542 unique `workingId`s, 542 matching directories on disk. The
top-level key set is identical across all 542 records:

`attributes`, `category`, `flaggedContent`, `generatedBy`, `notes`, `personalized`, `pricing`,
`sourceImages`, `sourceNotes`, `sourceType`, `status`, `subcategory`, `suggestedCollections`,
`variants`, `workingId`

Notable population facts:

| Fact | Count |
| --- | --- |
| `attributes` (top level) — **empty array in every record** | 542/542 |
| `category` populated / null | 477 / 65 |
| `subcategory` populated (`anti-tarnish` 192, `hamper` 18, `mystery-jar` 4, `combo-set` 3) | 217 / 325 null |
| `variants[]` entries | 863 across 542 records; 78 records have >1 |
| `variants[].attributes[]` entries (the real option data) | 553 across 78 records |
| `variants[].image` populated | 50 (813 null) |
| `sourceImages.extras[]` entries | 483 |
| `sourceImages.variants[]` entries | 50, across 5 products |
| `sourceNotes.originalMetaDescription` populated / null | 331 / 211 |
| `sourceNotes.originalSku` populated / null | 489 / 53 |
| `notes[]` entries — **pre-populated by the extraction session** | 563 |
| `flaggedContent` non-empty | 0 |
| `knownStub` — **the key does not appear anywhere in the file** | 0 |
| `rawContent` trimmed length | min 4, max 1,949; 11 under 50 chars |

---

## Part 2 — What Stage 0 reads

`validateSourceRecord` and `buildRawBlock` between them touch exactly these paths, all at the top
level of the record:

`originalId`, `category`, `subcategory`, `rawContent`, `rawHtml`, `knownStub`, `originalSku`,
`originalUrl`, `referenceTitle`, `originalCategories`, `suggestedCollections`, `referencePrice`,
`attributes[].name`, `attributes[].values[]`, `images.main`, `images.extra[]`,
`images.variantImages[].attribute`, `images.variantImages[].value`,
`images.variantImages[].file`, `images.variantImages[].verified_distinct`

---

## Part 3 — Field-by-field comparison

Legend: **✅** read correctly · **❌** hard fail · **⚠️** silent misread or silent loss · **·** ignored, harmlessly.

### Fields Stage 0 gets right today

| Real field | Real shape | Stage 0 reads | Verdict |
| --- | --- | --- | --- |
| `category` | `string \| null`, 477 populated | `record.category` | ✅ Same name, same place. All 477 values are inside the eleven-slug vocabulary, `gift-hampers` (25) included. Zero category rejections. |
| `subcategory` | `string \| null`, 217 populated | `record.subcategory` | ✅ Same name, same place; validated as a non-empty string and carried into `rawBlock.subcategory`. Per [ADR-056](../decisions/ADR-056-image-confirmation-provenance-and-draft-similarity.md), `types/product.ts:374` now has a real `subcategory?: string` field, so this **flows through rather than being accepted-and-dropped**. All four real values (`anti-tarnish`, `hamper`, `mystery-jar`, `combo-set`) pass. |
| `suggestedCollections` | `string[]`, 192 entries (all `anti-tarnish`) | `record.suggestedCollections` | ✅ Same name, same place, copied verbatim. |
| `attributes` | `[]` in all 542 | `record.attributes[]` | ✅ *Shape* validates — but see ⚠️ B-5: it is empty in every record, so it validates vacuously. |

### BLOCKING — the three that reject all 542

| Real field | Real shape | Stage 0 expects | Verdict |
| --- | --- | --- | --- |
| `sourceNotes.originalId` | `int`, 542/542 | `record.originalId` (top level) | ❌ **Wrong nesting.** `readOriginalId(undefined)` → `null` → *"missing — it orders the batch and names the image directory"*. **542 rejections.** |
| `sourceNotes.rawContent` | `string`, 542/542 | `record.rawContent` (top level) | ❌ **Wrong nesting.** Length reads as 0 → every record looks like a zero-character stub → *"absent or empty, and the record is not flagged knownStub: true"*. **542 rejections.** |
| `sourceImages` | `object` | `record.images` | ❌ **Wrong name.** `validateImageShape(undefined)` → *"images: missing or not an object"*. **542 rejections.** Because this fires first, the `images.main`-on-disk check **never runs at all** — its result today is unknown to Stage 0. |

### BLOCKING (masked) — silent misreads that appear once the three above are fixed

These do not reject anything. They write a wrong value into `raw-block.json` and exit 0.

| Real field | Real shape | Stage 0 expects | Verdict |
| --- | --- | --- | --- |
| `pricing.referencePrice` | `string`, 542/542, a full descriptive sentence — `"₹59 sale price (morchadijewels.com, reference only)"` (452 records) or `"₹450 sale price, ₹300 cost (…)"` (90 records) | `record.referencePrice` (top level) | ⚠️ **Wrong name and wrong nesting.** `buildRawBlock` writes `pricing: { referencePrice: record.referencePrice ?? null }` → **`null` for all 542**. A raw block that states "no reference price" for a product that has one. The *format* is a non-issue — Stage 0 copies the value verbatim and never parses it — but only if it reads the right key. |
| `variants[].attributes[]` → `{attribute, value}` | 553 entries across 78 records | `record.attributes[]` → `{name, values[]}` | ⚠️ **Different location and different shape.** Real data expresses attributes as a *per-variant combination list*; Stage 0 expects a *deduplicated option list*. Since top-level `attributes` is `[]` in all 542, `toVariants()` returns `[]` every time — **all 78 multi-variant products would be written with `variants: []`**. Silent, total loss of the variant axis. |
| `sourceImages.variants[]` → `{variantId, value, file, bytes, converted, source, verifiedDistinct, sharedWithOtherVariant}` | 50 entries | `images.variantImages[]` → `{attribute, value, file, verified_distinct}` | ⚠️ **Wrong container name, and `attribute` does not exist in the real shape.** `buildImageSuggestions` keys the variant-image map by `` `${attribute}:${value}` `` — with `attribute` undefined every key becomes `"undefined:B"`. The attribute name is recoverable only by joining `variantId` into `variants[].attributes[].attribute`; the probe confirmed **this join succeeds for all 50/50**, but Stage 0 does not perform it. |
| `sourceImages.variants[].verifiedDistinct` | `bool`, **`true` in all 50** | `variantImage.verified_distinct` (snake_case) | ⚠️ **Case mismatch.** `verified_distinct === true` evaluates `undefined === true` → **`false` for all 50**. This is precisely the evidence ADR-056 reversed ADR-054 decision 5 to preserve — *"the source system's own hash check, the one piece of trusted evidence in the whole import"* — and it would arrive at the reviewer reading `verifiedDistinct: false`, which the schema defines as *not verified*. |

### IMPORTANT

| Real field | Real shape | Stage 0 expects | Verdict |
| --- | --- | --- | --- |
| `sourceImages.main` | `{file, bytes, converted, source}` — an **object**; `file` is `"main.webp"` in all 542 | `images.main` — a **string** filename | ⚠️ Type mismatch. `isNonEmptyString(object)` → false → falls back to the literal `"main.webp"`, which happens to be right in all 542 cases. Correct by coincidence, not by contract. |
| `sourceImages.extras[]` | `{file, bytes, converted, odooMediaId, odooName, sequence, source}` — objects | `images.extra[]` — **strings**, and the key is `extra` not `extras` | ⚠️ Wrong key name *and* wrong element type. `(undefined ?? []).filter(isNonEmptyString)` → `[]` → **all 483 extra images dropped** from the suggestions. |
| `variants[].image` | `{file, verifiedDistinct, sharedWithOtherVariant}`, 50 populated | no equivalent | ⚠️ A second, redundant representation of the same 50 variant images. Verified **byte-for-byte consistent** with `sourceImages.variants[]` (0 discrepancies across all 50 on `file`, `verifiedDistinct` and `sharedWithOtherVariant`). It carries **no `value` and no `attribute`**, so it cannot be used as the sole source for the variant-image map. |
| `sourceNotes.originalMetaDescription` | `string \| null`, 331 populated | **not in the schema at all** | ⚠️ **New field.** Does not error — it is simply never read, so 331 owner-written meta descriptions never reach `raw-block.json`. Whether extraction should see them is a Draft A question, but it cannot see what Stage 0 does not carry. |
| `notes[]` | `string[]`, **563 pre-populated entries** | **not read** | ⚠️ `buildRawBlock` emits no `notes` key at all. Confirmed: it **does not overwrite and does not choke** — it silently drops. The migration's own QA observations (*"only one image available from source"* ×366, *"no source category mapped"* ×43, *"duplicate title shared with template(s) …"* ×54, *"source description is only N characters"* ×11) do not survive into the queue. |
| `knownStub` | **absent from the export entirely** | `record.knownStub === true` | ⚠️ There is no field the exporter can set to accept a known-short record. The 11 genuine stubs are therefore rejected with no override path. The *rejection* is correct per ADR-054; the *absence of any way to flag them* is the gap. |
| `sourceNotes.rawHtml` | `string`, 542/542 | `record.rawHtml` (top level) | ⚠️ Wrong nesting → `null` in all 542 raw blocks. |
| `sourceNotes.referenceTitle` | `string`, 542/542 | `record.referenceTitle` | ⚠️ Wrong nesting → `null`. Also degrades the register: `renderDraftsInProgressRows` would write `_(no title in export)_` for all 542 rows. |
| `sourceNotes.originalSku` | `string \| null`, 489 populated | `record.originalSku` | ⚠️ Wrong nesting → `null`. Feeds `migrationProvenance` (ADR-056 BLOCKING-3). |
| `sourceNotes.originalUrl` | `string`, 542/542 | `record.originalUrl` | ⚠️ Wrong nesting → `null`. Feeds `migrationProvenance`. |
| `sourceNotes.originalCategories[]` | 624 entries | `record.originalCategories` | ⚠️ Wrong nesting → `[]`. |

### MINOR — ignored, correctly or harmlessly

| Real field | Verdict |
| --- | --- |
| `workingId` | · Not read. Stage 0 derives the directory name itself as `` `odoo-${originalId}` `` in `sourceImagePath`. **Verified identical to `workingId` in all 542 records**, so the convention matches exactly — see Part 4. |
| `sourceType` (`"migrated"` ×542) | · Not read; `buildRawBlock` hardcodes `sourceType: "migrated"`. Values coincide. |
| `status` (`"draft"` ×542) | · Not read; Stage 0 writes `stage: "queued"`, which is the correct Stage 0 semantic. |
| `personalized` (null ×542), `flaggedContent` (empty ×542), `generatedBy` (null ×542) | · Correctly ignored — all three are Draft A outputs, and ADR-054 is explicit that extraction has not run. |
| `pricing.price` / `.mrp` / `.cost` | · All `null` in all 542. Not read. |
| `variants[].variantId` / `.displayName` / `.referencePrice` / `.active` | · Not read. `variantId` is nonetheless **needed** as the join key to recover the variant-image attribute name (B-6). |
| `sourceImages.*.bytes` / `.converted` / `.source` / `.odooMediaId` / `.odooName` / `.sequence` | · Not read. `sequence` is a **string** (`"10"`, `"11"`…) — irrelevant today because file order already matches, see Part 4. |
| `sourceImages.variants[].sharedWithOtherVariant` | · `false` in all 50. No slot in the Draft A image schema; not read. |

---

## Part 4 — Image folders on disk

Checked against the real tree, not against the fixture.

| Check | Result |
| --- | --- |
| Directory naming `odoo-{template_id}` | ✅ **542/542 exact match.** `workingId === "odoo-" + sourceNotes.originalId` for every record, and every one has a directory. **0 directories without a record, 0 records without a directory.** Stage 0's `sourceImagePath(batchId, originalId, file)` → `{batch}/odoo-{originalId}/raw/{file}` resolves correctly. |
| `main.webp` | ✅ Present in all 542 `raw/` folders. `sourceImages.main.file` is the literal string `"main.webp"` in all 542 — no casing or extension variation. |
| `extra-N.webp` | ✅ 483 files. Numbering is **1-based, contiguous, and in array order** in every record (0 gaps, 0 misorderings), so `buildImageSuggestions`' positional `-2, -3, …` mapping is sound. Max 26 extras on one product (`odoo-861`). |
| `variant-{value}.webp` | ✅ 50 files. **Slugification matches Stage 0's `slugifyImageSegment` exactly — 0 mismatches across all 50.** `Letter: "B"` → `variant-b.webp`, confirming the lowercase single-letter form the synthetic fixture assumed. Multi-word values also match: `"Wine Red"` → `variant-wine-red.webp`, `"Pearl Champagne"` → `variant-pearl-champagne.webp`, `"Classic Black"` → `variant-classic-black.webp`. |
| Value-slug collisions within a product | ✅ **None.** `buildImageSuggestions`' attribute-prefix disambiguation branch is never exercised by this batch. |
| Every referenced file exists | ✅ Independently probed: **542/542 main, 483/483 extras, 50/50 variant images present.** 0 missing. |
| Stray files under `raw/` | ✅ None. Every `raw/` contains only `main.webp`, `extra-N.webp` and `variant-*.webp`. |

Two observations, neither a fault:

- Each product folder also holds `_complete` and `images.json` **beside** `raw/`, not inside it. Stage 0 never looks there.
- The batch root holds three CSVs — `download-report.csv`, `variant-image-check.csv`, `watch-pair-check.csv` — alongside the JSONL. Stage 0 reads only the path given on the command line, so they are inert.

**Note on the existence check itself:** `validateSourceRecord` probes the hardcoded literal
`"main.webp"`, *not* the record's own `images.main` value that `buildImageSuggestions` later uses.
The two agree for this batch only because every `sourceImages.main.file` happens to be
`"main.webp"`. Extras and variant images are **never existence-checked** by Stage 0 at all — the
533 files above were confirmed present by this reconciliation, not by the script.

---

## Part 5 — Dry run against the real 542

```
$ node scripts/prepare-migration-batch.mjs \
    content-pipeline/incoming/2026-08-23-batch-01/draft-a-input.jsonl \
    2026-08-23-batch-01 --dry-run

Stage 0 batch preparation — 2026-08-23-batch-01
No Draft A extraction runs here. This step validates, assigns ids and queues.

  source            content-pipeline/incoming/2026-08-23-batch-01/draft-a-input.jsonl
  records read      542
  queued            0
  needs attention   542
  catalogue max id  P049
  ids assigned      none

DRY RUN — nothing written.
                                                              exit 1
```

**The `--dry-run` flag already existed and needed no change.** It short-circuits before `mkdirSync`,
before every `writeFileSync`, and before `appendRegisterRows`, so no `raw-block.json`, no
`manifest.json`, no `needs-attention.md` and no register row was written, and no product id was
assigned. Verified by `git status` afterwards (Part 7).

Two preconditions passed on the way through: `data/products.json` holds 49 products with maximum
id **P049**, at the `CATALOGUE_MAX_ID_CEILING`, so `assertCatalogueBelowOverrideFloor` permits the
run; and the **real batch-id `2026-08-23-batch-01` is handled correctly** as a positional
argument — it is not mistaken for a flag, and it composes into paths exactly as the synthetic
placeholders did.

### Rejections grouped by reason

Every record fails **all three** checks — there is no partial-failure population.

| Records | Field | Reason |
| --- | --- | --- |
| 542 | `originalId` | missing — it orders the batch and names the image directory, so nothing can proceed without it |
| 542 | `rawContent` | absent or empty, and the record is not flagged `knownStub: true` |
| 542 | `images` | missing or not an object |

| Failures per record | Records |
| --- | --- |
| 3 | 542 |
| 0–2 | 0 |

Notably **absent** from the rejections: no `category` failure (all 477 values are in the
vocabulary), no `subcategory` failure, no `attributes` shape failure, no duplicate-`originalId`
failure, and **no `images.main` on-disk failure — because that check is unreachable behind the
`images` shape failure.**

### Residual failures once the naming is mapped

The reshape probe mapped `sourceNotes.*` → top level, `sourceImages` → `images`, `extras` →
`extra[].file`, `sourceImages.variants[]` → `variantImages[]` with the attribute recovered by
`variantId` join, and `pricing.referencePrice` → `referencePrice`, then re-ran Stage 0's own
validator:

| Outcome | Records |
| --- | --- |
| **Pass** | **531** |
| Fail — `rawContent` under the 50-character stub threshold, not flagged `knownStub` | **11** |
| Warnings raised | 0 |

Breakdown of the 11 by content length: 4 chars ×3, 6 ×1, 9 ×2, 10 ×2, 12 ×1, 18 ×1, 40 ×1.

So the naming faults are the *whole* of the current rejection: fix them and **531 of 542 queue
cleanly**, assigning P101–P631, with 11 legitimately held back.

---

## Part 6 — Cross-check against the data's own `notes[]`

The export's `notes[]` array carries the extraction session's own observations. Comparing them
against what Stage 0's validation concludes independently:

| What the source data says about itself | What Stage 0 concludes | Agreement |
| --- | --- | --- |
| 11 records noted `"source description is only N characters - needs description written, not extracted"` | 11 records fall under `KNOWN_STUB_MAX_CONTENT_LENGTH` (50) | ✅ **Exact — same 11 records, and the character counts in the notes match Stage 0's computed trimmed lengths digit-for-digit** (`odoo-817` "only 40 characters" ↔ 40; `odoo-828` "only 4" ↔ 4; and so on for all 11: `odoo-817` through `odoo-821`, `odoo-824` through `odoo-829`). |
| 366 records noted `"only one image available from source"` | 542 − 483-bearing records have empty `sourceImages.extras[]` | ✅ Consistent. Stage 0 raises **no failure** for this, correctly — a single-image product is a product, not a fault. It is an extraction-quality signal, not a validation one. |
| 43 noted `"no source category mapped to a target category"` + 22 noted `"product had no source category"` | 65 records have `category: null` | ✅ **Exact — 43 + 22 = 65.** Stage 0 permits `null` category by design (ADR-054), so these queue rather than reject. |
| 34 noted `"multiple mapped categories, used '…'"` | Stage 0 accepts the single chosen value | ✅ No disagreement. The alternatives named in the notes (`combo→gift-hampers`, `Anti Tarnish bracelet→bracelets`, `Necklace→necklaces`) are all inside the eleven-slug vocabulary, so whichever was chosen would have validated. |
| 54 noted `"duplicate title shared with template(s) …"`, 31 of them `"descriptions byte-identical"` | Stage 0's duplicate check is on `originalId` only — **0 duplicates found** | ⚠️ **The one gap — and it is not a disagreement, it is a blind spot.** Stage 0 correctly reports no duplicate ids (all 542 are unique). It has no title or description duplicate check, so 54 flagged near-duplicates and 31 byte-identical descriptions would queue with nothing said. This is the population the ADR-056 IMPORTANT-1 similarity gate was widened to see — but `SIMILARITY_THRESHOLD` is still `null`, so nothing is refused there either. Stage 0 is not the wrong place for this; it is simply not covered anywhere yet. |
| 0 records carry `flaggedContent` | Stage 0 does not read it | ✅ Correctly ignored — a Draft A output. |

**Verdict: the source data and Stage 0's independent validation agree on every stub, every missing
category, and every image count.** The only divergence is the duplicate-title population, which
the source flags and Stage 0 has no mechanism to see.

---

## Prioritised list of what must be fixed before Stage 0 runs for real

Nothing below has been fixed. This is the reconciliation's output, not its work.

### BLOCKING

| # | Mismatch | Effect |
| --- | --- | --- |
| **B-1** | `originalId` is at `sourceNotes.originalId`, read from top level | 542/542 rejected. Nothing can run. |
| **B-2** | `rawContent` is at `sourceNotes.rawContent`, read from top level | 542/542 rejected as zero-length stubs. |
| **B-3** | `images` is named `sourceImages`; `main` and `extras[]` are **objects** not strings, and the key is `extras` not `extra` | 542/542 rejected. Also masks the main-image existence check entirely, and drops all 483 extra images once unmasked. |
| **B-4** | `referencePrice` is at `pricing.referencePrice`, read from top level | **Silent.** All 542 raw blocks record `referencePrice: null` for products that all have one. |
| **B-5** | Variant options live in `variants[].attributes[] {attribute, value}`; Stage 0 reads top-level `attributes[] {name, values[]}`, which is `[]` in every record | **Silent.** All 78 multi-variant products written with `variants: []`. The 553 real attribute values vanish, and validation passes because an empty array is a valid empty array. |
| **B-6** | `sourceImages.variants[]` has **no `attribute` field**; Stage 0 keys the variant-image map by `` `${attribute}:${value}` `` | **Silent.** Every key becomes `"undefined:{value}"`. Recoverable by joining `variantId` → `variants[].attributes[].attribute` — **verified to succeed for all 50/50** — but Stage 0 does not do the join. |
| **B-7** | `verifiedDistinct` (camelCase) read as `verified_distinct` (snake_case) | **Silent.** All 50 variant images are `verifiedDistinct: true` in the source and would be written `false` — the exact evidence ADR-056 reversed ADR-054 decision 5 to carry, arriving inverted. |

B-4 through B-7 are the dangerous set: they do not reject, they mis-record, and they are currently
invisible because B-1/B-2/B-3 reject the record first. **Fixing only B-1, B-2 and B-3 would turn
0 rejections into 531 silently-degraded raw blocks.**

### IMPORTANT

| # | Mismatch | Effect |
| --- | --- | --- |
| **I-1** | Four `sourceNotes` provenance fields — `referenceTitle`, `originalSku`, `originalUrl`, `originalCategories` — plus `rawHtml`, all read from the top level | Nulls throughout `migrationProvenance` (ADR-056 BLOCKING-3), and all 542 register rows would read `_(no title in export)_`. |
| **I-2** | `sourceNotes.originalMetaDescription` (331 populated) has no slot in the schema | Owner-written meta descriptions never reach extraction. Needs a decision: carry it, or record why not. |
| **I-3** | `notes[]` (563 entries) is dropped — not overwritten, not choked on, simply not carried | The migration's own QA findings do not reach the queue, so the reviewer of a raw block cannot see that its source had one image or a duplicate title. |
| **I-4** | `knownStub` does not exist in the export | The 11 stubs are rejected correctly, but there is no field the exporter can set to accept them deliberately. Either the export must emit it or ADR-054's rule needs a different lever. |
| **I-5** | Main-image existence probes the literal `"main.webp"`, not `record.images.main`; extras and variant images are never existence-checked | Correct today by coincidence (all 542 are `main.webp`, all 533 other files verified present *by this report*). The check and the suggestion can drift apart without anything noticing. |
| **I-6** | No duplicate-title or duplicate-description check anywhere | 54 records the source itself flags as duplicate-titled — 31 with byte-identical descriptions — would queue unremarked. The ADR-056 similarity gate can now see them, but `SIMILARITY_THRESHOLD` is still `null`. |

### MINOR

| # | Observation |
| --- | --- |
| **M-1** | `workingId` is ignored; Stage 0 re-derives the same string. Verified identical in all 542. Reading it would be more honest than re-deriving it, but nothing is wrong today. |
| **M-2** | `sourceType` and `status` are ignored and hardcoded/overridden. Values coincide with what Stage 0 writes. |
| **M-3** | `variants[].image` duplicates `sourceImages.variants[]` (verified consistent, 0 discrepancies). Harmless redundancy; neither is read today. |
| **M-4** | `extras[].sequence` is a **string** (`"10"`, `"11"`). Irrelevant while file order already matches, but a numeric sort on it would misorder. |
| **M-5** | `--dry-run` exists and is documented in ADR-054 but has **no test coverage** in `lib/prepare-migration-batch.test.ts`. |
| **M-6** | Three CSVs sit in the batch root beside the JSONL. Inert — Stage 0 reads only the path it is given. |

---

## The five-command gate

No code was changed, so this is a baseline confirmation that the tree is green.

| # | Command | Result |
| --- | --- | --- |
| 1 | `npm run typecheck` | ✅ `tsc --noEmit`, no output, exit 0 |
| 2 | `npm run lint` | ✅ `✔ No ESLint warnings or errors` |
| 3 | `npm run test:run` | ✅ **87 files, 1,716 tests passed**, 75.93s |
| 4 | `npm run validate:products` | ✅ `PASS — all checks green` (advisories only: 5 shared keyword pairs, 1 word-order pair, 9 products quoting an amount) |
| 5 | `npm run build` | ✅ `next build` completed, 75 routes |

---

## Part 7 — Working tree

`git status --porcelain` was empty before the reconciliation and reports only this report and its
BUILD_LOG row after it. **Nothing under `content-pipeline/incoming/` was modified** — no
`raw-block.json`, no `manifest.json`, no `needs-attention.md`, no directory created, and
`docs/pipeline-prep/drafts-in-progress.md` is untouched. Nothing unrelated is staged. The two
probe scripts used for the reshape simulation were written to the session scratchpad, outside the
repository.
