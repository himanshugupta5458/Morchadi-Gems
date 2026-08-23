# content-pipeline/incoming

Stage 0 migration batches — validated, id-assigned and queued, and **not yet extracted**.
[ADR-054](../../docs/decisions/ADR-054-stage-0-migration-batch-preparation.md) is the design
record. **This directory starts empty**, and this file is the only thing in it that git tracks.

## What a batch looks like

```
{batch-id}/
├── manifest.json         one entry per record READ — queued and refused alike
├── needs-attention.md    every refused record, with the field and the reason
├── odoo-{originalId}/    the downloader's output, read but never written by Stage 0
│   └── raw/main.webp, extra-N.webp, variant-*.webp
└── P101/
    └── raw-block.json    the assigned id, the source notes, the transformed shapes
```

## A raw block is not a Draft A object

`raw-block.json` is the input extraction will read, not its output. It carries `sourceNotes`, the
pre-mapped category / subcategory / `suggestedCollections`, `pricing.referencePrice`, the
transformed `variants`, and *suggested* `images` with their provenance beside them. It carries no
`attributes`, no `flaggedContent`, no `personalized` verdict and no `status`, because every one of
those is produced by Draft A extraction, which has not run.

Its `confirmationState.draftAExtractionRun` is `false` in every file here, which is the check to
make before treating one as anything else.

**Do not point `scripts/validate-draft-a.mjs` at this directory.** It validates Draft A objects
and a raw block is not one; every file here would fail, and correctly.

## The image entries are suggestions

`images.general` and `images.variantImages` are populated with the paths a product *would* use,
in the [ADR-006](../../docs/decisions/ADR-006-product-image-convention.md) conventions. They are
proposals for the manual image-assignment step, not decisions it has already made.
`imageSuggestionProvenance` records the source file behind each one, and carries the source
system's `verified_distinct` hash check forward as `verifiedDistinct`. That flag is evidence for
whoever is reviewing — it says two files differ, not that this is the right photograph for this
variant. Nothing here is confirmed.

## The id reservation

A `raw-block.json` file's existence reserves its `productId` permanently, on exactly the terms of
[ADR-051 decision 4](../../docs/decisions/ADR-051-draft-a-content-pipeline.md) — see
[`../drafts/README.md`](../drafts/README.md) for the reconciled rule covering both paths. Migrated
ids start at **P101**; P050–P100 are permanently retired.

`prepare-migration-batch.mjs` refuses to overwrite an existing raw block for that reason. If a
batch needs re-preparing, move the old directory aside or use a new batch id.

## Preparing a batch

```
node scripts/prepare-migration-batch.mjs <export.jsonl> <batch-id>
```

Read `needs-attention.md` before doing anything else with the batch. A record listed there was
refused, was assigned no id, and is not in the queue.
