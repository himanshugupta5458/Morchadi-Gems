# Test Plan: The universal add-to-cart modal, and what it let the card stop reserving

- **Scope:** [ADR-073](../decisions/ADR-073-universal-add-to-cart-modal.md) — the one
  add-to-cart modal, the property that nothing inside it is ever pre-selected, the simplified
  product card and the real heights of a mixed grid row, the compact cross-sell rail, and the
  de-duplicated address, payment and confirmation screens.
  **Not covered:** `validateOrderLineOptions` and the cart line editor, which
  [ADR-067](../decisions/ADR-067-card-variant-selection.md) §3 owns and which this work did not
  touch; the badge cascade, which ADR-067 §5 owns; the sort and price facets of
  [ADR-068](../decisions/ADR-068-shop-sort-status-and-price-facets.md).
- **Prerequisites:** for the manual cases, a local `next dev` on port 3000. For the measurement
  case, a production build served by `next start`, plus a headless Chromium — see below. No
  database, no Cashfree credentials and no environment variables are needed for anything in this
  plan except the checkout walk-through, which needs neither either: `/address` and `/payment`
  render from `localStorage` and `sessionStorage` alone up to the point the pay button is
  pressed.

## Why this plan exists

Two things in ADR-073 cannot be asserted under vitest and are the whole reason for a manual
plan.

**jsdom applies no stylesheet.** `lib/product-card-alignment.test.tsx` can assert that every card
renders the same four boxes in the same order and that the name carries `truncate`. It cannot
assert that `h-4` and `h-10` resolve to 16 and 40 real pixels, that `truncate` actually clips
rather than wrapping, or that two cards in the same grid row end up the same height. That needs a
browser, and `scripts/measure-card-heights.mjs` is the browser.

**A modal is a thing you look at.** The automated suite proves that nothing is checked and that
the confirm button is disabled; it cannot say whether the dialog is legible at 360px, whether the
chips wrap sensibly for a value like `February Purple`, or whether dismissing it feels like
dismissing it.

`lib/product-card-alignment.test.tsx` and `lib/product-card-title.test.tsx` both cite this file.
If it moves, those citations move with it.

## The measurement, and how to reproduce it

`scripts/measure-card-heights.mjs` loads a built page in a headless Chromium, groups cards into
rows by their top offset, and reports the spread of real `getBoundingClientRect().height` within
each row — at 390px, 768px and 1440px, on `/shop` and `/`. With `--counterfactual` it then
removes the *empty* options-tag slots from every card and measures again, which is what turns
"the reserved slot is still needed" into a number.

`playwright-core` is deliberately not a dependency in `package.json`: this script is run by hand
when the card's box model changes, and listing it would put a browser download into `npm ci`,
which is what the Docker build runs for an image that never opens one.

```
npm run build
npm start &
npm i --no-save playwright-core && npx playwright install chromium
node scripts/measure-card-heights.mjs --counterfactual
```

### What it must show

**This table was written before the measurement was taken, and the measurement corrected it.**
The prediction was that removing the slot would misalign a *mixed* row — some cards tagged with
options, some not — and that the resulting within-row spread would be the number that justified
the slot. It is not: within-row alignment is `ProductGrid`'s stretch plus the action's
`mt-auto`, and it holds at 0px whether the slot is there or not. What the slot actually buys is
**row-to-row** rhythm. The corrected assertions:

| Assertion | Threshold |
| --- | --- |
| Every row, at every viewport, on both `/shop` and `/`, has a within-row spread of **0px** | exact |
| At least one row is *mixed* — some cards tagged with options, some not | ≥ 1 |
| With the empty slot removed, the within-row spread is **still 0px** — the slot is not what levels a row | exact |
| With the empty slot removed, an **untagged** row drops by **24px** while a tagged row does not, so rows of different composition disagree about their height | exact |

The fourth row is the point, and it is not the point the first draft of this table expected.
24px is the 16px line box plus the 8px `gap-2` that comes with it; across a two-abreast phone
grid it is a visible step, and because which products land in which row changes with the sort
order and the page, the listing's vertical rhythm would depend on the query. That is what the
slot buys, and it is why removing it on within-row evidence would be the wrong reading.

The measured numbers are in
[`RESULT-2026-09-01-universal-add-to-cart-modal.md`](RESULT-2026-09-01-universal-add-to-cart-modal.md),
and ADR-073 §5 records the contradiction in its own words.

## Cases

### 1. The modal pre-selects nothing, for every option count

Three products, one from each of ADR-067's original categories. The catalogue's own ids, so
re-derive them if the catalogue moves.

