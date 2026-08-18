# Test Result: Shop results logic — 2026-08-17

- **Plan:** [PLAN-shop-logic.md](PLAN-shop-logic.md)
- **Commit:** working tree, prompt 7 (repository has a single commit, `d2f4f96`)
- **Environment:** local, Node 24, Vitest 4.1.10, `npm run test:run`; manual checks against a
  production build (`npm run build && npm run start`)

## Summary

**53 automated tests passed, 0 failed, 0 skipped.** All 48 planned cases are covered — some
tests cover more than one case, and several are loops over every band, every sort, or all 20
pagination positions. Six manual checks passed. This is shippable.

```
 RUN  v4.1.10 /workspaces/Morchadi-Gems

 Test Files  1 passed (1)
      Tests  53 passed (53)
   Duration  421ms (transform 156ms, import 195ms, tests 49ms)
```

## Automated cases

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | 100 products, 9 pages, sort `newest` |
| TC-02 | Pass | 1–12 and 13–24 |
| TC-03 | Pass | Last page holds 4 |
| TC-04 | Pass | 100 items, 100 distinct ids across all 9 pages |
| TC-05 | Pass | Asserted directly on `isPriceInBand` at 999/1000/4999/5000 |
| TC-06 | Pass | `MAX_SAFE_INTEGER` in `5000-plus` |
| TC-07 | Pass | Loops all three bands, every page, every product |
| TC-08 | Pass | 27 + 43 + 30 = 100 |
| TC-09 | Pass | `under-999,5000-plus` = 27 + 30 |
| TC-10 | Pass | Compared against a sorted copy |
| TC-11 | Pass | Compared against a sorted copy |
| TC-12 | Pass | Compared against a sorted copy |
| TC-13 | Pass | All 8 `isNew` first, none after |
| TC-14 | Pass | Tie group located dynamically rather than assuming one exists |
| TC-15 | Pass | Walks every adjacent pair with equal ratings |
| TC-16 | Pass | Loops all four `SORT_OPTIONS` |
| TC-17 | Pass | `necklaces` + `5000-plus` |
| TC-18 | Pass | `necklaces,earrings` = 13 + 13 |
| TC-19 | Pass | Array form equals comma form |
| TC-20 | Pass | `anklets` + `5000-plus` — a genuinely empty combination in this catalogue |
| TC-21 | Pass | Category chip before price chip |
| TC-22 | Pass | `?category=tiaras` returns 100 |
| TC-23 | Pass | `tiaras,rings` keeps `rings` |
| TC-24 | Pass | `?price=free` returns 100 |
| TC-25 | Pass | `?sort=cheapest` matches the no-params page |
| TC-26 | Pass | `" Necklaces , EARRINGS "` |
| TC-27 | Pass | Empty strings in all three slots |
| TC-28 | Pass | Four sub-cases, table-driven |
| TC-29 | Pass | `2.7` floors to 2 |
| TC-30 | Pass | `9999` clamps to 9 |
| TC-31 | Pass | Clamps to 1 on an empty set |
| TC-32 | Pass | `query.page` reflects the clamp |
| TC-33 | Pass | Catalogue order unchanged after two sorted calls |
| TC-34 | Pass | Deep equality on repeated calls |
| TC-35 | Pass | `rings,earrings` normalises to `earrings,rings` |
| TC-36 | Pass | `rings,rings` de-duplicates |
| TC-37 | Pass | Bare `/shop` |
| TC-38 | Pass | `/shop?category=earrings,rings&price=under-999&sort=price-asc&page=3` |
| TC-39 | Pass | Round-trip through `URLSearchParams` |
| TC-40 | Pass | Three mutators, all reset to page 1 |
| TC-41 | Pass | `withPage` preserves categories and sort |
| TC-42 | Pass | Toggling `rings` off empties the facet |
| TC-43 | Pass | Price toggle leaves category and sort intact |
| TC-44 | Pass | 5 pages and 7 pages, no ellipsis |
| TC-45 | Pass | `[1,2,…,20]`, `[1,…,9,10,11,…,20]`, `[1,…,19,20]` |
| TC-46 | Pass | Loops all 20 positions |
| TC-47 | Pass | Loops all 20 positions |
| TC-48 | Pass | `[1]` |

## Manual checks

| ID | Result | Notes |
| --- | --- | --- |
| MC-01 | Pass | 43 links (8 category tiles + 32 mega-nav quick filters + 2 home sort links + `/shop`) all returned 200 |
| MC-02 | Pass | With `?category=rings&price=5000-plus`, the Rings chip links to `/shop?price=5000-plus` and the price chip to `/shop?category=rings` |
| MC-03 | Pass | Page 1 emits no "Previous", page 9 emits no "Next"; page 5 renders `1 … 4 [5] 6 … 9` with `aria-current="page"` on 5 |
| MC-04 | Pass | `?sort=price-desc` renders `<option value="price-desc" selected>` |
| MC-05 | Pass | `/shop` → "Shop All Jewellery · Morchadi Gems"; `?category=necklaces` → "Necklaces · Morchadi Gems"; full 10-tag OG block; `?page=9999` canonicalises to `?page=9` |
| MC-06 | Pass | No client chunk contains catalogue strings; `/shop` costs 1 kB more first-load JS than `/` |

## Failures

None.

Two defects were found and fixed *during* the run rather than after it, so neither reached a
recorded case:

1. **A tie-detection test asserted against the wrong product.** The first version located
   price ties by taking the cheapest product's price, and the cheapest item (₹299) happens to
   be unique — so the assertion failed on a correct implementation. The test now searches for
   a genuinely tied price instead of assuming the first one is tied. This was a bad test, not
   a bad implementation, but it is exactly the kind of test that would have been deleted
   rather than fixed under time pressure.
2. **The generic shop meta description double-mentioned the brand** — "Browse the full
   Morchadi Gems collection — Hallmarked, hand-finished jewellery from Morchadi Gems — …",
   caused by concatenating a page-specific prefix onto `SITE_CONFIG.description`. Rewritten
   to compose a single sentence from the brand name and the subject. Caught by reading the
   served `<meta>` tag, not by a test — there is no automated coverage of copy quality.

## Coverage gaps

Stated plainly so they are not mistaken for covered ground:

- **No rendering tests.** `app/shop/page.tsx` and the three Client Components have no
  automated coverage. Their behaviour was verified by asserting on served HTML (MC-01 to
  MC-06), which does not exercise `onChange`, `router.push`, focus trapping, or Escape
  handling in the mobile drawer. Adding a DOM environment and Testing Library is the natural
  next step if these grow.
- **No browser.** This environment has none, so nothing visual was verified — layout,
  hover states, and the drawer animation are unchecked.
- **Facet counts are not implemented**, so nothing tests them (see ADR-008).
