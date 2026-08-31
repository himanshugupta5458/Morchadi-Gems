# ADR-069: The floating WhatsApp button keeps clear of calls to action

- **Status:** Accepted
- **Date:** 2026-08-31
- **Prompt:** 115

## Context

`components/WhatsAppButton.tsx` has been `fixed bottom-4 right-4` since prompt 4. The previous
prompt's manual pass measured it covering a product card's call to action and recorded the
finding as [TC-10](../testing/RESULT-2026-08-31-card-variant-selection.md): at 1440 × 1000 the
166 × 48 pill sat at `left: 1250, top: 1328` and intersected P408's "Choose Your Options" button
by 53 × 42 pixels — **29% of the control**. P408 is the letter ring, the exact product
[ADR-067](ADR-067-card-variant-selection.md) exists to route to its own page so the shopper can
choose a letter rather than have one chosen for them.

The tempting reading is that the button sits four pixels too low. It does not. A `fixed` element
covers whatever the page has scrolled under it, so the offset that clears P408's button at one
scroll position covers the card above it at the next. The overlap is a property of the layer,
not of the offset, and the earlier result said so: *"the overlap is scroll-dependent, since the
button is fixed and the grid scrolls under it, so which card it lands on varies"*.

The geometry is worth stating plainly, because it rules out the obvious fixes. The container is
centred with a 1280px maximum and 40px of padding at `lg`, so the free space to the right of the
content column is 120px at 1440, 40px at 1024, 24px at 768 and 20px at 375. A 48px circle fits
in the gutter only above roughly 1360px of viewport. **Below that, no right-anchored fixed
element can avoid the content column**, and reserving a lane by padding the page would narrow
the grid at every width to solve a problem that exists in one horizontal band of it.

## Decision

The button reads the page instead of guessing at it, and it does two things:

1. **While the page is scrolling, it is not on the page.** It fades out on the first scroll
   event and returns once the page has been still for 160ms. Scrolling is the entire window
   during which a static corner button sweeps across every control in the layout.
2. **When the page settles, it moves out from over any call to action it landed on.**
   `liftClearingObstacles` in `lib/floating-contact.ts` is handed the button's own rectangle and
   the rectangles of everything matching `CONTACT_OBSTACLE_SELECTOR`, and returns how far up to
   travel. A product grid puts one row of actions every card-height — 424px at 1440, 354px at
   375 — so the clear space is always a short hop away, and the lift is bounded at 320px.

**A product card is deliberately not an obstacle.** A card is a link over its whole area, so a
button overlapping one corner of a photograph costs nothing; a button overlapping the 44 pixels
that add a piece to a cart costs the sale. The obstacle set is `main button, main select,
main input, main [role="button"], main [data-control="action"]` — real controls, plus the
`data-control="action"` attribute `ButtonLink` stamps on anchors that are styled as buttons,
which is what makes the card's "Choose Your Options" link an obstacle while the card itself is
not.

Scoping the selector to `main` is what excludes the header, the footer and the button itself
without naming any of them.

The arithmetic lives in a module of plain numbers so it can be tested without a browser, and
`scripts/measure-floating-contact.mjs` checks that the same rule is being applied to real
rectangles in a real browser. The rule is asserted once; the two suites disagree about nothing.

## Alternatives considered

**Nudge the offset.** The one that was asked for and the one that does not work. It relocates
the collision to whichever card is under the new position. The previous prompt's result already
identified this.

**Shrink the pill to an icon-only circle.** Cuts the footprint by two thirds and puts the button
entirely in the page gutter above ~1360px — but does nothing at 1024 and below, where the gutter
is 40px, and it costs the brand a legible "Chat with us". Worth doing on its own merits some
day; not a fix.

**Reserve a lane by padding the content.** Genuinely general, and genuinely destructive: 80px of
right padding at 375 leaves 275px of content, and the asymmetry is visible at every width. It
would also narrow the whole page to protect one horizontal band of it.

**Hide it whenever a control is underneath.** Simple, and it hides the button for most of a
product grid — the corner nearly always has a card CTA under it at narrow widths. Moving out of
the way beats disappearing.

**Move it into the header, or dock it to a mobile bar.** Solves the overlap by deleting the
feature. There is no mobile bottom bar to dock to, and a floating contact button that is not
floating is a link in a nav.

## Consequences

`WhatsAppButton` is now a Client Component with two window listeners and a `getBoundingClientRect`
sweep per settle — roughly 30 elements on the shop page, run once per scroll-stop rather than per
frame. That is the cost, and it buys a property no amount of CSS could state: the button covers
no call to action at any scroll position.

Any control added anywhere on the storefront is avoided automatically, because the selector names
element kinds rather than components. The one thing a future author has to remember is that an
**anchor** styled as a button needs `data-control="action"` — `ButtonLink` supplies it, so this
only matters to a hand-rolled one.

`liftClearingObstacles` returns `0` — stay in the corner — when nothing within reach is clear.
That is deliberate: a page whose entire right-hand column is controls has no better answer, and a
button parked halfway up the screen is worse than one in the corner the shopper expects. It has
not occurred on any page measured.

Revisit this if the storefront ever grows a second floating layer, or if the settle delay proves
noticeable on a slow device — both would be reasons to move the measurement into a
`requestAnimationFrame` loop rather than a timeout.
