# content-pipeline/completed

Draft A objects whose product has been published into `data/products.json`. **This directory
starts empty**, and this file is the only thing in it that git tracks.

## Why these are kept rather than deleted

The draft is the provenance trail behind a live product. Every material, treatment and stone
claim in it carries the `source.quotedPhrase` it came from, and the validator's containment
check has already proved that quote appears verbatim in `sourceNotes.rawContent`. Delete the
draft and a published claim loses the only mechanical evidence of where it came from — the
catalogue would still say "gold-plated brass" and nothing would be able to say why.

Moving rather than copying is deliberate: a draft in
[`../drafts/`](../drafts/) is work in progress and a draft here is closed, and one file cannot
be both.

## Convention

Same filename as in `drafts/` — `PNNN.json`, unchanged on the move, so a product id resolves to
one file wherever it currently sits. Every file here should have a row in
[`docs/pipeline-prep/products-completed.md`](../../docs/pipeline-prep/products-completed.md) and
should no longer have one in `drafts-in-progress.md`.

## What is true of a file here

It has passed `validatePublishReadiness` — every attribute `confirmed: true`, a positive numeric
`pricing.price`, at least one `images.general` entry, a non-null fixed-slug `category`, and
`personalized` resolved to `true` or `false`. Note that this check is **exported but not wired to
any CLI or pipeline**, because Phase 2 is not designed; today it is run, if at all, by hand.
