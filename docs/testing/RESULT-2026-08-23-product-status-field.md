# Test Result: Product publication status — 2026-08-23

- **Prompt:** 66
- **Decision under test:** [ADR-052](../decisions/ADR-052-product-status-field.md)
- **Suite:** `lib/product-status.test.ts` (28 cases, all automated)
- **Plan:** none written in advance; this suite was specified by the prompt and is recorded here
  as executed.

## What was run

The whole gate, as five separate commands and then chained:

| Step | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 — no ESLint warnings or errors |
| `npm run test:run` | exit 0 — 80 files, 1367 passed, 103 skipped (1470) |
| `npm run validate:products` | exit 0 — PASS, 49 active / 0 draft, 3 pre-existing advisories unchanged |
| `npm run build` | exit 0 — 49 product pages prerendered |
| chained with `&&` | exit 0 |

## Method

The suite mocks `data/products.json` and appends one synthetic record, `P900`, with
`status: "draft"`. The fixture is written to be the loudest record in the file rather than the
quietest, because a quiet fixture passes by luck:

| Property of the fixture | The surface it is aimed at |
| --- | --- |
| `flags.featured: true` | home best-sellers row, `?collection=best-sellers` |
| `flags.isNew: true` | home new-arrivals row, `?collection=new-arrivals`, `?sort=newest` |
| `collections: ["gifting"]` | the tag facet, and the sitemap's "is this collection populated" check — nothing else in the catalogue carries this tag |
| `category: "rings"` | `?category=rings`, and the related-products rail of the other 18 rings |
| `pricing.price: 24999` | `?price=premium`, `?sort=price-desc`, and the `OnlineStore` node's aggregate `priceRange` (the dearest real piece is ₹499) |
| `stock.inStock: true` | the order path — a draft that cannot be bought must be unbuyable because it is a draft, not because it is out of stock |

Listing assertions walk **every page** of a result set rather than page one, so a draft cannot
hide on page 3.

## Cases

| ID | Scenario | Expected | Result |
| --- | --- | --- | --- |
| TC-01 | draft is present in `getAllProductsIncludingDrafts` | present | pass |
| TC-02 | draft is the only unpublished record | exactly `[P900]` | pass |
| TC-03 | `getAllProducts` | draft absent | pass |
| TC-04 | `getProductsByCategory("rings")` | draft absent | pass |
| TC-05 | `getProductById("P900")` | `undefined` → page `notFound()` | pass |
| TC-06 | `getProductById` on a published id | defined (control) | pass |
| TC-07 | `getFeaturedProducts` | draft absent despite `featured: true` | pass |
| TC-08 | `getNewArrivals` | draft absent despite `isNew: true` | pass |
| TC-09 | `getRelatedProducts(sibling ring, all)` | draft absent from the whole category | pass |
| TC-10 | `generateStaticParams` | no `P900` param → with `dynamicParams: false`, a hard 404 | pass |
| TC-11 | shop listing, every page, unfiltered | draft absent | pass |
| TC-12 | shop result `total` | equals the published count derived from the raw file | pass |
| TC-13 | `?category=rings`, every page | draft absent | pass |
| TC-14 | every collection facet (4), every page | draft absent | pass |
| TC-15 | `?price=premium` | draft absent | pass |
| TC-16 | `?sort=price-desc` and `?sort=newest` | draft absent | pass |
| TC-17 | first page still full | 12 published items | pass |
| TC-18 | sitemap | no `/product/P900` URL | pass |
| TC-19 | sitemap product URL count | equals the published count | pass |
| TC-20 | sitemap collection URLs | `gifting` still unpublished — a collection populated only by a draft is not populated | pass |
| TC-21 | sitemap categories and static routes | all still present (control) | pass |
| TC-22 | `CollectionPage`/`ItemList` JSON-LD | no draft id, no draft name | pass |
| TC-23 | `OnlineStore.priceRange` | does not stretch to ₹24,999 | pass |
| TC-24 | site-wide schema graph | no draft id, name or price | pass |
| TC-25 | `getOrderPricingCatalogue` | draft absent — cannot be priced or bought | pass |
| TC-26 | `getOrderCaptureCatalogue` | draft absent | pass |
| TC-27 | `getOrderOptionCatalogue` | draft absent | pass |
| TC-28 | `getCatalogueIndex` (crosses to the browser) | draft absent by id and by name | pass |

## Mutation check

A suite that asserts an absence can pass because the thing was never there. To prove these 28
cases are load-bearing, the single line that applies the filter in `lib/products.ts` was
replaced with an unfiltered assignment and the suite re-run:

```
const activeProducts = products;   →  Tests  23 failed | 5 passed (28)
```

The 5 that still pass are the intended controls — the two fixture-sanity cases and the three
"a published product is still there" assertions. The line was restored and the suite returns
28 passed. Three assertions were rewritten during this check because they passed under mutation
by comparing a surface's output against another surface's output; they now compare against a
count derived directly from the raw catalogue file.

## Negative check on the validator

`scripts/validate-products.mjs` was run against a temporarily corrupted catalogue — one product
with `status` deleted, one with `status: "published"` — and failed with exactly two errors
naming both products. The catalogue was restored and the validator returns PASS.

## Not covered

- No manual browser pass. The catalogue currently contains zero drafts, so there is nothing to
  look at in a running app; the fixture exists only inside the suite.
- The `archived` state named as future work in ADR-052 does not exist and is not tested.
