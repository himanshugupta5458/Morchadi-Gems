# Test Plan: Product catalogue

- **Scope:** the integrity of `data/products.json` against the `Product` interface in
  `types/product.ts`. Covers shape, identifier conventions, category coverage, flag counts,
  and price sanity.
- **Not in scope:** the accessor behaviour of `lib/products.ts` (no unit test runner is
  installed yet — see Gaps), rendering, pricing arithmetic at checkout.
- **Prerequisites:** none. `npm run validate:products` needs no env vars or network.
- **Runner:** `scripts/validate-products.mjs`, executed via `npm run validate:products`.
  It accumulates every failure rather than stopping at the first, and exits non-zero if any
  check fails.

## Why this exists

`lib/products.ts` asserts `catalogue as Product[]`. TypeScript cannot verify that assertion
against a JSON literal — it infers `category: string`, so a misspelled slug or an
out-of-range rating typechecks cleanly. This plan is what makes the assertion trustworthy.
See [ADR-002](../decisions/ADR-002-product-data-model.md).

## Cases

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | File is valid JSON | Parse `data/products.json` | Parses without error; top level is an array | Automated |
| TC-02 | Catalogue size | Count entries | At least one; the exact count is reported, not asserted — see [ADR-020](../decisions/ADR-020-two-tier-catalogue-ia.md) | Automated |
| TC-03 | Identifier uniqueness | Collect all `id` values into a set | Set size equals entry count; no duplicates | Automated |
| TC-04 | Identifier convention | Match each `id` against `^P\d{3}$`, or against `^<prefix>-\d{3}$` for its category | Every id is either a P-code (the owner's own products) or matches its category's prefix (`nk`, `er`, `rg`, `br`, `bn`, `pd`, `ak`, `np`, `wt`, `ha`) — see [ADR-016](../decisions/ADR-016-real-product-import.md) | Automated |
| TC-05 | Category validity | Check each `category` against the ten known slugs | No unknown slug | Automated |
| TC-06 | Category coverage | Count products per category | Reported per category; an empty category is named in the report, not failed — `watches` and `hair-accessories` hold nothing until the catalogue import | Automated |
| TC-07 | Required scalar fields | Check `name`, `shortDescription` are non-empty strings | All present and non-empty | Automated |
| TC-08 | Price type | Check `price` is a positive integer | All prices whole rupees, greater than zero | Automated |
| TC-09 | Price range | Bucket prices into budget / mid / premium | Zero products fall outside ₹100–₹25,000 | Automated |
| TC-10 | Images shape | Check `images` is an array of non-empty strings | Array in every case, even with one placeholder | Automated |
| TC-11 | Details shape | Check `details.material` required; `weight` required on placeholder rows and optional on the owner's; `closure`, `type`, `stone`, `size` optional but non-empty when present | Conforms to `ProductDetails` | Automated |
| TC-12 | Details has no stray keys | Compare `details` keys against the allowed six | No unknown keys | Automated |
| TC-13 | Rating range and precision | Check `rating` is 3.5–5.0 to one decimal | All within range | Automated |
| TC-14 | Review count | Check `reviewCount` is a non-negative integer | Valid for every product | Automated |
| TC-15 | Review array size | Count `reviews` per product | Between 2 and 3 inclusive | Automated |
| TC-16 | Review shape | Check each review's `name`, `text`, `rating` | Non-empty strings; rating 1–5 | Automated |
| TC-17 | Review text distinctness | Compare review texts within a product | No product repeats the same text twice | Automated |
| TC-18 | Featured count | Count `featured === true` | At least 4, enough to fill the home best-sellers row | Automated |
| TC-19 | New arrivals count | Count `isNew === true` | At least 4, enough to fill the home new-arrivals row | Automated |
| TC-20 | Out-of-stock fixture | Count `inStock === false` across the catalogue | At least one, so the sold-out UI keeps coverage | Automated |
| TC-21 | Flag types | Check `featured`, `isNew`, `inStock` are booleans | No truthy strings or numbers | Automated |
| TC-22 | Product has no stray keys | Compare each product's keys against the 16 allowed | No unknown keys | Automated |
| TC-23 | Discount ceiling | Compute `(mrp - price) / mrp` per product | At most 60% on placeholder rows, 80% on the owner's — see [ADR-003](../decisions/ADR-003-discount-display-pricing.md) and [ADR-016](../decisions/ADR-016-real-product-import.md) | Automated |
| TC-24 | Options shape | Where `options` is present, check it is an array of `{ name, values }` | Every option has a non-empty `name` and at least one non-empty value | Automated |
| TC-25 | Options distinctness | Compare option names within a product, and values within an option | No product repeats an option name; no option repeats a value | Automated |
| TC-26 | Owner's photography on disk | Check `public/products/P0NN.webp` exists for each P-code | All 21 present; covered by TC-10's on-disk check, called out here because these are irreplaceable files rather than regenerable placeholders | Automated |
| TC-27 | Collection tags | Where `collections` is present, check it is an array of known tags | Every entry is `gifting` or `anti-tarnish`, no duplicates within a product; absent is valid and is the case for every product until the catalogue import | Automated |

## Negative cases

The validator is designed to fail loudly on the mistakes most likely to occur during hand
editing. These were confirmed by temporarily corrupting a copy of the catalogue:

| ID | Injected fault | Expected detection |
| --- | --- | --- |
| TC-N1 | Duplicate an existing `id` | TC-03 fails, naming the duplicate |
| TC-N2 | Misspell a category as `neckalces` | TC-05 fails. TC-04 does not fire — the id-prefix check is guarded by a valid category, so an unknown slug is reported once rather than twice |
| TC-N3 | Set a `rating` to `7.4` | TC-13 fails |
| TC-N4 | Set a `price` to `"1200"` (string) | TC-08 fails |
| TC-N5 | Flag a ninth product as `featured` | TC-18 fails with the observed count |

## Gaps

- `lib/products.ts` accessors are not unit tested — no test runner is installed. When one is
  added, `getRelatedProducts` needs a case proving it excludes the source product and
  respects `limit`, and `getProductById` needs a miss case returning `undefined`.
- The validator does not check that `featured` and `isNew` products are spread across
  categories; that is currently a convention held by hand.
- Price *correctness* is not testable here — only plausibility. Server-side total
  computation gets its own plan when checkout is built.
