# ADR-020 — Two-tier catalogue IA: ten categories, five collections

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 19
**Builds on:** the product data model in [ADR-002](ADR-002-product-data-model.md), the
chrome and mega-nav in [ADR-005](ADR-005-navigation-and-chrome.md), the image path
convention in [ADR-006](ADR-006-product-image-convention.md), the shop filter architecture
in [ADR-008](ADR-008-shop-architecture.md), and the real catalogue in
[ADR-016](ADR-016-real-product-import.md)

## Context

The catalogue had one axis: eight categories, one per product, doing every job at once —
the nav, the home tiles, the shop facet, the footer, the SEO title. That worked while the
catalogue was eight neat piles of invented product.

Two things broke it.

**The owner's real range does not fit in eight piles.** Watches and hair accessories are
sold and neither has anywhere to go. Nath are sold and would be a ninth pile of four
products if they got a category of their own.

**The questions shoppers actually ask are not category questions.** "What can I gift?"
"What won't tarnish?" "What's under a thousand rupees?" "What's new?" None of those is
answerable by a single-axis taxonomy, and none of them is a category — a gift can be a
ring, a necklace or a watch. Forcing them into the category axis would mean a product
belonging to two categories at once, which breaks the one guarantee the axis is worth
having: that every product has exactly one home, so the ten category pages partition the
catalogue with no overlap and no gap.

A third pressure sits underneath both: the catalogue is about to stop being 100 products.
The next prompt replaces the 79 invented placeholders with the owner's real range, roughly
49 products, all real. Any structure decided now has to survive a catalogue shrinking by
half and two categories that are legitimately empty in the meantime.

## Decision

**Two tiers. A category is what a product *is*. A collection is what a product is *for*.**

### Tier one — categories (exactly one per product)

Ten, in nav order: `necklaces`, `earrings`, `rings`, `bracelets`, `bangles`, `pendants`,
`anklets`, `nose-pins`, `watches`, `hair-accessories`.

`watches` and `hair-accessories` are new. The `Category` union, the `CATEGORIES` constant
and the `isCategory` guard are the single source; the nav, the home tiles, the footer, the
shop facet, the placeholder generator and the validator all read from it, so the tier is
extended in one place.

**Nath belong to `nose-pins`.** A nath is a nose ornament, it sits beside nose pins in
every way a shopper would search for it, and four products do not earn a top-level tier
slot they would then own alone. The mapping is applied at import, not at read time — there
is no `nath` slug anywhere in the code.

### Tier two — collections (zero or more per product)

Five, in nav order:

| Collection | Slug | Populated by |
| --- | --- | --- |
| Gifting | `gifting` | `product.collections` tag |
| Anti-Tarnish | `anti-tarnish` | `product.collections` tag |
| Best Sellers | `best-sellers` | the existing `featured` flag |
| New Arrivals | `new-arrivals` | the existing `isNew` flag |
| Under ₹999 | `under-999` | the existing `under-999` price band |

**Only two of the five are new data.** `Product.collections?: CollectionSlug[]` is optional
and accepts exactly `gifting` and `anti-tarnish`. The other three are derived from fields
the product record already carries — a tag that duplicates `featured` is a tag that can
disagree with `featured`.

`COLLECTIONS` records *how* each one is populated, as a discriminated `source`:
`{ kind: "tag" }`, `{ kind: "featured-flag" }`, `{ kind: "new-flag" }`,
`{ kind: "price-band"; band: "under-999" }`. `isProductInCollection` switches on that one
field, so the difference between a tagged collection and a derived one lives in the
constant table rather than being spread across the nav, the facet and the filter.

`under-999` names the existing price band rather than restating `price < 999`, so the
Collections facet and the Price facet can never disagree about which side ₹999 falls on
(it is inside — the band's bounds are inclusive).

### The nav is two dropdowns

"Shop by Category" (the ten) and "Collections" (the five), with About and Contact as
top-level links. The per-category mega-nav panel it replaces — an "All" link plus three
price bands, repeated eight times — was 32 entries expressing four ideas, and would have
been 40.

**Every collection link uses `?collection=<slug>`, including the three derived ones.**
Sending New Arrivals to `?sort=newest` instead was the obvious shortcut and is wrong: sort
is not filter, so the shopper would land on the whole catalogue with the box they just
clicked left unchecked in the sidebar. One param, one meaning, and the nav, the facet and
a pasted URL all express the same state.

### The shop filter

`ShopQuery` gains `collections`, parsed, canonicalised, toggled and serialised exactly like
`categories`. Selections within a facet are OR-ed; the three facets are AND-ed. The URL
stays the single source of truth, and `matchesShopQuery(product, query)` is exported as a
pure predicate so the behaviour can be tested against fixtures rather than against whatever
the catalogue happens to hold that week.

### The validator stops assuming a hundred products

`scripts/validate-products.mjs` checked an exact catalogue size of 100, exactly 8 featured,
exactly 8 new, and 2–3 out-of-stock *placeholder* products. Every one of those encodes the
invented catalogue that is about to be deleted. They become floors — at least one product,
at least four featured and four new (enough to fill a home row), at least one out-of-stock
product for the sold-out UI — and the exact numbers move to the printed report, where a
human can read them without the script failing over them.

An empty category is likewise reported, not failed. `watches` and `hair-accessories` hold
nothing until the next prompt, and a structure change that cannot land before the data it
structures is not a usable structure change.

## Alternatives considered

**Keep one axis and add gifting, anti-tarnish and watches as categories.** Cheapest, and
it destroys the partition: a gifting ring would be in two categories, so the category pages
would overlap, the counts would stop summing to the catalogue, and "one product, one
category" — the thing that makes `getProductsByCategory` and the ten SEO pages honest —
would be gone.

**Make collections a first-class taxonomy with their own pages and images.**
`/collections/gifting` with its own hero and copy. Rejected as premature: a collection page
is a shop listing with a filter pre-applied, `/shop?collection=gifting` already is that
page, and a collection has no honest image — it cuts across categories, so any photograph
chosen for it misrepresents four-fifths of what it contains.

**Tag all five collections on the product.** Uniform, and it invents a way for the data to
lie. A product tagged `best-sellers` while `featured: false` is a contradiction with no
right answer; deriving it makes the contradiction unrepresentable.

**Sub-categories under each category.** A real second level (`rings › stackable`) rather
than a cross-cutting one. Rejected: at roughly 49 products a sub-level would average five
products per leaf, and it still would not answer "what can I gift?".

## Consequences

- The category tier is extended in `types/product.ts` alone; nine other files follow.
- Two placeholder category images ship at `/categories/watches.webp` and
  `/categories/hair-accessories.webp`, on the ADR-006 path convention and under the
  generator's existing never-overwrite rule.
- Home shows ten tiles (5×2 desktop, 2-col mobile) plus a collection strip beneath them.
- The shop sidebar has three facets; `/shop?collection=anti-tarnish` gets its own title
  and canonical, on the same single-facet rule the category titles already use.
- `Product.collections` is live and unused — no product carries a tag until the catalogue
  import in the next prompt, and the validator accepts a tag list the moment one appears.
- The 100-product assumption is gone from the validator. It was the last place the
  invented catalogue was load-bearing.
