# Drafts in progress

The register of every product id that has been assigned and not yet published — Draft A objects in
`content-pipeline/drafts/`, and, since [ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md),
migration raw blocks in `content-pipeline/incoming/` that extraction has not reached yet. One row
per id, moved by hand to [`products-completed.md`](products-completed.md) when its product is
published.

**Nothing reads this file, and only one thing writes to it.**
`scripts/prepare-migration-batch.mjs` appends `queued` rows, because it is the code that assigns
those ids and a register that could disagree with an assignment would be worse than no register.
Every other row and every stage change is typed by hand. It is a human index over an untracked
directory, which is exactly why it is kept here in tracked documentation: if `content-pipeline/`
is lost, this table is the record that it existed and what was in it.

## Stages

`Stage` is one of these six, in order. They are the manual workflow of
[`README.md`](README.md#the-manual-workflow-raw-content-to-published-product), not states any
code sets — with one exception, noted in the first row.

| Stage | Means |
| --- | --- |
| `queued` | Stage 0 has assigned the product id and written its raw block to `content-pipeline/incoming/{batch-id}/PNNN/raw-block.json`. The source text, variants, categories and image suggestions are transcribed; **Draft A extraction has not run**, so there are no candidate values, no quoted phrases and nothing to review yet. Added by [ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md). **The one stage a script writes**: `scripts/prepare-migration-batch.mjs` appends these rows itself, because it is also what assigns the id |
| `extracted` | The skill has produced the draft and `validate-draft-a.mjs` passes. Every attribute is `confirmed: false`. Untouched by human eyes |
| `in-review` | The owner is working through the candidate values, confirming or editing each one against its quoted source phrase |
| `confirmed` | Every attribute is `confirmed: true`. Price and images are still absent — those are the next manual step, not part of review |
| `priced-and-shot` | `pricing.price` and at least one `images.general` entry assigned by hand. This is the state `validatePublishReadiness` is designed to check |
| `awaiting-publish` | Written into `data/products.json` as a `draft` record by the Phase 2 orchestration skill ([ADR-053](../decisions/ADR-053-draft-a-to-product-orchestration.md)), and blocked on the final owner approval. `npm run publish:product PNNN` is the step that turns it on |

A draft that is rejected in review is not a stage. Delete its row, note the id under
[Rejected ids](#rejected-ids) below, and never reuse the number.

**A `queued` row is not a draft yet.** Its file is under `content-pipeline/incoming/`, not
`content-pipeline/drafts/`, and `scripts/validate-draft-a.mjs` would fail it — correctly, because
a raw block is not a Draft A object. It becomes one when extraction runs and the row moves to
`extracted` by hand.

## Register

| Product ID | Reference Title (old site) | Category | Stage | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- |
| ~~P050~~ | ~~Gold Plated AD Studs — Traditional Jhumka Style~~ | ~~`earrings`~~ | ~~`in-review`~~ | ~~2026-08-23~~ | **EXAMPLE ROW — not a real draft, delete when the first real one is added.** Shows the format only. `American Diamond` in the source title is a trade name, so it arrives as a candidate with `stoneSource: "unverified-guess"` unless `data/stone-terms.json` maps it — that file does not exist yet |

**The example row is not a reservation, and P050 is no longer next.** An id is reserved by the
first file named after it, never by appearing in a table. ADR-054 retired **P050–P100**
permanently and starts the Odoo migration at **P101**; the reconciled rule for both intake paths
is in [`content-pipeline/drafts/README.md`](../../content-pipeline/drafts/README.md#id-reservation-two-paths-one-rule).

## Rejected ids

Ids assigned to a draft that was rejected in review. Permanently retired — never reused, per
[ADR-051 decision 4](../decisions/ADR-051-draft-a-content-pipeline.md). Gaps in the sequence are
correct and expected.

| Product ID | Rejected | Why |
| --- | --- | --- |
| _(none yet)_ | | |
