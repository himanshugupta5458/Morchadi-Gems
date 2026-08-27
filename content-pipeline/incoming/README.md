# content-pipeline/incoming

Stage 0 migration batches — validated, id-assigned and queued, and **not yet extracted**.
[ADR-054](../../docs/decisions/ADR-054-stage-0-migration-batch-preparation.md) is the design
record. **This directory starts empty**, and this file is the only thing in it that git tracks.

## What a batch looks like

```
{batch-id}/
├── manifest.json         one entry per record READ — queued and refused alike
├── needs-attention.md    every refused record, with the field and the reason
└── P101/
    ├── raw-block.json    the assigned id, the source notes, the transformed shapes
    ├── images.json       the downloader's per-image manifest (file, bytes, source URL)
    └── raw/              main.webp, extra-N.webp, variant-*.webp — the staged source images
```

One directory per product, holding everything about it
([ADR-057](../../docs/decisions/ADR-057-staging-colocation-and-completed-tracking.md)): the
downloader's `odoo-{originalId}/` sibling directories were merged into their products'
directories on 2026-08-24, with every suggestion's `sourceFile` rewritten to match — the Odoo
identity lives on in `sourceNotes.workingId`. When a product is published,
`scripts/publish-product.mjs` moves its whole directory to
[`../completed/`](../completed/), so this directory's product count *is* the
work-remaining list. `npm run report:images` is the read-only survey of everything staged
here — confirmation counts, cross-product duplicate photographs, orphans.

## A raw block is not a Draft A object

`raw-block.json` is the input extraction will read, not its output. It carries `sourceNotes`, the
pre-mapped category / subcategory / `suggestedCollections`, `pricing.referencePrice`, the
transformed `variants`, and *suggested* `images` with their provenance inside them. It carries no
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

Each entry is an object rather than a bare path: `{ path, confirmed, sourceFile }`, plus `role`
on a general image and `verifiedDistinct` on a variant one. **`confirmed` is `false` in every
entry of every file here**, and the provenance rides inside the entry rather than in a parallel
block — which is what lets it survive Draft A extraction rather than being stranded in this
directory ([ADR-056](../../docs/decisions/ADR-056-image-confirmation-provenance-and-draft-similarity.md)).
`verifiedDistinct` carries the source system's `verified_distinct` hash check forward as evidence
for whoever is reviewing: it says two files differ, not that this is the right photograph for
this variant. A missing flag reads as *not* verified. Nothing here is confirmed.

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
