# ADR-050 — One thumbnail strip for every photograph, and clicking one records its choice

**Status:** Accepted
**Date:** 2026-08-21
**Supersedes in part:** the gallery behaviour set out in
[ADR-027](ADR-027-product-schema-migration.md) and
[ADR-036](ADR-036-product-seo-metadata-pass.md)

## Context

The gallery built under ADR-027 kept two sets of photographs apart. `media.images` was the
strip: a row of thumbnails, each one clickable. `media.variantImages` was not in the strip at
all — a mapped photograph appeared only when the shopper selected the option value it was
keyed to, and the component's own note said so plainly: *"the thumbnail strip lists `images`
and only `images`. A variant photograph is not a view of the piece to browse between, it is
what the current choice looks like, so it is reached by making the choice."*

The two were ranked. Choosing a value beat a clicked thumbnail; a clicked thumbnail then won
until the next choice.

Manual testing of P010 found what that costs. Once a shopper clicks a swatch, the gallery
offers no way back. The master images are still in the strip, but the mapped photograph the
shopper is now looking at is not — and neither is any *other* variant's photograph. The only
route between finishes is the option selector, which means the gallery is not a gallery for
the images that most need browsing: the ones that show the difference the shopper is choosing
between.

Two smaller faults fell out of the same arrangement:

- **No thumbnail was marked current while a mapped photograph was showing.** Correct under the
  old rule — none of the listed thumbnails *was* on screen — but it reads as a control that
  has lost track of itself.
- **The strip did not scale.** It was a `grid-cols-5`, so a sixth photograph wrapped to a
  second row with no way to page.

## Decision

**One strip, listing every photograph the product has.** `media.images` in record order
first, then each `media.variantImages` value the list does not already contain,
de-duplicated by path. `buildGalleryImages` in `lib/variant-images.ts` is the single place
that list is built.

**Clicking a mapped thumbnail records its option value.** The alternative was to let the
thumbnail change only the picture, leaving the swatch where it was. We rejected it, and the
reason is not tidiness.

A recorded choice is not display state. `SelectedOptions` is part of a cart line's identity
— it is what `buildCartLines` reads to decide which photograph a line shows, what
`formatSelectedOptions` prints on the receipt, and what the order row carries. A shopper who
clicks the Golden photograph, sees a gold ring fill the frame, and presses **Add to cart**
would, under the display-only reading, have added the Silver one. The disagreement would not
stay on screen; it would follow them into the order.

So the two controls are kept in sync, and the sync is one-directional per interaction:
selecting a value moves the picture, and clicking a mapped picture selects the value.

**Clicking a master image leaves the recorded choice alone.** A photograph in `media.images`
is a view of the piece, not a value's portrait — it is shown for every finish. Selecting a
value from it would mean inventing a mapping the record does not contain. A master image
showing while Golden is selected is not a contradiction; a *Golden* image showing while
Silver is selected is, and that is the one this ADR closes.

**De-duplication keeps the master entry.** If a mapping points at a path already in
`images`, the strip carries one thumbnail and it is the master one, with no option value
attached. The photograph is in `images` because it is a view of the piece; that it also
serves a value does not make it that value's portrait.

**Past five photographs the strip becomes a window.** Five stay visible, with arrows either
side paging by five. The window is always full — the last page ends flush rather than showing
a short row. It follows the shown photograph when a *choice* moves it out of view, but not on
every render, so paging the strip away from what is on screen stays possible. Below six
photographs no arrows render at all, so a two-image product looks exactly as it did.

**Arrow keys step the shown photograph** and move focus with it. Focus has to follow: the
window pages as the selection moves, and a focused thumbnail that scrolls out of the window
unmounts, dropping focus to the body.

## Consequences

- Every photograph a product has is now reachable from the gallery alone.
- Exactly one thumbnail is current at all times.
- **The precedence rule is gone.** There is no ranking between a choice and a click any more,
  because there is no longer a state in which they can point at different pictures. The
  earlier `manualImage`-cleared-on-variant-change mechanism is replaced by a single
  `shownImage`.
- A product mapping every value of an option now shows that option's values twice on screen —
  once as swatches, once as thumbnails. That is the intended cost: the thumbnails show what
  the values *look like*, which is the thing the swatch label cannot.
- Nothing here reads or returns an amount, and this ADR does not change what any option costs.
  A choice remains display data plus cart-line identity, exactly as ADR-019 set out.
- `media.images` still drives SEO on its own. `getImageAlts`, the JSON-LD `Product.image`
  array and `og:image` are unchanged — a mapped photograph has no alt written for it, so the
  main image's alt still stands in when one is shown. See ADR-036.

## Alternatives considered

**Leave mapped photographs out of the strip and add a "back to default" control.** Solves the
dead end without the sync question, but it does not let a shopper compare two finishes by
clicking between them, which is the thing they are actually trying to do.

**Let a thumbnail click change the picture only.** Rejected above: it puts a wrong finish in
the cart.

**Scroll the strip instead of windowing it.** The standard pattern, and it degrades better
with no JavaScript. Rejected because it depends on `scrollLeft`/`scrollBy`, which jsdom does
not implement, so the paging behaviour would have had no test. Windowing is pure state and is
covered.
