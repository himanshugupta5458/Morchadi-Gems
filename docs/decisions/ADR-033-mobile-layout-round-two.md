# ADR-033: Four mobile layouts that differ in kind from their desktop counterparts, not just in scale

- **Status:** Accepted
- **Date:** 2026-08-19
- **Prompt:** 32

## Context

[ADR-031](ADR-031-mobile-scale.md) gave the storefront a second *scale* — smaller type,
tighter spacing, shorter image boxes below `sm`. It did not change any layout's *shape*: a
phone still got the desktop composition, only smaller. Four places on the home page are long
on a phone for reasons that no amount of rescaling fixes, because the problem is the shape
itself.

**The hero photograph earns its place on a laptop and not on a phone.** At `lg` it is the
section's ground, with the copy sitting in the empty left third the picture was composed
for. On a phone it cannot do that — it becomes a separate band stacked above the copy, an
`aspect-[2/1]` strip that costs ~195px to show a crop the composition was never intended to
produce. It pushes the headline and both CTAs down without adding anything.

**Ten category tiles is five rows.** Even square at `aspect-square` (ADR-031), ten tiles two
abreast is five rows of ~136px plus gaps — around 740px to offer ten links. Categories are
the primary navigation of the store and they were the longest thing on the page.

**Each product strip is four rows to show eight pieces.** `New Arrivals` and `Best Sellers`
hold eight products each. Two abreast on a phone that is four rows of ~310px cards — roughly
1,240px per strip, twice, for content that is a *taste* of the collection with a "view all"
next to it.

**The footer is one long column.** Six blocks stacked — brand, four link lists, payments —
where five of them are narrow lists that waste most of the width they are given.

Separately, and found while checking the first of these: **the site already had a horizontal
overflow on phones.** `TestimonialCarousel` bleeds its track to the right edge with `-mr-6`
(−24px), but the container's padding is `1.25rem` (20px) below `sm` and only reaches
`1.5rem` (24px) from `sm` up. A flat −24px bleed therefore overhangs a phone viewport by
exactly 4px, and nothing in the tree clips it. It has been there since the carousel shipped.
ADR-031's overflow scan missed it because that scan looked at widths and grid tracks and did
not consider negative margins.

## Decision

**The discipline from ADR-031 is unchanged and is the binding constraint:** compact values
go on the unprefixed utility, and any value that utility used to carry at 640px and above is
restated at `sm:`. Nothing at `sm` or above changes. Every claim below is checked that way.

**The hero photograph is `hidden sm:block`.** The mobile hero becomes purely typographic —
eyebrow, two-tone headline, rule, lede, two CTAs — and the band padding goes `py-8` → `py-12`
so it reads as a composition rather than as a hero with its picture missing. `flex-col-reverse`
with one remaining child leaves no gap.

Hiding it is not enough on its own. `priority` emits a preload, and a preload fetches
whether or not the element is displayed, so `display:none` alone would have left phones
paying for a photograph they never see. The `sizes` hint is what actually prevents it:
`(min-width: 640px) 100vw, 1vw`. **The unit is the whole point.** Next builds the source set
from the `vw` values it finds in `sizes`; a `px` fallback contributes none, leaves 640w as
the smallest candidate, and the phone still downloads it. `1vw` pulls the small widths into
the set, so a phone selects the 16w candidate (0.1KB) instead of the 640w one (8.8KB), while
any viewport at 640px or above still resolves the hint to `100vw` and selects exactly what
it selected before.

**Categories become a scroll-snap carousel below `sm`.** The `<ul>` goes
`flex snap-x snap-mandatory overflow-x-auto` with each tile `w-[40%] shrink-0 snap-start`,
and every one of those is restated at `sm` (`sm:grid sm:snap-none sm:overflow-x-visible`,
`sm:w-auto sm:shrink sm:snap-align-none`) so the 3-up and 5-up grids are untouched. The
track bleeds right by `-mr-5`, which is *exactly* the 20px base container padding, so it
reaches the viewport edge and no further.

40% is chosen so that **2.3 tiles are visible at every common phone width** — the third tile
peeks by 44–55px, which is the scroll affordance, so no arrow or dot row is needed. Because
the width is a percentage, the ratio holds at 360, 390 and 414px rather than drifting.

