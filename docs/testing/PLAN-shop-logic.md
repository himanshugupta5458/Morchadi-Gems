# Test Plan: Shop results logic

- **Scope:** `getShopResults` and the query vocabulary in `lib/shop-query.ts` — parsing,
  filtering, sorting, pagination, URL building, and the pagination range. Covers the pure
  logic only. **Not** covered: rendering of `app/shop/page.tsx`, the Client Component
  controls (`ShopFilterPanel`, `ShopFilterDrawer`, `ShopSortSelect`), or browser behaviour
  such as focus management in the mobile drawer — those are verified by hand and by
  asserting on served HTML.
- **Prerequisites:** none. The suite reads the committed `data/products.json` through
  `lib/products.ts`; there is no network, no env var, and no fixture to seed.
- **Runner:** Vitest — `npm run test:run` (single pass) or `npm test` (watch).

Rationale for the design under test is in
[ADR-008](../decisions/ADR-008-shop-architecture.md). This plan is about `lib/shop.ts`;
`scripts/validate-products.mjs` remains the separate check on the *data*, and both must be
green.

## What `getShopResults` must guarantee

1. **Total ordering.** Every sort ends on `id`, so results are deterministic. Paging through
   the whole catalogue must yield every product exactly once — no drops, no repeats.
2. **Graceful degradation.** No input reaches an exception. Unknown categories, unknown price
   bands, unknown sorts, and unparseable pages are ignored, not fatal.
3. **Clamped pagination.** `page` always lands in `[1, totalPages]`. `totalPages` is at least
   1, even when nothing matched.
4. **Facet semantics.** Selections OR within a facet; the two facets AND together.
5. **Purity.** The catalogue is never mutated and identical params give identical results.
6. **Band coverage.** The three price bands partition the catalogue — disjoint and
   exhaustive, so no product is unreachable through the filter UI.

## Cases

