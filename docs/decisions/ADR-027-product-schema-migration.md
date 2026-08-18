# ADR-027 — The product record grouped by purpose, four named option controls, and pictures that follow a choice

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 24
**Supersedes the record shape in:** [ADR-002](ADR-002-product-data-model.md)
**Builds on:** the image convention in [ADR-006](ADR-006-product-image-convention.md), the
product page in [ADR-009](ADR-009-product-page.md), the pricing seal in
[ADR-011](ADR-011-checkout-address-step.md), the options model in
[ADR-019](ADR-019-product-options.md), and the all-real catalogue in
[ADR-021](ADR-021-all-real-catalogue.md)

## Context

Three problems, all of them the same problem seen from different sides: the product record
had no room left in it.

**The record was a flat list of sixteen keys with no structure to hang anything on.**
`price` and `mrp` sat beside `rating` and `reviewCount`, which sat beside `featured` and
`isNew`. Nothing in the shape said which of those were money and which were merchandising.
Every new field made the list longer and the record harder to read, and the one property the
codebase most needs to be able to state — *this is the amount charged, and it lives in
exactly one place* — was a convention held up by a comment.

**`details` was a closed list of six optional keys.** `material`, `weight`, `closure`,
`type`, `stone`, `size`, and nothing else, enforced by the validator. A watch has a strap. A
hair clip has a ribbon width. A plated piece has a plating thickness. Every one of those was
a schema change plus a validator change plus a component change, and the component that
rendered them iterated a fixed table of six rows, so a spec that was not on the list could
not be shown at all. Forty-nine real products already strained against six keys.

**An option had no idea how it wanted to be asked.** [ADR-019](ADR-019-product-options.md)
gave a product `{ name, values }` and let `ProductOptionSelector` guess the control from the
count: six values or fewer became chips, anything longer became a select. That guess is
wrong as soon as two groups of the same size are different kinds of question. P006's four
locket shapes are a set to compare against each other. P048's four ribbon finishes are a set
to *look at*. Both are four values, and rendering them identically loses the distinction the
merchandiser was making.

Alongside those, two capabilities the catalogue was ready for and the code was not: a product
photographed from more than one angle, and a product photographed in more than one finish.
`images` was already a `string[]` and `ProductGallery` already existed, but nothing shipped
with a second image, so the gallery had never rendered against real data. And a shopper
choosing "Golden" on P010 was shown a picture of the silver one, because no mapping from a
choice to a photograph existed anywhere.

## Decision

**Group the record by what each field is for.**

```
{ id, name, category, collections?,
  pricing: { price, mrp },
  media:   { images, variantImages? },
  options?: [{ name, type, values, default }],
  specs:   { <anything>: string },
  description,
  rating:  { average, count },
  reviews, stock: { inStock }, flags: { featured, isNew } }
```

Six groups, each answering one question: what it costs, what it looks like, what a buyer
chooses, what it is made of, how it was received, whether it can be sold and how it is
merchandised. `pricing` is the point: an amount now has a named home, and "does this code
touch money?" is answerable by looking at whether it reaches into `pricing`.

**`specs` is an open `Record<string, string>`.** Keys are lower-case spec names; the
validator checks that they are lower-case and that their values are non-empty, and says
nothing at all about which keys are allowed. `lib/specs.ts` orders the familiar six first and
lets anything else follow in the order the record wrote it, and derives the display label by
capitalising the key. Adding a spec is now a data change and only a data change.

**An option names its own control.** `type` is one of `dropdown`, `swatch`, `pills`,
`chips`, and each has its own component. The catalogue decides, because the shape of the
question is a merchandising decision and not something to infer from an array length.
`default` is written down for the same reason: the value a shopper who never opened the
control is recorded as having chosen is a decision, not a side effect of how `values` happens
to be sorted.

**A photograph can be keyed to a choice.** `media.variantImages` maps `"OptionName:value"`
to a path. When the current selection matches an entry, that photograph is the main image; it
resolves to `media.images[0]` otherwise. It is display data and only display data: no amount,
stock check or option validation reads it.

**The gallery and the buy panel share one selection.** They sit in different columns of the
product page and neither can be the other's parent, so `ProductSelectionProvider` holds the
selection above both. Its `children` stay server-rendered, so the title, price, description,
specs and reviews still never reach the browser.

