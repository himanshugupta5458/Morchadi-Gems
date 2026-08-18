# Test Result: All-real catalogue import — 2026-08-18

- **Plan:** [PLAN-product-catalogue.md](PLAN-product-catalogue.md), with the collection and
  IA cases in [PLAN-catalogue-ia.md](PLAN-catalogue-ia.md)
- **Commit:** `e5c1f9d` plus the ADR-020 and ADR-021 working tree
- **Environment:** local — Vitest 4.1.10 on Node, plus `node scripts/validate-products.mjs`
  and a served production build on port 3112. No network, no Cashfree credentials.

## Full gate

| Step | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm run test:run` | **467 passing across 16 files** (was 465) |
| `node scripts/validate-products.mjs` | `PASS — all checks green` |
| `npm run build` | Compiled successfully, 66/66 static pages from a cleared `.next` (was 117) |

## Catalogue validation

| Check | Observed |
| --- | --- |
| Products | 49, all ids matching `^P\d{3}$` — zero non-P rows |
| Unique ids | 49 |
| Featured / new | 8 / 8 |
| Out of stock | 6 (P006, P008, P011, P015, P039, P040) |
| With options | 5 (P001, P005, P006, P010, P048) |
| With collections | 8, all `anti-tarnish` |
| Product images on disk | 49/49 |
| Category images on disk | 10/10 |
| Price range | ₹49 – ₹499, zero products outside the ₹25–₹25,000 band |
| Highest implied discount | 78.3% (P020), under the single 80% ceiling |

Category distribution: rings 18, earrings 7, nose-pins 5, bracelets 5, bangles 3, anklets 3,
hair-accessories 3, necklaces 2, watches 2, pendants 1. No category is empty.

## Tests changed

Three assertions were rewritten because they encoded facts about the *invented* catalogue,
not properties of the code. Each was replaced with the property it was reaching for, so
coverage went up rather than down.

| Test | Was | Now |
| --- | --- | --- |
| `shop.test.ts` — "keeps every returned product inside the requested band" | Required every one of the three price bands to return at least one product | Still asserts every returned product is in its band, and now asserts the three bands together return the **whole catalogue** — a stronger partition check that does not care which bands are populated |
| `shop.test.ts` — "ANDs category with price band" | `necklaces` + `5000-plus`, expecting a non-empty result | `necklaces` + `under-999`, expecting a non-empty result, **plus a new case** asserting `necklaces` + `5000-plus` returns exactly 0 — the AND is now tested in both directions |
| `catalogue-ia.test.ts` — "tags no product yet" | Asserted zero products carried a collection tag | Split into two: every tag on every product is a known tag with no duplicates, and `anti-tarnish` is populated while `gifting` is **deliberately** empty |

No test was weakened to accommodate the data, and no test outside these three was touched.

## Served-build checks

Against `next start` on the production build:

| Check | Result |
| --- | --- |
| All 49 `/product/P0NN` pages | 200 |
| All 49 `/products/P0NN.webp` images | 200 |
| `/shop` | "Showing 1–12 of 49 pieces" |
| Each of the ten category filters | Non-empty, counts matching the validator exactly |
| `?collection=anti-tarnish` | 8 pieces |
| `?collection=best-sellers` | 8 pieces |
| `?collection=new-arrivals` | 8 pieces |
| `?collection=under-999` | 49 pieces — the whole catalogue |
| `?collection=gifting` | **"No pieces match"** — expected, see below |
| Home | 16 distinct product cards: 8 new arrivals, 8 best sellers, no overlap |
| `/product/P048` | All four Colour values render in the selector |
| `/product/P039` | Renders the sold-out state |
| Related products on `/product/P048` | P047 and P049 — same category, source excluded |

## Known empty states

Two filter entries resolve to an empty listing. Both are correct descriptions of the real
catalogue rather than defects in the filter, and both are recorded in
[ADR-021](../decisions/ADR-021-all-real-catalogue.md):

1. **Gifting** — nothing in the range is sold as a gift set, and tagging products in to fill
   the facet would make the tag meaningless. Pinned by a test so it cannot be mistaken for
   an oversight.
2. **₹1,000–₹4,999 and ₹5,000 & above** — every product is ₹499 or less, so two of the three
   price checkboxes return nothing and the Under ₹999 collection returns everything.
   Re-banding the price facet to the real spread is a follow-up; the band keys are public URL
   surface under ADR-008 and ADR-020.
