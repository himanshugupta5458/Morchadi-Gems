# The floating WhatsApp button covers part of a product card's call to action

- **Date:** 2026-08-31
- **Prompt:** 115
- **Severity:** Major
- **Status:** Resolved

## Symptom

Measured in the previous prompt's manual pass and recorded as TC-10 in
[RESULT-2026-08-31-card-variant-selection.md](../testing/RESULT-2026-08-31-card-variant-selection.md).

At 1440 × 1000 on `/shop?category=rings&min=199&max=199&sort=name-desc`, the fixed "Chat with
us" pill measured 166 × 48 at `left: 1250, top: 1328` and intersected P408's "Choose Your
Options" button by **53 × 42 pixels, covering 29% of it**. P408 is the letter ring — the product
[ADR-067](../decisions/ADR-067-card-variant-selection.md) exists to send to its own page so a
shopper can choose a letter instead of having one chosen for them.

It read as a visual annoyance and was very nearly filed as one. It is not: the covered element
is the only control on that card that does anything, and the card is the one the whole
card-variant feature was built to protect.

## Investigation

**Is it the offset?** The obvious reading is that `bottom-4 right-4` puts the button a few pixels
too low. Ruled out immediately by the earlier result's own note: the button is `fixed` and the
grid scrolls under it, so which card it lands on is a function of scroll position. Any offset
that clears P408 at one scroll offset covers the card above it at the next.

**Is there room in the page gutter?** The container is centred at a 1280px maximum with 40px of
padding from `lg`. Free space to the right of the content column:

| Viewport | Content ends at | Free to the right |
| --- | --- | --- |
| 1440 | 1320 | 120px |
| 1024 | 984 | 40px |
| 768 | 744 | 24px |
| 375 | 355 | 20px |

A 48px circle fits the gutter only above roughly 1360px. **Below that, no right-anchored fixed
element can stay out of the content column** — which rules out shrinking the pill, and rules out
moving it, as complete fixes.

**Can space be reserved?** Padding the container by ~80px would work and would narrow the grid at
every width to solve a problem that occupies one horizontal band of it. At 375 that is 80 of 335
content pixels. Rejected.

**Is every overlap equally bad?** No, and this turned out to be the useful distinction. A product
card is a link over its whole area (`after:absolute after:inset-0`), so the button overlapping a
corner of a photograph costs nothing — the card is clickable everywhere else. What costs a sale
is covering the 44-pixel action box. So the invariant worth defending is not "never overlap
anything", which is unachievable, but **"never overlap a control"**, which is.

**How often does it actually happen?** Measured across 50 positions — five viewport widths, two
pages, five scroll offsets each — with the avoidance disabled. Five of the fifty would have
covered a control, including 58% of "Choose Your Options" at 1024 and 17% at 1440. Rare, and
concentrated on exactly the element that matters.

## Root cause

A `fixed` element is in a layer the page scrolls beneath. Its position is defined against the
viewport and the content underneath it is not, so no static offset can express "not on top of a
button". The button had been harmless for as long as the bottom of a product card was empty
space; [ADR-067](../decisions/ADR-067-card-variant-selection.md) put a call to action there, and
the pre-existing layer became consequential without changing.

## Fix

[ADR-069](../decisions/ADR-069-floating-contact-clearance.md).

- `lib/floating-contact.ts` — new. `boxesOverlap`, `liftClearingObstacles`, and the obstacle
  selector. Plain numbers in, a pixel offset out.
- `components/WhatsAppButton.tsx` — now a Client Component. Fades out while the page is scrolling;
  on settle, measures itself against everything matching the selector and translates up far
  enough to clear it, bounded at 320px.
- `components/ButtonLink.tsx` — stamps `data-control="action"` on the anchors it renders, so a
  link styled as a button is treated as one.
- `scripts/measure-floating-contact.mjs` — new. The browser measurement, runnable as a check.

## Verification

`npm run dev`-equivalent production server, `playwright-core` with the cached Chromium, five
widths × two pages × five scroll positions = 50 measurements:

```
$ node scripts/measure-floating-contact.mjs
PASS  375px   home          scroll     0  48x48 at left 311, top 936
...
PASS  1440px  shop fixture  scroll   381  171x48 at left 1245, top 893
...
No call to action is covered at any tested width or scroll position.
```

The control run — the same 50 positions, measuring where the button *would* sit with the
avoidance removed — proves the pass is not an accident:

```
OVERLAP 1024px shop fixture  scroll  351   would cover 110x26px (58%) of "Choose Your Options"
OVERLAP 1440px shop fixture  scroll  381   would cover  58x23px (17%) of "Choose Your Options"
OVERLAP  375px home          scroll 2344   would cover  31x27px (14%) of "Add to cart"
OVERLAP  414px shop fixture  scroll 1308   would cover  31x25px (11%) of "Add to cart"
OVERLAP  768px home          scroll    0   would cover 147x26px (11%) of the search input

5 of 50 positions would have covered a call to action without the avoidance.
```

`lib/floating-contact.test.ts` adds 13 cases, including one that walks a six-row grid past the
button one pixel at a time across a whole card height and asserts a clear position exists at
every offset.

## Prevention

The invariant is now a test rather than an observation, at two levels: the arithmetic in
`lib/floating-contact.test.ts`, and the real rectangles in `scripts/measure-floating-contact.mjs`,
which exits non-zero on any overlap and can be run against a branch.

The obstacle set names element kinds rather than components, so a control added anywhere on the
storefront is avoided without anybody being told. The one thing a future author must remember is
that a hand-rolled anchor styled as a button needs `data-control="action"`; `ButtonLink` supplies
it, which covers every current case.
