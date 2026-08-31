# Test Result: Home page, product detail, and the tracking redesign — 2026-08-31

- **Plan:** [PLAN-home-product-and-tracking-pass.md](PLAN-home-product-and-tracking-pass.md)
- **Commit:** working tree on `main` at `43217f3`
- **Environment:** the production build served by `next start` on port 3000, local Postgres up.
  Chromium 1234 from the `~/.cache/ms-playwright` cache, driven by the `playwright-core` already
  present in `node_modules`. `package.json` and `package-lock.json` are unmodified.

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | Ten tiles; no `?category=gift-hampers` link among them |
| TC-02 | Pass | `SURFACED_CATEGORIES` still 11, gift hampers still `surfaced` |
| TC-03 | Pass | Cap and exclusion tested over invented categories, not over today's one |
| TC-04 | Pass | 8 of 408 flagged records |
| TC-05 | Pass | "Top notch quality" in, "Anti-Tarnish Quality" out |
| TC-06 | Pass | Same four labels; compact above the grid, full below |
| TC-07 | Pass | All four covers belong to a member of the collection they represent |
| TC-08 | Pass | Non-null for 13 records, null for the other 436 |
| TC-09 | Pass | Empty file, `innerHTML === ""` |
| TC-10 | Pass | `py-7 sm:py-11 lg:py-16` at exactly two sites |
| TC-11 | Pass | Lift leaves exactly `CONTACT_CLEARANCE_GAP` above the obstacle |
| TC-12 | Pass | 424 offsets × 5 card heights, no overlap at any of them |
| TC-13 | **Pass** | 50 of 50 positions clear — table below |
| TC-14 | **Pass** | 5 of 50 would have overlapped without the avoidance — table below |
| TC-15 | Pass | AND across words; three-tier ranking asserted exactly |
| TC-16 | Pass | Identical id sets over the real catalogue |
| TC-17 | Pass | `/shop?q=star`, capped at 64, cleared to `/shop`, page reset |
| TC-18 | Pass | `<meta name="robots" content="noindex, follow">` on `/shop?q=ring` |
| TC-19 | Pass | Transcript below |
| TC-20 | Pass | Cut at a paragraph boundary; all paragraphs stay in the DOM |
| TC-21 | Pass | Identical to `selectProductBadge` for all 449 |
| TC-22 | Pass | Promises COD exactly where `minPrepaidAmount === 0` |
| TC-23 | Pass | Transcript below |
| TC-24 | Pass | Address-edit row dropped, earliest date kept |
| TC-25 | Pass | Two keys; no operator, no reason |
| TC-26 | Pass | Fallback sentence, zero steps |
| TC-27 | Pass | Same-day events differ; `formatTrackingDate` unchanged |
| TC-28 | Pass | Byte-identical class strings across all seven statuses |
| TC-29 | Pass | Items, options and the three amounts render |
| TC-30 | **Pass** | Address, name, phone and email all absent from a page that now shows the contents |
| TC-31 | Pass | One `top` value across all four steps at both widths |

**31 passed, 0 failed, 0 skipped.**

## TC-13 — the measured invariant

`node scripts/measure-floating-contact.mjs`, five viewport widths × two pages × five scroll
offsets. Every one of the fifty positions is clear. The button's `top` moving off its resting
928 is the avoidance working:

| Width | Page | Scroll | Button | Lifted? |
| --- | --- | --- | --- | --- |
| 375 | home | 2344 | 48 × 48 at left 311, top 897 | yes, by 39 |
| 414 | shop fixture | 1308 | 48 × 48 at left 350, top 857 | yes, by 79 |
| 768 | home | 0 | 171 × 48 at left 573, top 842 | yes, by 86 |
| 1024 | shop fixture | 351 | 171 × 48 at left 829, top 850 | yes, by 78 |
| 1440 | shop fixture | 381 | 171 × 48 at left 1245, top 893 | yes, by 35 |

The remaining 45 positions needed no lift and reported no overlap.

```
No call to action is covered at any tested width or scroll position.
```

The fixture URL from the previous prompt — `/shop?category=rings&min=199&max=199&sort=name-desc`
— is the "shop fixture" row above, and the specific overlap TC-10 of that pass recorded is gone:
at 1440 the button now measures 171 × 48 at `left: 1245, top: 928` at rest and lifts to `top:
893` at the one scroll offset where a card action is underneath it.

## TC-14 — the control

The same fifty positions, measuring where the button **would** sit with the avoidance removed
(its resting rectangle, recovered by undoing the applied `translateY`). Without this, the fifty
passes above would prove only that the button happens to miss.

```
OVERLAP 1024px shop fixture  scroll  351   would cover 110x26px (58%) of "Choose Your Options"
OVERLAP 1440px shop fixture  scroll  381   would cover  58x23px (17%) of "Choose Your Options"
OVERLAP  375px home          scroll 2344   would cover  31x27px (14%) of "Add to cart"
OVERLAP  414px shop fixture  scroll 1308   would cover  31x25px (11%) of "Add to cart"
OVERLAP  768px home          scroll    0   would cover 147x26px (11%) of the search input

5 of 50 positions would have covered a call to action without the avoidance.
```

