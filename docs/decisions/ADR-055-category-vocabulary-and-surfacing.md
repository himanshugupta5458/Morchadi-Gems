# ADR-055: `gift-hampers` is the eleventh category, and a category's vocabulary is separated from its shopfront

- **Status:** Accepted
- **Date:** 2026-08-23
- **Prompt:** 73

## Context

[ADR-020](ADR-020-two-tier-catalogue-ia.md) fixed the catalogue's first tier at ten categories.
[ADR-054](ADR-054-stage-0-migration-batch-preparation.md) built the Odoo migration's Stage 0
against **eleven**, on the owner's decision that gift hampers are a category the shop sells, and
recorded the mismatch as an open question in its own Consequences: *"`gift-hampers` is accepted by
Stage 0 and by nothing else in the repository. It needs an owner decision before any record
carrying it can become a product."*

That decision has been made. This ADR is its implementation, not a re-opening of it.

Four files enumerate the category list, each duplicating it deliberately so that a plain script
stays runnable with no application code loaded:

| File | Was | Why it has its own copy |
| --- | --- | --- |
| `types/product.ts` | 10 | The `Category` union and the labels every surface renders |
| `scripts/validate-products.mjs` | 10 | Validates `data/products.json` as plain ESM |
| `scripts/validate-draft-a.mjs` | 10 | Validates Draft A objects as plain ESM |
| `scripts/prepare-migration-batch.mjs` | 11 | Stage 0, built against the owner's decision |
| `scripts/generate-placeholders.mjs` | 10 | Needs a tint per slug to draw a tile |

Adding the slug to the first four is mechanical. It is the fifth consequence that is not: in
`types/product.ts`, `CATEGORIES` is not merely a validation vocabulary. It is read directly by the
header nav, the mobile drawer, the footer, the home page's category grid, the shop's filter panel,
the shop page's own subtitle copy, and the sitemap. Adding an eleventh entry to it ships an
eleventh category to shoppers — a nav link, a home tile, a filter checkbox and a crawlable sitemap
URL, all leading to a listing with nothing in it.

`scripts/validate-products.mjs` already refused exactly this, and refused it correctly:

```
category "gift-hampers" has no published products — its listing would render empty
```

The first gift-hamper product does not exist yet. It arrives with the Odoo migration, through the
queue ADR-054 builds. So the decision and its products are separated in time, and the repository
had no way to express that gap.

## Decision

### 1. `gift-hampers` is the eleventh category slug, everywhere

Added to `types/product.ts` (union, `CATEGORIES`, label "Gift Hampers"),
`scripts/validate-products.mjs`, `scripts/validate-draft-a.mjs` and
`scripts/generate-placeholders.mjs`. `scripts/prepare-migration-batch.mjs` already had it.

`lib/category-vocabulary.test.ts` asserts all four enumerations hold the same eleven slugs, by
reading the two plain scripts' source for their declared arrays. The lists stay duplicated for the
reason each file already gives; what changes is that they can no longer drift apart silently.

Stage 0's `CATEGORIES_UNKNOWN_DOWNSTREAM` warning is **deleted** rather than emptied. It existed to
flag exactly this gap, the gap is closed, and an empty constant guarding an unreachable branch is
dead code. The cross-file test replaces it, and replaces it with something stronger: a runtime
warning fired only when a record happened to carry the slug, where the test fails the moment any
list drifts, batch or no batch.

### 2. A category's vocabulary and its shopfront are two different lists

`CategoryOption` gains a `status` of `"surfaced"` or `"pending"`.

- **`CATEGORIES`** — the vocabulary. Every slug a product record may carry, what `isCategory`
  answers for, and what all three validators check against.
- **`SURFACED_CATEGORIES`** — the ten a shopper can reach. The nav, the mobile drawer, the footer,
  the home grid, the shop filter panel, the shop subtitle and the sitemap read this.

`isSurfacedCategory` is the narrower guard, and `lib/shop-query.ts` parses `?category=` against it
rather than `isCategory`, so a hand-typed `?category=gift-hampers` falls back to the whole shop
instead of rendering an empty one.

This is [ADR-052](ADR-052-product-status-field.md)'s shape applied one tier up. That ADR gave a
*product* a state in which it exists in `data/products.json`, validates like any other, and reaches
no public surface. A category now has the same. In both cases the state is a value a person flips
in a commit, which is [ADR-001](ADR-001-tech-stack.md)'s catalogue-as-code rule unchanged.

