# ADR-024 — Funnel UI polish: a present logo, two honest button scales, aligned cards, one price facet, and details where they are read

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 23
**Builds on:** the button and type scale in [ADR-004](ADR-004-design-system.md), the logo
integration in [ADR-022](ADR-022-logo-integration.md), the button spacing pass in
[ADR-023](ADR-023-home-polish.md), the two-tier IA in
[ADR-020](ADR-020-two-tier-catalogue-ia.md), the shop architecture in
[ADR-008](ADR-008-shop-architecture.md), and the product page in
[ADR-009](ADR-009-product-page.md)

## Context

Six defects, all of them things the shopper sees on the way from the home page to the buy
button, and none of them reachable by changing data or logic.

**The logo was sized for a header it no longer needed to fit inside.**
[ADR-022](ADR-022-logo-integration.md) set the mark at `h-9 lg:h-12` inside a `h-16 lg:h-20`
row, and reasoned the ceiling from the constraint that the logo must never be the thing that
makes the header taller. That constraint is real, but it was applied to a header height
nobody had questioned. At 48px in an 80px row, with roughly 12% transparent margin baked into
the artwork, the mark rendered about 36px of ink in 80px of chrome, and read as adrift rather
than restrained.

**The button spacing pass in [ADR-023](ADR-023-home-polish.md) did not go far enough.** It
moved `md` from `px-7 py-3.5` to `px-10 py-4`, a 2px vertical change. On a 12px uppercase
face tracked at `0.14em`, sitting in an 18px line box, 16px of vertical padding still reads
as a label wearing a border rather than as a call to action. The hero's two CTAs are where
this is most visible because they are the largest buttons on the largest surface.

**And it went too far in the other direction on cards.** The same pass left `sm` at
`px-5 py-3`, which is a 42px button inside a card whose whole content column is about 125px
wide at 375px. The button competed with the product it was selling.

**Cards in a row broke alignment on a two-line name.** `ProductCard` let the name be as tall
as it needed to be, so "Emerald Baguette Stacking Ring" pushed its own rating, price and
button 22px below its neighbours'. In a four-up grid this reads as a rendering fault rather
than as a long name.

**"Under ₹999" appeared in two facets at once.** [ADR-020](ADR-020-two-tier-catalogue-ia.md)
made it a collection sourced from a price band, precisely so the collection and the Price
facet could not disagree about where the boundary sat. That reasoning is sound about
*correctness* and wrong about *interface*: the shop sidebar renders `COLLECTIONS` and
`PRICE_BANDS` one under the other, so the guarantee it bought was that the same checkbox
appeared twice with the same label, in two groups, filtering identically.

**The product specs were a full-width band 900px below the buy button.** `ProductDetailsList`
rendered a `gap-px` two-column grid on a `bg-line` ground, so an absent spec was not absent:
it was a grey cell. Products carry two to four of the six possible specs, so most products
rendered a hole. Meanwhile the right column ran out of content under Buy now while the image
column was still 550px tall, leaving a void beside it.

## Decision

### The header grows so the logo can

`h-11 w-auto lg:h-16`, in a header row of `h-16 lg:h-24`. The mark is 44px on mobile and 64px
from `lg`, which renders roughly 48px of ink from `lg` after the artwork's transparent margin.
[ADR-022](ADR-022-logo-integration.md)'s constraint survives intact — the row is still a fixed
height and the logo still cannot be what sets it — but the row was raised 16px first, so 64px
of logo sits in 96px of chrome rather than filling it.

`LOGO_SIZES` moves with it, to `(min-width: 1024px) 106px, 73px`: the two heights turned into
widths at the artwork's 642:388 ratio, so next/image keeps shipping a render matched to the
slot rather than one sized off the 642px intrinsic.

Both `lg:scroll-mt-32` offsets move to `lg:scroll-mt-36`. The sticky header is the row plus
`PrimaryNav`, which is now 141px on `lg`; an anchor target that clears 128px would land under
it.

### Two button scales, chosen by what they sit inside

| Size | Padding | Type | Rendered height |
| --- | --- | --- | --- |
| `md` | `px-12 py-[1.375rem]` | `text-label` (12px / 18px line) | 64px |
| `sm` | `px-4 py-2.5 text-[0.6875rem] leading-4` | 11px / 16px line | 38px |

`md` is the page-level call to action: the hero's two CTAs, Add to cart and Buy now on the
product page, the cart CTAs. 22px of vertical padding around an 18px line box is deliberate
excess — the label is meant to sit in open space, and at this type size anything less reads as
a border drawn tightly around text.

`sm` is the in-card scale and nothing else. It is 38px, down from 42px, and it is explicitly
*not* `md` scaled down: `px-4` is narrow because
[ADR-023](ADR-023-home-polish.md)'s finding still holds — "Add to cart" wraps to two lines in a
two-column 375px grid past about `px-6` — and `leading-4` pins the line box so the height is a
stated number rather than a browser default. Widening `sm` past `px-4` is a regression; check a
two-column card grid at 375px before changing it.

The two are one style at two scales: identical border, fill, hover, tracking and case. Only the
box changes.

### A product card reserves the name's space whether it needs it or not

`line-clamp-2 min-h-[2.75rem]` on the name link: two lines of `text-body-sm` at its 22px line
height, reserved unconditionally. A one-line name and a two-line name now push the rating, the
price and the button to the same offset, so a row shares one baseline without the grid needing
to know anything about its contents. A name past two lines clamps rather than reflowing the row.