Two things worth recording. The worst case is **1024, not 1440** — 58% of the letter ring's
"Choose Your Options" against the 29% the previous prompt measured at 1440 — which is what the
gutter arithmetic in [ADR-069](../decisions/ADR-069-floating-contact-clearance.md) predicts: the
narrower the viewport, the less room there is beside the content column. And the home page is
affected too, at two widths, which is what the brief suspected and the previous pass had not
measured.

## TC-19 — the search autocomplete, on a real product name

```
"Clover Charm"  ->  2 rows, no "see all" link (2 of 2 shown)
      Clover Charm Gold Anklet   Anklets   ₹220
      Green Clover Sprig Charm   Pendants  ₹250

"ring"          ->  8 rows + "See all 157 results" -> /shop?q=ring
   followed:        http://localhost:3000/shop?q=ring
   H1:              Search “ring”
   subtitle:        157 pieces match those words. Narrow them further with the filters.
   count:           Showing 1–12 of 157 pieces
   chip:            “ring”  (× clears to /shop)
   robots:          noindex, follow

ArrowDown + Enter on "Clover Charm"  ->  /product/P046
```

## TC-23 — the product page

`/product/P408`, the letter ring:

```
See more present:              1
hidden paragraphs before/after: 1 -> 0
control now reads:              See less
price line:                     Inclusive of all taxes · Cash on delivery available on this piece.
badge beside the category:      Rings  New
share control:                  Copy link          (headless Chromium has no navigator.share)
zoom control:                   1
dialog after click:             open
dialog after Escape:            closed
```

## TC-31 — the tracking page, on a real order

Fixture `MANUPASS23`: a `partial_cod` order with **five** `order_status_history` rows — placed,
a second `placed` written by an address correction, packed, shipped, rto — two line items, one
of them carrying a recorded option, ₹300 collected and ₹940 due. Created directly in Postgres,
inspected, and deleted afterwards.

At **375px** and at **1440px**, identically:

```
headline: This parcel has come back to us
steps:    4          (five history rows, collapsed)
    Order placed      20 Aug 2026, 10:00 am
    Packed            20 Aug 2026, 5:10 pm
    On its way        21 Aug 2026, 10:45 am
    Came back to us   26 Aug 2026, 6:50 pm   Where it is now

layout @375:   [{left:37,top:700},{left:189,top:700},{left:341,top:700},{left:493,top:700}]
layout @1440:  [{left:145,top:767},{left:433,top:767},{left:720,top:767},{left:1008,top:767}]
one top value: true

items:    Clover Charm Gold Anklet × 2
          Letter Ring   Letter: M   × 1
payment:  Order total ₹1,240   Paid ₹300   Due on delivery ₹940
```

Four things to note against the plan:

- **The collapse survived the redesign.** Five rows in, four steps out; the address-correction
  row is gone and "Order placed" carries 10:00 am, the time the status was actually reached,
  not the 2:35 pm of the correction.
- **The timestamps are visibly different.** Under the old day-only format the first two steps
  would both have read "20 August 2026".
- **"Came back to us", not "RTO".** The chip carries `border-status-rto/35 bg-status-rto/10
  text-status-rto` — byte-identical to what `OrderStatusBadge` renders in the admin panel — with
  the customer's wording inside it.
- **Genuinely horizontal at both widths**, one `top` value across all four steps, the row
  scrolling sideways at 375 rather than reflowing into a column.

### TC-30 — what the page still refuses to say

Searched the rendered HTML for every private value on the fixture row:

| Value | On the page? |
| --- | --- |
| `9 Nowhere Lane` / `Somewhere` (address lines) | No |
| `Manual Pass` (customer name) | No |
| `9812744599` (phone) | No |
| `manual@example.test` (email) | No |
| `MG_MANUALPASS_1` (Cashfree id) | No |
| `NDR-77 nobody at the gate` (reason) | No |
| `operator` (changedBy) | No |
| `1,180` (subtotal, which is also a line's unit price) | No |

A first pass flagged "Jaipur" and "302020" as hits. They are the **shop's own registered
address** in the footer and the store schema, from `config/business.ts` — the fixture happened to
use the shop's city and PIN. Confirmed by loading `/track` with no order number at all, where
both still appear. Not a leak.

## Gate

```
$ npm run typecheck        tsc --noEmit, clean
$ npm run lint             ✔ No ESLint warnings or errors
$ npm run test:run         Test Files 116 passed (116)
                           Tests 2328 passed (2328)
$ npm run validate:products PASS — all checks green
$ npm run build            ✓ Compiled successfully — 449 product pages prerendered
```

The build failed once on the way here and it is worth recording, because it is a trap that will
catch the next person: `SEARCH_QUERY_PARAM` was first exported from `app/api/search/route.ts`,
and Next.js validates the export list of a route file —
`"SEARCH_QUERY_PARAM" is not a valid Route export field`. `tsc`, `eslint` and `vitest` were all
green at that point. The constant moved to `lib/product-search.ts`, which is where it belonged
anyway: the search box, the route and `ShopSearchParams.q` all name the same parameter and now
all read the same constant.

**Shippable.** Every case in the plan passed, including the two that had to be measured rather
than asserted, and the control run proves the measured ones mean something.