**A static flag, not a count over the catalogue.** Deriving "does this category have products" at
render time would be more honest-looking and is the wrong trade here: `PrimaryNav`, `MobileNav` and
`ShopFilterPanel` are all Client Components importing `types/product.ts`, and reaching
`data/products.json` from them would put the whole catalogue in the browser bundle to answer a
question with eleven possible answers. That is the cost
[ADR-010](ADR-010-cart-architecture.md) already paid once to avoid, when `getCatalogueIndex()` was
introduced to keep 67.9 kB of raw JSON out of the cart provider. A flag costs nothing, and the
validator below is what keeps it true.

### 3. `validate-products.mjs` checks the gap in both directions

The existing check is narrowed to surfaced categories and keeps its full force there. A second
check is added facing the other way:

| Check | Fails when |
| --- | --- |
| Surfaced category has ≥ 1 published product | A shopper could click through to an empty listing |
| Pending category has 0 published products | A product exists that **no shopper can reach**, because its category is still hidden |

The second is the one that makes the flag safe to have. Without it, `pending` would be a way to
lose products quietly — precisely the failure ADR-054 spent its Part A refusing to allow. Its
message names the fix: *flip its status to `"surfaced"` in `types/product.ts`, or nobody can reach
them.* Both were proved to fire by deliberately breaking each one and restoring it; the run is in
[RESULT-2026-08-23-category-vocabulary.md](../testing/RESULT-2026-08-23-category-vocabulary.md).

The category-image check stays over all eleven, and
`public/categories/gift-hampers.webp` was generated. An asset that exists before it is needed makes
flipping the flag a one-line change rather than a change plus an asset — the same reasoning
`docs/design/IMAGES.md` already records for `watches` and `hair-accessories`, which
[ADR-020](ADR-020-two-tier-catalogue-ia.md) shipped tiles for a prompt before either category held
a product.

### 4. Surfacing is a storefront question, and no draft's business

`draft-a-skills.md` rule 5 gains the slug and an explicit note that whether a category is browsable
never affects the value written to a draft. A Draft A object records what a piece *is*; where it
appears in the shop's information architecture is decided elsewhere and later. Nothing in
`content-pipeline/` reads `status`.

## Alternatives considered

**Add the slug and ship the empty category.** One line, and it is what "add the eleventh category"
sounds like. Rejected: it puts an empty listing in the nav, the home grid, the filter panel and the
sitemap. The sitemap entry is the worst of them — a crawlable URL with no content, against a
repository with four rounds of SEO audit history behind it. It would also have required deleting
the empty-category check, losing that coverage for the ten real categories.

**Add a placeholder gift-hamper product so the category is non-empty.** Rejected outright.
[ADR-021](ADR-021-all-real-catalogue.md) makes the catalogue the owner's real pieces only, and
`validate-products.mjs` enforces the P-code scheme specifically so that an invented product cannot
be added. Inventing one to satisfy a validator is inventing one.

**Hold the slug back until the first hamper ships.** Would keep the two lists identical. Rejected
because it leaves ADR-054's open question open, and because the migration's Stage 0 already accepts
the slug — records carrying it are being queued now, and they need somewhere valid to land.
Deferring would mean the vocabulary is decided at extraction time by whoever happens to be running
the batch.

**Derive the surfaced set from the catalogue at render time.** Rejected for the bundle cost in
decision 2. It also loses the ability to hold a category back deliberately for any other reason,
and it makes a shopper-visible fact depend on data rather than on a decision.

## Consequences

**What changes for a shopper.** Nothing. The nav, the home grid, the filter panel and the sitemap
list the same ten categories as before, and `?category=gift-hampers` behaves as an unknown filter.

**What changes for a product.** `gift-hampers` is now a value a record can carry through every
validator. It cannot be *published* under that category until the flag is flipped — and if one is
published anyway, `npm run validate:products` fails and says so.

**What flipping the flag will cost, when the first hamper ships.** One word in `types/product.ts`,
in the same commit as the product. The tile image, the label, the nav entry, the sitemap URL and
the filter checkbox all follow from it. `lib/category-vocabulary.test.ts` has assertions that will
need updating in that commit — deliberately, since they encode the current state as a fact rather
than as a guess.

**What is not addressed.** Whether gift hampers need their own product-record shape — contents
lists, per-item provenance, food-safety or expiry information — is untouched here. This ADR makes
the category expressible; it does not claim the existing `Product` shape is the right one for a
hamper. That question arrives with the first real record.
