# Test Result: Two-tier catalogue IA — 2026-08-18

- **Plan:** [PLAN-catalogue-ia.md](PLAN-catalogue-ia.md)
- **Commit:** `e5c1f9d` plus this prompt's working tree
- **Environment:** local — Vitest 4.1.10 on Node. No network, no Cashfree credentials, no
  live gateway call.

## Suites

| Suite | Tests | Covers |
| --- | --- | --- |
| `lib/catalogue-ia.test.ts` | 14 (new) | The ten-category tier, the five-collection tier and its two guards, the two nav menus, the category image paths |
| `lib/shop.test.ts` | 71 (was 55) | The 16 new cases are the collection facet: tags, derived sources, combinations, degradation |

## Results

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 – TC-04 | Pass | The category tier. TC-04 is the one that matters this prompt: the existing 100 products still validate against the widened union with no data change |
| TC-05 – TC-08 | Pass | The collection tier. TC-06 pins the `source.kind` of all five in order, so a collection cannot quietly change how it is populated |
| TC-09 – TC-13 | Pass | Tag membership, driven through fixtures. TC-10 also asserts `collections` is genuinely `undefined` on the fixture — the absent case, not an empty array |
| TC-14 – TC-15 | Pass | Both assert the fixture carries **no** `collections` field while still matching, which is the property that makes the derived collections non-duplicating |
| TC-16 | Pass | ₹999 is inside `under-999`, matching the price band rather than the literal `price < 999` |
| TC-17 – TC-18 | Pass | Cross-facet AND |
| TC-19 – TC-21 | Pass | Degradation. TC-19 is the important negative: an unknown slug widens the result set to everything rather than narrowing it to nothing |
| TC-22 – TC-23 | Pass | Against the real catalogue: 8 best-sellers, 8 new-arrivals, 42 under ₹999 |
| TC-24 – TC-26 | Pass | Query mutators and the parser over every constant |
| TC-27 – TC-31 | Pass | The nav. TC-30 is what enforces the ADR-020 decision that a collection link is `?collection=`, never `?sort=` |
| TC-32 | Pass | Zero products tagged — the tier is live and unused, exactly as intended before the import |
| TC-33 | Pass | `/shop?category=earrings,rings&collection=gifting&price=under-999&sort=price-asc&page=3` |
| TC-34 | Pass | **All 433 tests written before this prompt pass.** Two assertions in `lib/shop.test.ts` were edited: both construct a `ShopQuery` object literal by hand and now have to include `collections`. No behavioural test was changed |
| TC-35 | Pass | Manual. See below |

## Full gate

| Step | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm run test:run` | **465 passing across 16 files** (was 433 across 15) |
| `node scripts/validate-products.mjs` | `PASS — all checks green` |
| `npm run build` | Compiled successfully, 117/117 static pages from a cleared `.next` |

## Manual check (TC-35)

- **Desktop nav:** two dropdowns — "Shop by Category" opening ten entries, "Collections"
  opening five — then About and Contact as top-level links. One panel open at a time;
  hover, click and `ArrowDown` all open; `Escape` closes and returns focus to the trigger.
- **Mobile drawer:** both groups render as accordions, one expanded at a time, with About
  and Contact as flat rows beneath. Focus trap, scroll lock and Escape behave as before.
- **Home:** ten category tiles, 5×2 at `lg`, 3-up at `sm`, 2-up on mobile; the collection
  strip sits beneath them. The two new tiles render their generated placeholders.
- **Shop:** the sidebar shows Category / Collection / Price; checking a collection pushes
  `?collection=…`, the chip appears with its label, and "Clear all" removes it.

## Notes

The collection tests run on fixtures rather than catalogue data by design. No shipped
product carries a tag yet — the import is the next prompt — so asserting against
`data/products.json` would have meant asserting that `gifting` returns nothing, which is a
test of today's data rather than of the filter. `matchesShopQuery` and
`isProductInCollection` were exported from `lib/shop.ts` to make that possible; both are
pure, and `getShopResults` now calls the former rather than duplicating the predicate.

`scripts/validate-products.mjs` was relaxed in the same change: the exact 100-product,
8-featured, 8-new and 2–3-placeholder-out-of-stock assertions became floors, and an empty
category is reported rather than failed. Those numbers described the invented catalogue
being replaced next prompt, and `watches` and `hair-accessories` are legitimately empty
until then. Every structural and per-product check is unchanged, and the exact counts are
still printed in the report.
