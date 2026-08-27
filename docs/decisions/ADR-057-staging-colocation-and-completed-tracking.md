# ADR-057: Staging co-location, publish-time archival, and tracking `completed/` in git

- **Status:** Accepted
- **Date:** 2026-08-24
- **Prompt:** 86
- **Owner approval:** explicit — every decision here was proposed by the post-pilot pipeline
  audit ([RESULT-2026-08-24-pipeline-audit-post-pilot.md](../testing/RESULT-2026-08-24-pipeline-audit-post-pilot.md),
  Part D) and approved by the owner item by item before implementation.
- **Narrows:** [ADR-054](ADR-054-stage-0-migration-batch-preparation.md) (the staging layout),
  [ADR-052](ADR-052-product-status-field.md)/[ADR-053](ADR-053-draft-a-to-product-orchestration.md)
  (what the publish step moves), and the untracked-`content-pipeline/` recommendation of
  [ADR-051](ADR-051-draft-a-content-pipeline.md) — for `completed/` only.

## Context

The 11-product pilot publish exposed three structural problems around the migration's image
*files* (the image *data* was found sound):

1. The only copy of ~1,000 source photographs for 531 unpublished products sat untracked, on
   one machine, split across 542 `odoo-{originalId}/` downloader directories that were siblings
   of — not inside — their products' `PNNN/` directories. Finding "everything for product X"
   required opening its raw block to learn the `workingId` first, in a batch root of 1,090
   entries.
2. Publish moved only the draft JSON. The 11 published products' raw blocks stayed in
   `incoming/` claiming `stage: "queued"`, with their image directories orphaned beside them —
   indistinguishable from pending work.
3. A byte-level sweep found duplicate photographs to be systemic (10 of the 11 published
   products share a byte-identical main photo with a still-queued product), and nothing in the
   pipeline surfaces that before a reviewer walks into it.

## Decisions

### 1. One directory per product: images are co-located with their raw block

Each product's staging directory holds everything about it:
`incoming/{batch}/PNNN/{raw-block.json, images.json, raw/*.webp}`. The `odoo-{originalId}/`
directories were merged in by `scripts/colocate-staged-images.mjs` (one-off, kept for the
record), which also rewrote every suggestion's `sourceFile` string to the new location and
dropped the downloader's inert `_complete` markers. Safe because no code reads `sourceFile`
after Stage 0 writes it — re-verified immediately before the run, not assumed from the audit.
The Odoo identity survives in `sourceNotes.workingId`/`originalId`.

`scripts/prepare-migration-batch.mjs` still *writes* the old sibling layout and was
deliberately not changed: its ceiling assertion is permanently spent for this migration and it
cannot run again without a new decision (ADR-054); a future export batch should fold
co-location into Stage 0 as part of that decision.

### 2. Publish archives the whole staging directory

`scripts/publish-product.mjs` now moves `incoming/{batch}/PNNN/` → `completed/PNNN/` alongside
the draft move it already performed, locating the raw block by scanning `incoming/*/PNNN/` so
it stays batch-agnostic. `incoming/{batch}/` therefore *is* the work-remaining list — its
product-directory count is the 531 → 0 countdown — and `completed/` holds the full provenance
bundle (draft + raw block + downloader manifest + source images) behind every shipped product.
A product with no staging directory (the fresh, hand-made path) publishes exactly as before.
The 11 pilot products' leftovers were backfilled by hand to match. The id-reservation rule is
untouched: a file named after the id exists at every moment.

### 3. `completed/` is tracked in git; `incoming/` and `drafts/` stay untracked

The middle option `docs/pipeline-prep/README.md` had proposed, now decided: each product's
source images and provenance enter git history *at the moment of publish* — exactly when its
claims go live — growing the repository only by what actually shipped (~180 KB/product).
Unreviewed, unpublished third-party data stays out of history, preserving ADR-051's original
rationale for keeping the pipeline untracked. The durability hole this closes was the audit's
BLOCKING-1: a lost working directory no longer strands the provenance behind anything
published. The still-queued images in `incoming/` remain covered by an external backup taken
the same day, refreshed per sub-batch — a backup, not a repo concern.

### 4. A read-only image report, not more state

`scripts/report-images.mjs` (`npm run report:images`) prints per-product confirmation counts,
**cross-product duplicate-hash groups** (the check that would have caught the pilot's 10-of-11
duplicate mains before publish), confirmed paths missing under `public/`, and orphaned staging
entries. It writes nothing and gates nothing; ADR-056's `confirmed` boolean stays the only
image state. The `stage-images` copy helper the audit also sketched is **not** built — it
remains an open owner decision.

## Consequences

- "All images for product X" is one directory at every stage of its life: `incoming/{batch}/PNNN/`
  while queued, `completed/PNNN/` once published, `public/products/PNNN*.webp` for what shipped.
- The batch root dropped from 1,090 entries to 548 (then 537 after the pilot backfill).
- An abandoned product is visibly stale — its directory simply stays in `incoming/`.
- `git status` after a publish now shows the product's source images as new tracked files; that
  is the intended audit trail, not noise.
- Reviewers start each sub-batch from `npm run report:images`, walking into duplicate-photo
  clusters knowingly instead of rediscovering them one KI at a time.