| Fixture | Why | Expected |
| --- | --- | --- |
| Any option-less piece on `/shop` | ADR-067's `add` | Tap Add to cart → it goes straight in, the button reads **Added ✓** for about a second and a half, and a toast confirms bottom-centre. No dialog. |
| A three-value bangle (`Size for bangles`) | ADR-067's `choose-on-card`, the one that **used to pre-select 2.4** | Tap Add to cart → a dialog opens. **No chip is filled.** The confirm button is greyed. Helper text reads "Choose a Size for bangles to continue". |
| P408, the letter ring | ADR-067's `choose-on-page` | Tap Add to cart → a dialog opens with a **dropdown reading "Choose…"**, not `A`. Confirm greyed. |
| A multi-group piece (design + size) | ADR-067's `choose-on-page` by group count | Two labelled sections. Answering the first leaves the button greyed and the helper text moves to the second group. Answering both enables it. |

The letter-ring row is the one worth being deliberate about: a native `<select>` handed an empty
value displays its first option, so "it shows A" and "it has A selected" look identical on
screen. Open the dialog and read the control before touching it.

### 2. Dismissing adds nothing, and forgets

1. Open the modal on the bangle. Tap `2.8`.
2. Dismiss by clicking the overlay. Check the cart badge: unchanged.
3. Dismiss by the close icon. Same.
4. Dismiss with Escape. Same.
5. Reopen. **No chip is filled** — the half-made choice is gone, not resumed.

### 3. A card shows the shape of the question and none of its answers

On `/shop`, a card with options carries a muted tag under the price: `3 sizes`, `25 options`,
`2 options`. It carries no chips, no swatches, no dropdown, and no "Choose Your Options" button.
Every card in the row is the same height whether or not it has a tag — case 4 is the measurement
of that.

### 4. Titles truncated to one line stay distinguishable

`lib/product-card-title.test.tsx` asserts a ceiling on how many names collide once cut, and
prints the offenders when it trips. The manual half is to look at the collisions it tolerates and
confirm the photographs tell them apart. The known clusters are colourways and near-variants of
one design — "Emerald Green Glass Bangle Set" beside "Emerald Green Glass Bangles with Golden
Bead Accents" — which are different photographs of visibly different pieces.

### 5. Search from the header, on a page that is not the home page

1. Go to `/shop?category=rings`. The header carries a search box: in the right cluster beside
   Track Order from `lg` up, in a slim band under the logo row below it.
2. Type "star". Suggestions appear **under the box**, not clipped by the header's bottom border
   and not pinned to the top of the viewport.
3. Arrow down and press Enter → the product page opens.
4. Press Enter with nothing highlighted → `/shop?q=star`.
5. Go to `/address` with something in the cart. **There is no search box**, and there is not
   meant to be: the checkout shell strips navigation to keep a committed shopper in the funnel.

### 6. The checkout flow says each thing once

Walk cart → address → payment → confirmation with a real basket and a real address, and check
that none of the following appears twice:

| Fact | Where it is allowed to appear |
| --- | --- |
| Secure checkout / who processes the payment | The address step's summary column, and once under the pay button |
| The returns window and the delivery coverage | The address step's summary column only |
| The delivery address | In full on the address form; as **one line with an Edit link** on payment; in full again on the confirmation receipt |
| Dispatch and delivery timing | The address step's one-line intro; the payment step; **inside the Due on Delivery panel** on confirmation |
| The cash amount due | **The Due on Delivery panel only** |
| Where to write to us | The one consolidated line near the bottom of the confirmation screen |
| "Keep your order number" | Once, directly under the number |

The confirmation screen's two panels must not look alike: **Due on Delivery** is gold-tinted with
a gold rule down its left edge and a wallet above the label; **Your order number** is a hairline
on white.

### 7. The cross-sell rail, on both screens it appears on

On `/cart` and again on `/order-confirmation`:

1. Two compact horizontal cards, 68px thumbnails cropped on the piece.
2. A plain price — no strikethrough and no "% off" chip.
3. One 26px `+` per card, and nothing else.
4. "See 2 more from this collection" reveals the other two and then disappears.
5. `+` on a piece with options opens **the same modal** as the shop card, with nothing selected.

## Regression risks worth re-running after any card edit

- A new element on the card whose presence depends on the product will break the row unless it
  reserves its slot. Re-run the measurement, not just the vitest suite.
- `AddToCartModal` portals to `document.body`. A page that renders a card without
  `CartProvider` and `ToastProvider` above it will throw on the first tap rather than at render.
- The header now mounts two `ProductSearch` instances, one hidden at each breakpoint. A change
  that gives them a shared id or a shared piece of state will show up as one box driving the
  other's dropdown.
