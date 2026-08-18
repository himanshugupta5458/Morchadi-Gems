# ADR-028 — Two bands, not three: the announcement moves into the logo row

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 25
**Supersedes the announcement strip in:** [ADR-005](ADR-005-navigation-and-chrome.md)
**Builds on:** the logo scale in [ADR-022](ADR-022-logo-integration.md) and the header
proportions in [ADR-024](ADR-024-funnel-ui-polish.md)

## Context

The top of every page was three stacked bands: a charcoal announcement strip, a white logo
row, and the charcoal `PrimaryNav`. Two problems, and they are the same problem.

**Charcoal, white, charcoal does not read as one thing.** Three full-bleed bands in
alternating tones read as three separate chrome elements that happen to be adjacent, rather
than as a header. The white row is the brand's row — it holds the logo — and sandwiching it
between two dark strips made it look like a gap between them.

**The widest part of the header was empty.** The logo row is `justify-between` with a logo on
the left and a cart icon on the right. On a desktop container that leaves roughly two-thirds
of the row as dead white space, directly above a charcoal strip carrying the three promises
the shop most wants a shopper to read. The content and the space were one row apart.

## Decision

**Delete the standalone strip and put its messages in the middle of the logo row.** The
header is now two bands: a white row carrying logo, announcement and cart on one baseline,
then the charcoal `PrimaryNav`, untouched.

**The logo row changes layout at `lg`, not its contents.** Below `lg` it stays the flex row it
was — hamburger and logo against the cart — and the announcement is `hidden`. At `lg` and
above it becomes
`grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`: equal outer columns and a middle column that
sizes to the message.

**Equal outer columns, not `justify-between`.** With `justify-between` a middle child sits
between its neighbours, which is only the page's centre when the logo and the cart happen to
be the same width — they are not. Two `1fr` columns put the message on the actual centre
line. `minmax(0, 1fr)` rather than `1fr` so the outer columns yield first if the row ever runs
short, instead of the row overflowing.

**All three messages stay in the flow, stacked in one grid cell.** Each is
`col-start-1 row-start-1 whitespace-nowrap`, so they occupy the same cell and the column is as
wide as the *longest* promise at all times, whichever one is currently visible. This is the
part that matters: the strip could position its messages absolutely because it was a
full-width band with nothing beside it, but a middle column that sizes to its content would
have resized on every rotation and nudged the logo and the cart four seconds apart forever.
Keeping all three in flow also keeps all three in the accessibility tree, which is what the
strip did.

**The styling is a tagline, not a promo.** `text-eyebrow` (11px, `0.22em` tracking), uppercase,
`text-muted` (`#6B6B6B`). On white, tracked small caps in a mid grey read as a line of brand
copy; `ink` would have shouted and `gold-deep` is the accent colour, which would have made
three rotating promises compete with the price and the CTA for the same attention.

**The fade is unchanged** — 700ms opacity cross-fade on a 4s interval, dropped under
`motion-reduce`. The component keeps the same message list built from
`FREE_SHIPPING_THRESHOLD` and `RETURN_WINDOW_DAYS`, so the promises still cannot drift from
the constants that enforce them.

**`AnnouncementBar` became `HeaderAnnouncement`** rather than being deleted and rewritten. It
lost its charcoal band and its own container; the rotation, the messages and the reduced-motion
handling are the same code moved, not copied.

## Alternatives considered

**Keep the strip and fill the logo row with something else.** Search, a phone number, a
tagline. Every candidate was a new thing to design and maintain, and none of them addressed
the banding, which was the other half of the complaint.

**Move the announcement into the charcoal nav bar instead.** It would have removed a band and
kept the messages on a dark ground where they already worked. Rejected because the nav bar is
a navigation control and the announcement is not: putting rotating text inside a row of
dropdown triggers makes the whole row look interactive, and it would have fought the nav for
the same horizontal space at exactly the widths where the nav is tightest.

**Absolutely position the message and centre it over the row.** The obvious way to guarantee
no reflow, and how the old strip worked. Rejected because an absolutely positioned middle
child can overlap the logo or the cart at intermediate widths with nothing to stop it, whereas
a real grid column is accounted for in the row's layout and cannot.

**Reserve a fixed width for the middle column.** `w-[26rem]` and be done. Rejected as a
magic number that has to be re-measured every time a promise is reworded, with a silent
failure mode — a longer message clips or wraps and nobody notices until it ships. Stacking
the three in one cell reserves exactly the right width automatically.

**Show the message on mobile too, smaller.** There is no middle on a 360px row that already
holds a hamburger, a 44px logo and a cart badge. Shrinking it further would have produced
tracked 9px grey text nobody reads. It is a desktop enhancement and is stated as one.

## Consequences

**Easy now.** The header is two bands and reads as one component. The announcement is visible
in the widest, brightest part of the chrome instead of in a strip a shopper's eye skips. The
promises still come from `lib/config.ts`, so changing the free-shipping threshold still
changes the header.

**Harder now.** The announcement no longer scrolls away — it is inside the sticky header, so
it is on screen permanently on desktop. That is a deliberate trade: it is quiet enough at
`text-eyebrow`/`muted` to sit there without nagging, which it would not have been in charcoal.
The logo row also now has three children instead of two, so anything added to it in future has
to reckon with the centre column rather than just appending.

**Unchanged.** The sticky offset: the old strip sat *above* the sticky header and scrolled
away, so it never contributed to the stuck height, and the `lg:scroll-mt-36` anchors on the
product page still clear the header exactly as they did. The cart badge, the nav dropdowns,
the mobile drawer and the logo sizing are all untouched.

**What would force a revisit.** A fourth promise long enough to crowd the logo at 1024px, or a
decision to put a genuine control — search, a locale switch — in the logo row, at which point
the centre column has a competitor and the announcement probably goes back to being its own
thing or moves into the footer.
