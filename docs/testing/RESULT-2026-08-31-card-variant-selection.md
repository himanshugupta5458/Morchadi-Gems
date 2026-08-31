# Test Result: Card variant selection and mixed-row alignment — 2026-08-31

- **Plan:** [PLAN-card-variant-selection.md](PLAN-card-variant-selection.md)
- **Commit:** `1eef3dd`, with the uncommitted working tree of prompts 112 and 113
- **Environment:** local `next dev` on port 3000, no database, no Cashfree credentials.
  Chromium 1234 from the `~/.cache/ms-playwright` cache, driven by `playwright-core` installed
  for the run and removed afterwards
- **Fixture:** `/shop?category=rings&min=199&max=199&sort=name-desc`, whose first row is
  **P009** (`add`), **P005** (`choose-on-page`), **P021** (`add`), **P010** (`choose-on-card`)

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | 390 / 43 / 16 across 449 records, matching ADR-067 exactly |
| TC-02 | Pass | P001, P005 and P408 all `choose-on-page` |
| TC-03 | Pass | Automated, 4 files and 58 cases green |
| TC-04 | Pass | Action tops identical across the mixed row at every width |
| TC-05 | Pass | One card height per row at every width |
| TC-06 | Pass | `scrollHeight - clientHeight` is 0 for "Choose Your Options" at 375, 768 and 1440 |
| TC-07 | Pass | The empty chip row measures 32px on `add` cards, same as a filled one |
| TC-08 | Pass | 375, 414, 768, 1024, 1440 — all rows aligned |
| TC-09 | **Fail** | Price block heights differ within a row: 28px and 52px |
| TC-10 | **Fail** | The WhatsApp button covers 29% of a card's CTA at 1440 |
| TC-11 | Pass | P011 renders a disabled "Sold out" and offers no link |
| TC-12 | Pass | All 6 sold-out records show Sold Out; no backfilled count reads as low stock |

## What the mixed row measured

At 1440 × 1000, four columns, the row containing all three modes:

| Card | Mode | card.top | price.top | chipRow.top | action.top | card.bottom |
| --- | --- | --- | --- | --- | --- | --- |
| P009 | `add` | 515 | 794 | 838 | 878 | 939 |
| P005 | `choose-on-page` | 515 | 794 | 838 | 878 | 939 |
| P021 | `add` | 515 | 794 | 838 | 878 | 939 |
| P010 | `choose-on-card` | 515 | 794 | 838 | 878 | 939 |

One distinct value in every column. The chip row is 32px on all four including the two with
nothing in it, the action box is 44px on all four, and every button — the one-line "Add to
cart" and the two-line "Choose Your Options" — reports a rendered height of exactly 44. Card
heights: 424 at 1440, 384 at 1024, 445 at 768, 369 at 414, 354 at 375, one value per width.

`fillHeight` does what ADR-067 §4 claims. The two-line label wraps *inside* its reserved box
rather than growing it, with zero overflow, which is the specific thing the jsdom test cannot
see.

## Failures

### TC-09 — the price block is not height-reserved

`PriceDisplay` lays out the MRP, the price and the "N% OFF" chip on one line and lets the chip
wrap when the column is narrow. Measured in the first row of the fixture:

| Width | Price block heights in the row | Aligned? |
| --- | --- | --- |
| 375 | 28, 52 | No |
| 414 | 28, 52 | No |
| 768 | 28 | Yes |
| 1024 | 28, 52 | No |
| 1440 | 28 | Yes |

At 375 the row is P009 (`₹199`, no discount, 28px) beside P005 (`₹299 ₹199` with `33% OFF`
wrapping below, 52px). It is visible in the screenshot as an uneven gap between the price and
the button, not as a stepped row: `mt-auto` inside an equal-height grid cell pushes both
buttons to the same line regardless, so TC-04 and TC-05 still pass with this failing.

**Not a regression from ADR-067.** It tracks `mrp > price` and the column width, not the card's
mode, and `PriceDisplay` is untouched by prompts 112 and 113. Recorded as a known deviation in
the plan. The fix, if wanted, is a reserved height on the price block matching what the name
block and the chip row already do.

### TC-10 — the WhatsApp button covers a card's call to action

At 1440 the fixed "Chat with us" button is 166 × 48 at `left: 1250, top: 1328`, and it
intersects P408's "Choose Your Options" button by **53 × 42 pixels, covering 29% of it**. P408
is the letter ring — the exact product ADR-067 exists to route to its own page, with its CTA
partly obscured.

At 375 the button collapses to a 48 × 48 circle and hits nothing in this fixture. The overlap
is scroll-dependent, since the button is `fixed` and the grid scrolls under it, so which card
it lands on varies; the bottom-right card of the viewport is the one at risk at desktop widths.

**Pre-existing and out of ADR-067's scope** — `WhatsAppButton` has been in the layout since
prompt 4 and nothing in prompts 112 and 113 moved it. It is newly *consequential* because the
bottom of a card is now a button rather than empty space. No fix applied here; it needs a
decision about the button's offset or a `padding-bottom` on the listing, which is a design call
rather than a defect with one obvious remedy.

## Summary

**10 passed, 2 failed, 0 skipped.** The alignment ADR-067 §4 claims is real and holds at all
five widths in all three modes: 58 automated cases green across the four card test files, and
the browser confirms the pixel values the jsdom suite is blind to.

Both failures are pre-existing issues in surfaces ADR-067 did not touch, and neither breaks the
row baseline. **Shippable.** TC-09 and TC-10 should be tracked separately rather than blocking
this work.
