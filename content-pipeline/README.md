# content-pipeline

Working files for the Draft A content pipeline
([ADR-051](../docs/decisions/ADR-051-draft-a-content-pipeline.md)). This is a **workbench, not a
record**: a file here is unpublished, unconfirmed, or mid-review, and nothing in the application
reads this directory.

## Layout

| Path | Holds |
| --- | --- |
| [`incoming/`](incoming/) | Stage 0 migration batches ([ADR-054](../docs/decisions/ADR-054-stage-0-migration-batch-preparation.md)) — raw blocks with real product ids assigned, **before** Draft A extraction has run. `{batch-id}/PNNN/raw-block.json`, plus a manifest and a needs-attention report |
| [`drafts/`](drafts/) | Draft A objects awaiting or undergoing owner review — `PNNN.json`, one object per file |
| [`completed/`](completed/) | Draft A objects whose product has been published into `data/products.json` — moved here, not deleted, so the provenance trail behind a live product survives |

All three start empty. Their `README.md` files are the only tracked contents; see
[Tracking](#tracking-and-gitignore) below.

## What is not here

- **No prices and no images.** Phase 1 quarantines a source price to
  `pricing.referencePrice` as a descriptive string and leaves `pricing.price` and `pricing.mrp`
  null; `images.general` and `images.variantImages` stay empty. Both are assigned by hand
  between the two validator passes. A raw block in `incoming/` does carry *suggested* image
  paths with their source provenance attached — that is a proposal being carried to the manual
  assignment step, not a value it has already made, and it is why a raw block is not a draft.
- **No product records.** Nothing in this directory is a `Product`. A draft becomes a catalogue
  entry only by being written into `data/products.json` in a commit, which is the
  catalogue-as-code rule of [ADR-001](../docs/decisions/ADR-001-tech-stack.md) and is unchanged
  by this pipeline.
- **No decisions.** A candidate `value` in a draft is a proposal attached to its source quote.
  It becomes a claim when the owner confirms it in review and not before.

## Tracking and gitignore

`.gitignore` ignores the *contents* of this directory while keeping the four `README.md` files
tracked, so a fresh clone gets the folder structure and its explanation but none of the working
data. The recommendation and the argument against it are written up in
[`docs/pipeline-prep/README.md`](../docs/pipeline-prep/README.md#tracking-recommendation--owner-decision-needed);
**it is a proposal awaiting the owner's decision, not a settled rule.**

## Preparing a migration batch

```
node scripts/prepare-migration-batch.mjs <export.jsonl> <batch-id>
```

Stage 0 only: validate the Phase B JSONL export, assign real product ids from **P101**, transform
the Odoo variant and image shapes, and write the queue into `incoming/{batch-id}/`. **It does not
run Draft A extraction** — that is a separate, human-supervised step afterward, in sub-batches.
Read `incoming/{batch-id}/needs-attention.md` before anything else. See
[`incoming/README.md`](incoming/) and
[ADR-054](../docs/decisions/ADR-054-stage-0-migration-batch-preparation.md).

## Validating what is here

```
node scripts/validate-draft-a.mjs content-pipeline/drafts
```

Point it at `drafts/` and nothing else. A raw block under `incoming/` is not a Draft A object
and every one of them would fail — correctly.

Walks the directory recursively for `*.json` and runs the pre-review check
(`validateDraftA` — structure and provenance). Exit 1 on a hard failure or unreadable JSON,
exit 2 on a usage error. The post-review check `validatePublishReadiness` is still **not** wired
to this CLI, and for the original reason: running it over freshly extracted drafts would fail
every one of them by design. See the [ADR-051 addendum](../docs/decisions/ADR-051-draft-a-content-pipeline.md#addendum-2026-08-23--the-validator-exists-and-the-allow-list-gate-does-not).

It now has two callers, both from Phase 2
([ADR-053](../docs/decisions/ADR-053-draft-a-to-product-orchestration.md)): the orchestration
skill `.claude/skills/draft-a-to-product-skills.md` runs it as its first gate, and
`scripts/publish-product.mjs` runs it again at publish, because the draft file is hand-edited
between those two points and publishing cannot be undone.

## Publishing a draft

```
npm run publish:product PNNN
```

Flips `PNNN` from `draft` to `active` in `data/products.json`, regenerates `data/keyword-map.json`,
moves `drafts/PNNN.json` to `completed/PNNN.json`, and prints the two register rows to update by
hand. It refuses if the readiness check fails, if the record is not in the catalogue, if it is
already active, or if publishing would give one primary keyword two owners. The record itself is
written into `data/products.json` beforehand by the orchestration skill, always as a draft.