This narrows the tile below the width ADR-031 sized the label for. That is accepted rather
than worked around: at 360px the tile's inner width is 120.0px against the 122.0px that
`HAIR ACCESSORIES` needs, so it wraps — **at the space, to two clean lines**, because the
governing measurement is now the longest *word*, `ACCESSORIES` at 87.0px, and every tile is
comfortably wider than that. The ADR-031 defect was a mid-word break from overflow; a
two-line label centred over the scrim is not that. Two lines is 56px inside a 64–72px
gradient, so it stays on its ground. Every other label (longest: `NECKLACES`, 74.0px) is one
line at every width.

**Product strips cap at four on a phone, with the rest one tap away.** `ProductGrid` takes a
`mobileLimit`; items past it get `hidden sm:list-item`. The header's `ViewAllLink` becomes
`hidden sm:flex` and a full-width secondary `ButtonLink` appears under the grid at
`sm:hidden`, so the link sits *after* the products where it belongs on a phone.

Two decisions inside that are worth stating. **The cap hides, it does not slice.** A Server
Component has no viewport, so slicing the array would need either a client component that
renders the wrong count until it hydrates or a single count shared with desktop; hiding in
CSS keeps all eight in the markup for crawlers and keeps the desktop grid byte-identical. A
hidden card is `display:none`, so its lazily-loaded image is never fetched — the cap is a
real saving on a phone, not just a visual one. **The restore is `sm:list-item`, not
`sm:block`**, because `list-item` is what an `li` was before the cap existed.

The two links to the same collection carry *different* labels — "View all" in the header,
"View all new arrivals" below the grid — so a screen reader is never offered the same name
twice for one destination, and the mobile label is the more descriptive of the two.

**The footer goes two-up below `sm`.** `grid-cols-2` at base with the brand block and the
payments block spanning both (`col-span-2 sm:col-span-1`), so the four link lists pair off
and the footer loses roughly half its height. Because two columns is denser, each footer
link stops being a bare 22px line box and becomes `block py-1` — a ~30px target, clearing
the 24px WCAG 2.2 minimum with margin — and returns to `sm:inline sm:py-0` above the
breakpoint.

**The pre-existing bleed overflow is fixed** by pairing the bleed with the padding at each
width: `-mr-5 sm:-mr-6`. Below `sm` the track now stops exactly at the viewport edge instead
of 4px past it; at `sm` and above it is the −24px it always was.

## Consequences

The phone home page loses roughly 195px of hero, ~450px of category grid, and ~620px from
each product strip — the bulk of its length — while the desktop page is unchanged.

The costs are real and worth naming. **The carousel hides seven of ten categories behind a
swipe**, which is a discoverability trade for a scroll-length one; the 2.3-tile peek is what
makes the swipe obvious, so narrowing the tile further would break the affordance that
justifies the pattern. **The capped strips ship markup a phone does not display**, about
four cards' worth of HTML per strip; that is the price of keeping one render correct at both
widths. **`scrollbar-none` is unprefixed** on both carousels, matching the existing
`TestimonialCarousel`; `scrollbar-width` has no effect on an element that does not scroll,
so it is inert in the grid state.

`lib/mobile-layout.test.tsx` asserts the cap's behaviour, the restores on every carousel
property, the footer spans, the hero's `sizes` hint, and — for both carousels — that the
bleed is paired rather than flat, so the 4px overflow cannot return.

## Alternatives considered

**Render the hero image at a mobile crop instead of hiding it.** A second art-directed
source would keep a picture in the mobile hero. Rejected for now: it needs a photograph that
does not exist yet, and that is a content decision, not a layout one. Worth revisiting if a
portrait hero shot is ever shot.

**A client component reading `matchMedia` for the product cap.** Gives a true slice with no
wasted markup. Rejected: it renders the desktop count until hydration, which is a visible
reflow on the slowest devices, and it would take the home page's two biggest sections out of
static rendering for a few kilobytes of HTML.

**Dots or arrows under the category carousel**, as `TestimonialCarousel` has. Rejected: that
carousel shows one full-width card at a time, where nothing about the layout says there is
more; a 2.3-tile peek says it without adding a control row to a section whose whole purpose
here was to get shorter.

**`overflow-x: hidden` on the body** to kill the 4px bleed overflow. Rejected: it hides the
symptom for every future overflow too, including ones that are real bugs. Matching the bleed
to the padding fixes the actual cause.
