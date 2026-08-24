# scripts/fixtures

Fixture inputs for the scripts in the parent directory. **Everything here is fabricated.** No
file in this folder is an export, a sample of real data, or a record of anything the owner's
sites ever contained.

| File | For | Status |
| --- | --- | --- |
| [`synthetic-odoo-batch.jsonl`](synthetic-odoo-batch.jsonl) | `scripts/prepare-migration-batch.mjs` | **SYNTHETIC** — 10 fabricated records in the real export's shape, all valid, so the batch assigns P101–P110 |
| [`synthetic-odoo-batch-invalid.jsonl`](synthetic-odoo-batch-invalid.jsonl) | `scripts/prepare-migration-batch.mjs` | **SYNTHETIC** — 4 fabricated records in the real export's shape, each broken in one specific way, so `needs-attention.md` can be seen |

## Why these exist

These fixtures pin the *mechanism* — validation, id assignment, shape transformation, the
manifest — so the whole of Stage 0 can be exercised with no real batch on disk.

**They were rebuilt on 2026-08-24 to match the shape the real export actually has**, and that
rebuild is the point. The originals matched the schema
[ADR-054](../../docs/decisions/ADR-054-stage-0-migration-batch-preparation.md) *predicted*: every
provenance field at the top level, `images.main` a filename string, variant options in a
deduplicated top-level `attributes[]`. The export that arrived nests the provenance under
`sourceNotes`, names the image block `sourceImages` with `main` and `extras[]` as objects, and
expresses variant options as a per-variant combination list in `variants[].attributes[]` while
leaving top-level `attributes` an empty array in all 542 records.

The script read the predicted shape and the fixture wrote it, so the two agreed with each other
while neither agreed with the data — 0 of 542 real records could pass, and four further mismatches
would have written wrong values silently. See
[the reconciliation](../../docs/testing/RESULT-2026-08-23-stage0-real-data-reconciliation.md) and
[ADR-054's addendum](../../docs/decisions/ADR-054-stage-0-migration-batch-preparation.md#addendum--2026-08-24--the-real-export-shape).
`lib/prepare-migration-batch.test.ts` now asserts the fixtures' nesting directly, so a fixture that
drifts back to the predicted shape fails before anything else does.

The product titles, descriptions, SKUs and prices are invented for this purpose. They are **not**
copy to reuse, and nothing here has been through the honesty rules of
[ADR-018](../../docs/decisions/ADR-018-honest-product-description.md) or
[ADR-035](../../docs/decisions/ADR-035-catalogue-content-pass.md). Two of the records deliberately
carry the kinds of claim `docs/pipeline-prep/source-data-notes.md` catalogues — a karat number on
a plated item, an `American Diamond` trade name — because Stage 0 must transcribe those untouched
and hand them to review, and a fixture with only clean copy would not prove that.

## The images these records reference

`prepare-migration-batch.mjs` checks that **every** file a record names exists on disk — the main
photograph read from `sourceImages.main.file`, each `sourceImages.extras[].file`, and each
`sourceImages.variants[].file`. No image files are committed here: the test suite writes empty
`.webp` placeholders into a temporary directory and points the run at it with `--incoming-root`.
The check is that a path resolves, not that a file decodes.

## What the valid fixture deliberately exercises

- **Single-option variants** (`1002`, `1015`, `1021`, `1034`, `1055`, `1061`, `1073`) and a
  **two-option product** (`1090`, `Letter` × `Colour` over eight combinations), so the dedup from
  the per-variant combination list to `[{optionName, values}]` is proved on both.
- **Variant images that must be joined back by `variantId`** to recover the option name, including
  one (`1090`) whose variant carries two attributes so the join has to pick the pair matching the
  image's `value`.
- **`verifiedDistinct` both `true` and `false`, and absent altogether**, spelled camelCase as the
  export spells it.
- **`sourceNotes.originalMetaDescription`** populated on three records and null on the rest, and
  **`notes[]`** populated on five, so both carry-throughs are visible.
- **A record with no variants and no variant images at all** (`1008`, `1040`), because most of the
  real batch looks like that.
