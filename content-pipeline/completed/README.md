# content-pipeline/completed

The provenance bundle behind every product published into `data/products.json`: the Draft A
object (`PNNN.json`) and, since
[ADR-057](../../docs/decisions/ADR-057-staging-colocation-and-completed-tracking.md), the
product's whole staging directory (`PNNN/` — raw block, downloader manifest and source images),
both moved here by `scripts/publish-product.mjs` at publish. **Unlike its siblings, this
directory is tracked in git**: what it holds is the evidence behind claims that are already
live, and it enters history in the same change that publishes them.

## Why these are kept rather than deleted

The draft is the provenance trail behind a live product. Every material, treatment and stone
claim in it carries the `source.quotedPhrase` it came from, and the validator's containment
check has already proved that quote appears verbatim in `sourceNotes.rawContent`. Delete the
draft and a published claim loses the only mechanical evidence of where it came from — the
catalogue would still say "gold-plated brass" and nothing would be able to say why.

Moving rather than copying is deliberate: a draft in
[`../drafts/`](../drafts/) is work in progress and a draft here is closed, and one file cannot
be both.

The same reasoning covers the staging bundle: `sourceFile` provenance in a draft points into
`PNNN/raw/`, and the source photographs behind the published `public/products/` files exist
nowhere else once `incoming/` empties.

## Convention

Same filename as in `drafts/` — `PNNN.json`, unchanged on the move, so a product id resolves to
one file wherever it currently sits; its staging directory keeps its `PNNN/` name beside it.
Every file here should have a row in
[`docs/pipeline-prep/products-completed.md`](../../docs/pipeline-prep/products-completed.md) and
should no longer have one in `drafts-in-progress.md`.

## What is true of a file here

It has passed `validatePublishReadiness` — every attribute `confirmed: true`, a positive numeric
`pricing.price`, at least one `images.general` entry, a non-null fixed-slug `category`, and
`personalized` resolved to `true` or `false`. This check now has two callers, both from Phase 2
([ADR-053](../../docs/decisions/ADR-053-draft-a-to-product-orchestration.md)): the orchestration
skill runs it as its first gate, and `scripts/publish-product.mjs` runs it again at publish,
because the draft file is hand-edited between those two points and publishing cannot be undone.
