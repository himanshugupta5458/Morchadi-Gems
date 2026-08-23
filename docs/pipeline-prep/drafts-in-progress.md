# Drafts in progress

The manual register of Draft A objects currently in `content-pipeline/drafts/`. One row per
draft, added by hand when the draft is created and moved by hand to
[`products-completed.md`](products-completed.md) when its product is published.

**Nothing generates or reads this file.** It is a human index over an untracked directory, which
is exactly why it is kept here in tracked documentation: if `content-pipeline/` is lost, this
table is the record that it existed and what was in it.

## Stages

`Stage` is one of these five, in order. They are the manual workflow of
[`README.md`](README.md#the-manual-workflow-raw-content-to-published-product), not states any
code sets.

| Stage | Means |
| --- | --- |
| `extracted` | The skill has produced the draft and `validate-draft-a.mjs` passes. Every attribute is `confirmed: false`. Untouched by human eyes |
| `in-review` | The owner is working through the candidate values, confirming or editing each one against its quoted source phrase |
| `confirmed` | Every attribute is `confirmed: true`. Price and images are still absent — those are the next manual step, not part of review |
| `priced-and-shot` | `pricing.price` and at least one `images.general` entry assigned by hand. This is the state `validatePublishReadiness` is designed to check |
| `awaiting-publish` | Written into `data/products.json` as a `draft` record by the Phase 2 orchestration skill ([ADR-053](../decisions/ADR-053-draft-a-to-product-orchestration.md)), and blocked on the final owner approval. `npm run publish:product PNNN` is the step that turns it on |

A draft that is rejected in review is not a stage. Delete its row, note the id under
[Rejected ids](#rejected-ids) below, and never reuse the number.

## Register

| Product ID | Reference Title (old site) | Category | Stage | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- |
| ~~P050~~ | ~~Gold Plated AD Studs — Traditional Jhumka Style~~ | ~~`earrings`~~ | ~~`in-review`~~ | ~~2026-08-23~~ | **EXAMPLE ROW — not a real draft, delete when the first real one is added.** Shows the format only. `American Diamond` in the source title is a trade name, so it arrives as a candidate with `stoneSource: "unverified-guess"` unless `data/stone-terms.json` maps it — that file does not exist yet |

**The example row is not a reservation.** P050 is the next unused id because `data/products.json`
holds P001–P049, and it stays unassigned until a real Draft A object is created for it. An id is
reserved by being written into a draft, not by appearing in a table.

## Rejected ids

Ids assigned to a draft that was rejected in review. Permanently retired — never reused, per
[ADR-051 decision 4](../decisions/ADR-051-draft-a-content-pipeline.md). Gaps in the sequence are
correct and expected.

| Product ID | Rejected | Why |
| --- | --- | --- |
| _(none yet)_ | | |
