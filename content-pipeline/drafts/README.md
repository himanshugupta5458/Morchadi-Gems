# content-pipeline/drafts

Draft A objects awaiting or undergoing owner review. **This directory starts empty**, and this
file is the only thing in it that git tracks.

## Convention

| Property | Rule |
| --- | --- |
| Filename | `PNNN.json` — the object's own `productId`, so the file and the record cannot disagree |
| Contents | Exactly one Draft A object per file. The validator also accepts an array, labelling elements `file.json#N`, but one object per file is the convention here so a file can be moved on its own |
| Id assignment | Sequential, by pipeline code and never by the model, at the moment the id's first file is written. **Two ranges** — see [Id reservation](#id-reservation-two-paths-one-rule) below |
| Id reuse | Never. A rejected candidate's number dies with it and gaps in the sequence are correct — see [ADR-051 decision 4](../../docs/decisions/ADR-051-draft-a-content-pipeline.md) |

Every file here should have a row in
[`docs/pipeline-prep/drafts-in-progress.md`](../../docs/pipeline-prep/drafts-in-progress.md).
The row is added by hand on this path; on the migration path
[`scripts/prepare-migration-batch.mjs`](../../scripts/prepare-migration-batch.mjs) appends it.

## Id reservation: two paths, one rule

**An id is reserved by the first file named after it, and never by a table.** That rule is
unchanged from ADR-051 decision 4; what
[ADR-054](../../docs/decisions/ADR-054-stage-0-migration-batch-preparation.md) added is a second
kind of file that can be the first one.

| Path | The file that reserves the id | Range |
| --- | --- | --- |
| Fresh / hand-made | `content-pipeline/drafts/PNNN.json` — this directory | The next unused number **above the highest id the migration has assigned** — read it from the register, never assume it. A fresh id may not land inside the migration's range |
| Odoo migration (Stage 0) | `content-pipeline/incoming/{batch-id}/PNNN/raw-block.json` | **P101 upward**, one id per accepted record. The 542-record Phase B export is expected to occupy **P101–P642** |

`data/products.json` holds P001–P049. **P050–P100 are permanently retired** — the gap is a
legible boundary between original catalogue products and migrated Odoo listings, and ADR-051
decision 4 already established that gaps are correct and that a retired number never comes back.

**P642 is an expectation, not a reservation.** It is what 542 accepted records starting at P101
work out to, and the export has not arrived. Fewer records means a lower ceiling and more means a
higher one, so the next fresh id is whatever sits above the highest number the register actually
shows — which is why the fresh row above names the register rather than a figure.
The example row in the register still names P050 for illustration only; it is not a reservation
and never was.

A raw block under `content-pipeline/incoming/` is **not** a Draft A object and must not be
validated as one — see [`../incoming/README.md`](../incoming/README.md). It reserves the id, and
extraction turns it into the draft that eventually lands here.

## The stage vocabulary

The register's `Stage` column has **six** values, and the first of them belongs to a file that is
not in this directory yet:

| Stage | Where the file is |
| --- | --- |
| `queued` | `content-pipeline/incoming/{batch-id}/PNNN/raw-block.json`. Id assigned, source transcribed, **Draft A extraction has not run** |
| `extracted` | Here. The skill has produced the draft and `validate-draft-a.mjs` passes |
| `in-review` | Here, being read |
| `confirmed` | Here, every attribute `confirmed: true` |
| `priced-and-shot` | Here, with a price and at least one image |
| `awaiting-publish` | Written into `data/products.json` as a `draft` record, blocked on owner approval |

`queued` was added by ADR-054 rather than reusing `extracted`, which would claim a Draft A run
that has not happened. The full definitions are in
[`docs/pipeline-prep/drafts-in-progress.md`](../../docs/pipeline-prep/drafts-in-progress.md#stages).

## What a file here has not yet been through

`attributes[].confirmed` is `false` on every attribute in this directory. A draft with
`confirmed: true` sitting here is a hard validation failure rather than a state — it claims a
review that has not happened.

## Check before review

```
node scripts/validate-draft-a.mjs content-pipeline/drafts
```
