# Test Plan: Card variant selection and mixed-row alignment

- **Scope:** the three card purchase modes of
  [ADR-067](../decisions/ADR-067-card-variant-selection.md) — `add`, `choose-on-card`,
  `choose-on-page` — and the vertical alignment of a grid row that holds all three at once.
  Covers the badge cascade and cart line option editing only where they are visible on a card.
  **Not covered:** the product page's own option selector, checkout, and the shop facets of
  [ADR-068](../decisions/ADR-068-shop-sort-status-and-price-facets.md), which have their own
  automated coverage in `lib/shop.test.ts`.
- **Prerequisites:** a local `next dev` on port 3000. No database, no Cashfree credentials and
  no environment variables are needed — `/shop` reads `data/products.json` only.

## Why this plan exists

`lib/product-card-alignment.test.tsx` runs under jsdom, which applies **no stylesheet**. It can
assert that every mode renders the same two fixed-height boxes in the same order, and that is
the structural half worth automating. It cannot assert that `h-8` and `h-11` resolve to 32 and
44 real pixels, that `fillHeight` actually fills, or that a two-line button label fits the box
reserved for it. Those need a browser, and the cases below are the ones a browser has to answer.

The automated test's header points here. If this file moves, that citation moves with it.

## Constructing a row with all three modes

The three modes are unevenly distributed — 390 `add`, 43 `choose-on-card`, 16
`choose-on-page` — so no row of the unfiltered shop contains all three. This URL forces one,
and is the fixture the manual cases below use:

```
/shop?category=rings&min=199&max=199&sort=name-desc
```

Ten ₹199 rings, reverse-alphabetical. At a desktop width the first row is **P009** (`add`),
**P005** (`choose-on-page`), **P021** (`add`), **P010** (`choose-on-card`); the second row
carries **P011**, which is sold out, and **P408**, the letter ring that was the defect ADR-067
was named for. The filter is deliberately narrow: a catalogue edit that changes a ring's price
away from ₹199 will change the row, so re-derive it rather than assuming these ids.

## Cases

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | Mode selection over the real catalogue | `selectCardPurchaseMode` across all 449 records | 390 `add`, 43 `choose-on-card`, 16 `choose-on-page`; no card is asked to render more than `CARD_OPTION_VALUE_LIMIT` chips | Automated |
| TC-02 | Every letter ring routes to its page | P001, P005, P408 | `choose-on-page`; the card adds nothing | Automated |
| TC-03 | Box structure is identical in every mode | Render all four modes | Two boxes, `h-8` then `h-11`, same order, `h-full` on the action | Automated |
| TC-04 | **Action baseline across a mixed row** | Load the fixture URL, measure `getBoundingClientRect().top` of each card's `.h-11` | One distinct value across all four cards | **Manual** |
| TC-05 | **Card height across a mixed row** | Same row, measure each `<article>` height | One distinct value | **Manual** |
| TC-06 | **The long label fits its reserved box** | Measure the `choose-on-page` button's `scrollHeight - clientHeight` | `0` at every width — the two-line label wraps inside the 44px box rather than overflowing or clipping | **Manual** |
| TC-07 | **Chip row is reserved when empty** | Compare an `add` card's `.h-8` against a `choose-on-card` card's in the same row | Both 32px; the empty one occupies space | **Manual** |
| TC-08 | **Widths** | Repeat TC-04 to TC-07 at 375, 414, 768, 1024 and 1440 | Alignment holds at every width, including the two-abreast phone width the three-value ceiling exists to protect | **Manual** |
| TC-09 | **Price block across a mixed row** | Measure each card's price block height in one row | See the known deviation below — this case currently **fails by design of `PriceDisplay`, not of ADR-067** | **Manual** |
| TC-10 | **Nothing overlaps a card's call to action** | At each width, intersect the fixed WhatsApp button's rect with every card CTA | No intersection | **Manual** |
| TC-11 | Sold out outranks the mode | P011 in the fixture row | Button reads "Sold out" and is disabled; no "Choose Your Options" link is offered | Automated |
| TC-12 | Badge cascade on real records | All 449 | Every sold-out record shows Sold Out and nothing else; no backfilled count produces false low-stock urgency | Automated |

## Running the manual cases

There is no browser in the default container and Playwright is **not** a dependency of this
project. Add it for the run and remove it afterwards, so the committed dependency surface does
not grow for a check that runs a few times a year:

```bash
npm run dev &
npm i -D playwright-core          # a chromium binary is already cached under ~/.cache/ms-playwright
# drive it against the fixture URL, then:
git checkout package.json package-lock.json
```

Measure with `getBoundingClientRect()` on each card's `<article>`, its price block, its `.h-8`
and its `.h-11`, group cards into rows by their shared `top`, and assert one distinct value per
box per row. A screenshot alone is not sufficient evidence for TC-04 or TC-05 — a four-pixel
drift is invisible by eye and obvious in the numbers — but take one anyway, because TC-09 and
TC-10 were both found by looking at the picture and neither was visible in the box measurements.

## Known deviation — the price block is not height-reserved

TC-09 fails and the failure is **outside ADR-067's scope**, recorded here so it is not
rediscovered as a regression. `PriceDisplay` puts the MRP, the price and the "N% OFF" chip on
one line, and the chip wraps to a second line when the column is narrow. The block is then 52px
instead of 28px, so in a row where one product is discounted and another is not, the two price
blocks differ in height.

The row still holds its baseline: the action is pushed down by `mt-auto` inside a grid whose
cards stretch to equal height, so the **button** and the **card bottom** stay aligned and the
slack is absorbed as a taller gap above the button. What a shopper sees is an inconsistent gap,
not a stepped row of buttons.

It correlates with `mrp > price`, not with the card's mode, and it predates ADR-067. Fixing it
means reserving a height on the price block the way the name block and the chip row already do.

## Known discrepancy — ADR headers

[ADR-067](../decisions/ADR-067-card-variant-selection.md) and
[ADR-068](../decisions/ADR-068-shop-sort-status-and-price-facets.md) are both headed
`Prompt: 111`. They landed as prompts **112** and **113** in
[BUILD_LOG.md](../progress/BUILD_LOG.md); prompt 111 is
[ADR-066](../decisions/ADR-066-single-source-site-identity.md). The headers are left as
written because an accepted ADR is immutable, and this note is the correction.