| ID | Scenario | Expected result | Type |
| --- | --- | --- | --- |
| TC-01 | No params | Page 1, 12 items, total 100, totalPages 9, sort `newest`, no applied filters | Automated |
| TC-02 | Display range, page 1 and page 2 | `rangeStart`/`rangeEnd` are 1–12 and 13–24 | Automated |
| TC-03 | Last page | Holds only the remainder (4), `rangeEnd` equals the total | Automated |
| TC-04 | Page through the whole catalogue | 100 items, 100 distinct ids — nothing dropped or repeated | Automated |
| TC-05 | Price band bounds | Inclusive both ends: 999 in `under-999`, 1000 not; 1000 and 4999 in mid, 999 and 5000 not; 5000 in `5000-plus`, 4999 not | Automated |
| TC-06 | Premium band upper bound | `MAX_SAFE_INTEGER` is in `5000-plus` — unbounded above | Automated |
| TC-07 | Each band's results | Every returned product satisfies its band predicate | Automated |
| TC-08 | Bands partition the catalogue | The three band totals sum to 100 | Automated |
| TC-09 | Two bands selected | Total equals the sum of the two individually (OR) | Automated |
| TC-10 | `sort=price-asc` | Prices non-decreasing across every page | Automated |
| TC-11 | `sort=price-desc` | Prices non-increasing across every page | Automated |
| TC-12 | `sort=rating-desc` | Ratings non-increasing across every page | Automated |
| TC-13 | `sort=newest` | All `isNew` products come first; none appear after the block | Automated |
| TC-14 | Price ties | Tied products are ordered by `id` | Automated |
| TC-15 | Rating ties | Ordered by `reviewCount` desc, then `id` | Automated |
| TC-16 | Sort is a permutation | Every sort returns the same id set, only reordered | Automated |
| TC-17 | Category AND price | Every result matches both facets | Automated |
| TC-18 | Two categories | Total equals the sum of the two individually (OR) | Automated |
| TC-19 | Repeated params vs comma form | `?category=a&category=b` equals `?category=a,b` | Automated |
| TC-20 | Empty result (`anklets` + `5000-plus`) | total 0, items `[]`, totalPages 1, page 1, range 0–0 — no crash | Automated |
| TC-21 | Applied filters | Reported with display labels, category before price | Automated |
| TC-22 | Unknown category | Ignored — full catalogue, no applied filters | Automated |
| TC-23 | Mixed valid/invalid category list | Valid half kept, invalid dropped | Automated |
| TC-24 | Unknown price band | Ignored — full catalogue | Automated |
| TC-25 | Unknown sort | Falls back to the default, same items as no-params | Automated |
| TC-26 | Case and whitespace (`" Necklaces , EARRINGS "`) | Parsed to `["necklaces","earrings"]` | Automated |
| TC-27 | Empty-string params | Ignored — full catalogue | Automated |
| TC-28 | `page=0` / `page=-1` / `page=abc` / `page=""` | All clamp to page 1 | Automated |
| TC-29 | `page=2.7` | Floors to page 2 | Automated |
| TC-30 | `page=9999` | Clamps to the last page | Automated |
| TC-31 | Out-of-range page on an empty result | Clamps to page 1, items `[]` | Automated |
| TC-32 | Clamped page echoed on `query` | `query.page` reflects the clamp, so links build correctly | Automated |
| TC-33 | Catalogue not mutated | `getAllProducts()` order unchanged after several sorts | Automated |
| TC-34 | Determinism | Identical params give a deeply equal result | Automated |
| TC-35 | Selection order normalised | Ordered by the constant tables, not URL order | Automated |
| TC-36 | Duplicate values | De-duplicated | Automated |
| TC-37 | `buildShopHref` defaults | Empty query builds bare `/shop` | Automated |
| TC-38 | `buildShopHref` canonical order | `category`, `price`, `sort`, `page` in that order | Automated |
| TC-39 | Href round-trip | `parse(build(query))` equals `query` | Automated |
| TC-40 | Mutators reset pagination | Toggling a category, a band, or the sort resets to page 1 | Automated |
| TC-41 | `withPage` preserves filters | Only the page changes | Automated |
| TC-42 | Toggling an active filter | Removes it | Automated |
| TC-43 | Toggling one facet | Leaves the other facet and the sort intact | Automated |
| TC-44 | `buildPaginationRange` — few pages | Every page listed, no ellipsis | Automated |
| TC-45 | `buildPaginationRange` — many pages | First, last, and the window around current, with ellipses | Automated |
| TC-46 | Current page always present | For every page of 20 | Automated |
| TC-47 | No adjacent ellipses, no duplicate page | For every page of 20 | Automated |
| TC-48 | Single page | Returns `[1]` | Automated |

## Adversarial cases deliberately included

These are the ones that matter, because each corresponds to a URL a real visitor can
produce by editing the address bar, following a stale bookmark, or having a link mangled in
transit:

- **Nonsense in every slot at once** — `?category=tiaras&sort=bogus&page=abc` must render
  the default catalogue view rather than an error page (TC-22, TC-25, TC-28).
- **A page number past the end** after the catalogue shrinks (TC-30, TC-31).
- **Duplicated and reordered facet values**, which a double-click or a hand-edited URL
  produces (TC-35, TC-36).
- **Tie-heavy sorts**, the case where a non-total ordering silently corrupts pagination
  (TC-14, TC-15, TC-04).

## Manual checks

Not automated; run against a production build with `npm run start`.

| ID | Scenario | Expected result |
| --- | --- | --- |
| MC-01 | All 43 inbound `/shop` links from the chrome and home | All return 200 |
| MC-02 | Chip removal | Each chip drops only its own param, preserving the rest |
| MC-03 | Pagination controls | Prev omitted on page 1, Next omitted on the last page |
| MC-04 | Sort select | Reflects the URL on load |
| MC-05 | Metadata | Category-aware title, full OG block, canonical follows the clamped page |
| MC-06 | Client bundle | No catalogue data in any client chunk |
