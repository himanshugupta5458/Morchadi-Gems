# ADR-031: A mobile scale of its own, added under the desktop layout rather than beside it

- **Status:** Accepted
- **Date:** 2026-08-19
- **Prompt:** 30

## Context

The storefront was designed at desktop width and reached mobile by stacking. Every type
size, every image aspect ratio and every unit of vertical spacing was a single unprefixed
value that a phone inherited unchanged, so the phone got the desktop composition rendered
in a 390px column. Nothing was broken and nothing overlapped, which is why it survived
thirty prompts — the pages were simply far taller than they needed to be.

Four measurements make the case concretely, at a 390px viewport.

**The hero ran past one screen.** A 52px headline, a 28px gap repeated five times, 56px of
band padding above and below, and a 16:10 image that is 244px tall on a full-bleed element
came to roughly 815px of hero under an 88px header, on an 844px-tall phone. The first thing
a shopper saw was that they had not yet seen anything.

**Two product cards filled the viewport.** A square image is 167px tall in a two-column
grid, and 16px of body padding, four 12px gaps, a reserved two-line name and a button put
the card at ~363px. Two cards and their row gap exhausted the screen, so the grid read as a
list.

**Ten category tiles were a scroll of their own.** A 4:5 portrait tile is 209px tall at that
width; five rows of them is over 1,000px to pass ten links.

**One label did not fit.** This was the only real defect rather than a matter of scale.
`HAIR ACCESSORIES` at `text-label` (12px, 0.14em tracking) measures 133.1px in Jost. In a
two-column grid at 360px the tile is 152px wide and `px-4` leaves 120px of room, so the
label broke mid-word. At 390px it fit with 2px to spare, which is why it looked fine on some
phones and clipped on others.

Separately, the floating WhatsApp button is `fixed bottom-4 right-4` and 48px tall, so it
owns the bottom 64px of every mobile viewport. Nothing reserved that lane, so at the end of
a scroll it sat over the last row of a product grid, over *Continue shopping* on the cart,
and over the related products on a product page.

The constraint on fixing any of this was that the desktop layout is signed off and must not
move by a pixel.

## Decision

**Compact values go on the unprefixed utility; the original value is restated at `sm:`.**
Tailwind's breakpoints are min-width, so an unprefixed utility governs every width until
something overrides it. Where a value was already `X lg:Y`, the base half was silently
governing tablets too, and lowering it would have moved them. So each change is a pair: the
new mobile value unprefixed, and the value that was there before restated at `sm:`.

```
py-14 lg:py-32   →   py-8 sm:py-14 lg:py-32
aspect-square    →   aspect-[5/4] sm:aspect-square
text-heading sm:text-heading-lg   →   text-heading-sm sm:text-heading-lg
```

The consequence is that **nothing at 640px or above changes at all**, which is a stronger
guarantee than "desktop is unchanged" and a much easier one to verify: the `md:`, `lg:` and
`xl:` class multiset of every touched file is identical before and after, and the only
`sm:` classes added are restatements of values that were previously unprefixed.

**Mobile is below `sm`, not below `lg`.** Restoring at `sm` (640px) rather than `md` (768px)
means the compaction applies only to phones. A 640px-wide window keeps exactly the layout it
had. This is narrower than the prompt allowed — it permitted `sm` to change — and it was
chosen because it makes the desktop guarantee mechanical rather than a matter of judgement.

**One new token, `text-display-sm` (36px/−0.02em).** The type scale had a 52px step and then
nothing until 30px, and the hero headline needed a rung between them. Section headings and
product titles did not need a new token — they drop to the existing `text-heading-sm`, which
is what the scale already offered.

**The floating button gets a reserved lane rather than a new position.** A fixed element
will always overlay *something*; what it must not do is come to rest on top of a control. So
both elements that can end a scroll reserve the button's 64px: `main` takes `pb-16 sm:pb-0`
and the footer takes `pb-24`. The button itself is unmoved and unresized, because it is a
44px-plus tap target and shrinking it to solve an overlap would trade one usability problem
for another.

That footer change forced a second, smaller decision. `py-14 lg:py-16` had to become
`pt-10 pb-24 sm:pt-14 sm:pb-14 lg:pt-16 lg:pb-16`, because Tailwind emits `py-*` before
`pb-*` within the base layer and a shorthand/longhand pair that relies on emission order is
a trap for the next editor. The longhands say the same thing at every width and say it
unambiguously.

**Tap targets were not touched.** Padding came out of containers, cards, badges and stacks,
never out of a control. Form inputs keep `px-4 py-3` (~50px), collection chips keep `py-3`
(42px), and the in-card *Add to cart* keeps the `sm` button scale (~38px) it was given in
[ADR-024](ADR-024-funnel-ui-polish.md). Compact spacing around comfortable controls was the
goal; smaller controls were not.

## Consequences

At 390px the hero loses ~195px (image 244→195, band padding 112→64, stack gaps 140→80,
headline 110→76), which brings it inside one screen. Product cards lose ~56px each and the
row gap 12px more, so a third card is visible where two were. Category tiles lose 40px each,
taking ~216px off the ten. The measured label now needs 122.0px against 138px of room at
360px, so it fits on one line at every common phone width with margin to spare.

The cost is a second scale to keep in mind. A future component that sets an unprefixed
spacing or type value is setting it for phones *and* desktop, and is a desktop regression
waiting to happen. `lib/responsive-scale.test.ts` asserts the twenty-odd mobile/desktop
pairs and the footer longhands so the `sm:` half cannot be dropped without a red test, and
the rule is written into `DESIGN_SYSTEM.md` under *Responsive scale*.

This ADR does not touch the details table. The empty half-row it was reported to have was
already gone: `ProductDetailsList` has been a single-column `dl` that filters empty values
since [ADR-027](ADR-027-product-schema-migration.md), and both the deployed HTML and the
current source render one row per populated spec with no grid and no empty cell.

## Alternatives considered

**Restore at `md:` instead of `sm:`.** The prompt allowed it and it would have compacted
small tablets too. Rejected because it changes the 640–767px band, and the value of this
pass is that the untouched region is provable by inspection.

**A `max-sm:` variant for the mobile values.** Tailwind 3.4 supports it, and it reads well —
the mobile value is visibly the exception. Rejected because it inverts the codebase's
existing mobile-first convention, and mixing both directions is worse than either.

**Move or shrink the WhatsApp button.** Rejected: see above. Reserving the lane fixes the
reported overlaps without touching a tap target.