`min-h` rather than a fixed `h` is the safe half of the choice: if the type scale changes, the
name overflows its reservation instead of being cut off inside it.

### A price band is a price filter, not a collection

`under-999` is removed from `COLLECTIONS`, from `CollectionFilterSlug`, and from
`CollectionSource` — which loses its `price-band` kind entirely, since it existed for this one
row. The collection tier is now exactly the four curated groups: Gifting, Anti-Tarnish, Best
Sellers, New Arrivals. `PRICE_BANDS` is untouched and remains the only place a price boundary
is expressed.

This amends [ADR-020](ADR-020-two-tier-catalogue-ia.md) rather than superseding it. That ADR's
decision stands whole — two tiers, both resolving through `/shop` query params, both read from a
single constant table, a collection added as one row in `COLLECTIONS` — and this is one row
leaving that table, which is the maintenance path it described. What is reversed is the narrower
claim that a price band was a sensible thing to put in it.

`?collection=under-999` now parses to nothing rather than to a filter. That is the existing
unknown-slug path, not a new one, so a stale link degrades to an unfiltered shop rather than a
404 — and the equivalent live filter is one param away at `?price=under-999`.

### The specs sit under the buy button, in the column the buy button is in

`ProductDetailsList` moves out of its own full-width section and into the product info column,
directly below `ProductPurchaseActions`. Its own `<h2>` travels with it, so the placement is a
property of the component rather than of the page that renders it.

It is a stacked list of label-and-value rows, hairline-separated, rather than a two-column grid
on a `bg-line` ground. An absent spec now takes no space at all instead of leaving a grey cell,
and a product with no specs renders `null` instead of an empty bordered box.

This also answers the void beside the image. The specs are roughly 150px of real content in the
place the gap was, so the two columns end within sight of each other without anything being
padded to fill space.

### Em dashes leave the copy

Every em dash in rendered content is rewritten, in page copy, policy pages, component strings,
API error messages and the catalogue's own review, description and spec text. Each one is
resolved into the punctuation the sentence actually wanted — a full stop where it joined two
sentences, a comma where it fronted an aside, a colon where it introduced a list — rather than
being swapped for a single replacement character everywhere.

Three categories are deliberately untouched:

- **Hyphens in compounds.** `anti-tarnish`, `gold-plated`, `7-day`. Not dashes.
- **Numeric and time ranges.** `7–10 business days`, `10:00 – 18:00 IST`, `₹1,000 – ₹4,999`,
  `Showing 1–20 of 49`. En dashes doing the one job an en dash is for.
- **`OrderTotals`' `—` placeholder.** A typographic stand-in for a number that has no value
  yet, not prose.
- **JSDoc.** It is source, not content, and it never reaches a page.

`lib/copy-dashes.test.ts` enforces the sweep from both ends: it walks the catalogue's
shopper-facing strings, and it scans every `.ts`/`.tsx` under `app`, `components`, `lib`,
`config` and `types` with comments stripped, allowing exactly one file. A grep proves the
sweep once; the test is what keeps it true.

## Alternatives considered

**Leave the header at `h-20` and let a bigger logo set the height.** Rejected. The header is a
sticky element every page's `scroll-mt` is calibrated against, and letting an image decide its
height reintroduces the layout shift that `h-* w-auto` exists to prevent.

**One button size with per-call-site overrides.** Rejected on the same grounds
[ADR-004](ADR-004-design-system.md) rejected a `className` prop: the moment a call site can
adjust the box, "the card button" and "the CTA button" stop being two decisions and become
forty.

**A third button size between the two.** Rejected as unearned. There are two contexts — inside a
card, and not inside a card — and a middle size would be chosen by feel rather than by context.

**Fixed `h-11` on the card name instead of `min-h`.** Rejected: it clips rather than overflows
if the type scale ever changes, which turns a future spacing tweak into silently truncated
product names.

**Keep `under-999` as a collection and hide it from the sidebar's Collection facet.** Rejected.
A slug that is a collection everywhere except the one surface that lists collections is a
special case that every future reader has to rediscover. Removing it makes the two facets mean
two different things, which is the actual fix.

**Keep the details band full-width and just tighten it.** Rejected. Compressing the grid would
have fixed the grey cells and left both real problems: specs 900px from the button they inform,
and a void beside the image.

**Sweep em dashes with a single mechanical substitution.** Rejected. `—` stands in for at least
three different punctuation marks in this copy, and replacing them all with a comma produces
run-ons in the policy pages, where a sentence changing meaning is a legal risk rather than a
style one.

## Consequences

**Makes easy.** The button scale is two numbers in one table in `lib/button-styles.ts`, checked
by a test that names them. The card grid aligns without any component knowing its neighbours'
content. Adding a collection is still one row in `COLLECTIONS`, now without a source kind that
only ever had one member. A new spec key renders in the right place with no layout thought.

**Makes hard.** `py-[1.375rem]` and `min-h-[2.75rem]` are arbitrary values, so they are two
numbers Tailwind cannot warn about if the type scale moves underneath them; both are stated in
`DESIGN_SYSTEM.md` and one is asserted in a test. The em-dash rule is now enforced by a test
that reads the filesystem, which will fail loudly on a legitimate future use and require an
entry in its allowlist rather than a quiet override.

**Would force a revisit.** A logo redraw with different transparent margins changes what 64px
renders. A display-type change to `text-label` changes the button's height, since the padding is
specified around a known line box. A catalogue that starts carrying five or six specs per
product would make the stacked list tall enough to unbalance the column it was moved into.