**The money path was narrowed, not merely preserved.** `getOrderPricingCatalogue()` builds
`{ id, name, price, inStock }` objects. `mrp` is no longer merely unreadable through
`OrderPricingEntry` — it is not in the object, so a cast cannot reach it. Its mirror,
`getOrderOptionCatalogue()`, carries `{ id, name, options? }` and no amount at all.

**Two stand-in images were generated** to prove both features against real products rather
than fixtures: `/products/P002-2.webp` (a second view, so the thumbnail strip renders) and
`/products/P010-golden.webp` (the golden finish, so the variant swap fires). Both are
on-brand generated placeholders, not photography, and both are documented as such in
[IMAGES.md](../design/IMAGES.md). The generator's skip-if-exists rule covers them, so real
photography dropped at either path survives a re-run.

## Alternatives considered

**Keep the flat record and add fields to it.** Cheapest change, and the one that made the
next change more expensive. The reason to migrate now rather than at field twenty is that
every consumer has to be touched either way, and touching forty-nine products and a dozen
components once is better than doing it in instalments.

**Group only `pricing` and leave the rest flat.** Tempting, since `pricing` is the group that
carries the safety property. Rejected because a record with one group and eleven loose keys
reads as an exception rather than a scheme, and the next person adding a field would have no
rule to follow.

**Keep `details` closed and add keys as needed.** This is what the six-key list already was,
and it had already failed twice. A closed list is worth its cost when the values drive
behaviour; these drive a `<dl>`.

**Infer the control from the value count, as before.** Free, and wrong for exactly the case
that matters: two groups of four that want different controls. The count heuristic also could
not express "this is a colour" at all, which is what a swatch is for.

**Default to `values[0]` instead of storing `default`.** Works today because every migrated
default *is* `values[0]`. Rejected because it makes the display order and the default the
same decision — reordering the letters would silently change what an untouched selector
records. The tests now use a group whose default is deliberately not its first value, which
is the only way to tell the two implementations apart.

**Put variant images in `options` rather than `media`.** A picture is media. Keeping the
mapping in `media` also means the option record stays purely about the question being asked,
and a product can map a photograph to a value without the option group knowing.

**Render the whole product page as a client component so the gallery sees the selection.**
Simplest wiring, and it would have pushed the description, specs, reviews and related grid
into the browser bundle to move one string. The provider-with-server-children pattern costs
one file and keeps the page's weight where [ADR-009](ADR-009-product-page.md) put it.

**Adopt the 60% discount ceiling as a hard failure.** The brief asked for it. Nine of the
owner's real pieces are marked down further than 60% — P020 at 78.3% is the highest — and
[ADR-021](ADR-021-all-real-catalogue.md) says their prices are not ours to rewrite. Failing
the gate on real data, or editing real MRPs to make a check pass, are both worse than saying
the true thing: the validator now reports those nine as an **advisory** and hard-fails at
80%, which no real product reaches. Bringing them under 60% is a conversation with the owner
about their MRPs, not a code change.

## Consequences

**Easy now.** Adding a spec is a key in `specs`. Adding a photograph is a path in
`media.images`. Photographing a finish is a line in `media.variantImages`. Changing how an
option is asked is one word in the record. Answering "can this code see an amount?" is
reading whether it reaches `pricing` — and for the order path, whether the object it was
handed even has the field.

**Harder now.** The record is deeper, so every access is one hop longer: `product.price`
became `product.pricing.price` in twelve places. The JSON import needs an assertion through
`unknown`, because TypeScript infers a union of literal types from the file that an open
index signature cannot be compared against; `scripts/validate-products.mjs` is what actually
guarantees the shape, and it runs in the gate.

**A new client boundary.** Products with a gallery — two of forty-nine today — now ship
`ProductGallery` and `ProductSelectionProvider` to the browser. The other forty-seven render
`ProductImagePanel` on the server exactly as before, which is asserted by test rather than
left to reading.

**What would force a revisit.** A choice that has to change a price would break the property
this whole design rests on, and would need its own ADR rather than a field. A product needing
more than a handful of variant photographs would outgrow a flat `"Name:value"` map and want a
variant list with its own ids. And if `specs` keys start being read by code rather than
rendered, the open record stops being the right shape and a closed union comes back.
