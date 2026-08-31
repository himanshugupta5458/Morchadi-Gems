# ADR-068: The shop's four sorts, its status facet, and its price buckets

- **Status:** Accepted
- **Date:** 2026-08-30
- **Prompt:** 111

## Context

The shop listing shipped with three sorts and three price bands, both chosen before the
catalogue had 449 products in it. Two of those choices had quietly stopped meaning anything.

**"Newest first" was not an order.** The catalogue carries no timestamp — the same absence
[ADR-034](ADR-034-seo-audit-remediation.md) records for ratings and `lib/sitemap.ts` records for
`lastmod` — so the comparator sorted on `flags.isNew` with `flags.featured` as the tiebreak.
408 of 449 records carry `isNew`. The result was one undifferentiated block of nine products in
ten, ordered by id within it, presented to the shopper as recency. It was also the **default**,
so it was the order almost every shopper saw.

**The price bands were built for a different price list.** `under-999` / `1000-4999` /
`5000-plus` partitioned a catalogue whose real prices run ₹35 to ₹2,999, with 444 of 449
products under ₹999 and five above it. Two of the three bands were a rounding error, and the
one band that held anything held everything.

The listing also had no way to ask "what can I actually buy right now", no way to type a budget
that was not one of three bands, and no indication of how much was behind a category box.

## Decision

### 1. Four sorts, all of them properties the catalogue holds

| Slug | Label |
| --- | --- |
| `price-asc` | Price: Low to High |
| `price-desc` | Price: High to Low |
| `name-asc` | A to Z |
| `name-desc` | Z to A |

`newest` is removed from `SortSlug`, from `SORT_OPTIONS` and from `sortComparators`. A URL still
carrying `?sort=newest` falls back to the default, exactly as any other unknown token does.

**The default is `name-asc`.** Alphabetical is the one default that says nothing about which
pieces the shop wants sold — a price-led default editorialises in one direction or the other,
and the flag-led one it replaces was not an order at all. It is also stable under a catalogue
edit, which is what `buildCanonicalShopHref` needs: sort is stripped from the canonical URL, so
the default is the order a crawler is told the page is in.

Names are compared with `localeCompare` rather than `<`, so casing does not split the alphabet
in two. Every comparator still ends on `id`, which is what stops pagination dropping or
repeating a product.

`?sort=newest` had one caller outside the shop — a `/style-guide` link — and it now points at
`?collection=new-arrivals`, which is the route `lib/navigation.ts` already documents as the
correct way to reach new arrivals.

### 2. Five nested price buckets, plus a range the shopper types

| Slug | Label | Bounds (inclusive) |
| --- | --- | --- |
| `under-99` | Under ₹99 | 0–99 |
| `under-299` | Under ₹299 | 0–299 |
| `under-499` | Under ₹499 | 0–499 |
| `under-999` | Under ₹999 | 0–999 |
| `above-999` | Above ₹999 | 1000– |

**Nested rather than partitioned, deliberately.** A shopper looking for a gift under three
hundred rupees wants one question answered, not to work out which of four disjoint bands their
budget straddles. Nesting is safe because selections inside a facet are OR-ed: ticking two
ceilings gives the wider of the two, never an empty set. `above-999` starts at 1000 so the five
cover every rupee with no gap at exactly 999, which an exclusive reading of "Under ₹999" would
have left uncovered.

The custom range is a **separate facet**, parsed from `?min=` and `?max=` and **AND-ed** with the
bands, because it answers a different question: the bands are shortcuts to a price point and the
range is one nobody anticipated. An inverted range is dropped whole rather than applied — a
`min` above its `max` describes no price, and honouring it would render the empty state under
two chips that each look reasonable on their own. It counts as one active filter and clears as
one chip, however many of its two bounds are set.

`PRICE_BANDS` is shared with the admin product list, which reads the same constant. The admin
list gains the new buckets for free, which is the point of it having been shared.

### 3. A status facet that reads the badge, not the fields under it

`?status=` accepts one option per badge [ADR-067](ADR-067-card-variant-selection.md)'s cascade
can render: `sold-out`, `low-stock`, `trending`, `bestseller`, `new`.

Membership calls `selectProductBadge` rather than testing `stock` and `flags` itself. That is
the whole design: "Only a few left" lists exactly the pieces whose cards say that, so a
low-stock piece the owner also marked Trending is filed under the badge a shopper actually saw
rather than appearing in both. A product showing no badge matches no status, which is why an
unbadged product disappears the moment any status is ticked.

### 4. Category counts are computed with every facet **except category** applied

Three readings were available and two of them lie:

| Reading | What goes wrong |
| --- | --- |
| Count the whole catalogue, always | With "Under ₹99" ticked, a static "Gift Hampers (14)" promises fourteen and delivers none |
| Count the current results | A category filter excludes the others by definition, so ticking "Rings" zeroes every other count |
| **Count with the category facet emptied** | The number is what ticking that box would give — which is the question a shopper is asking when they read it |

The third is built. `getShopResults` returns `categoryCounts` alongside the items, and
`lib/shop.test.ts` asserts the identity that makes it honest: for every surfaced category, the
count equals `getShopResults({ ...otherFacets, category: slug }).total`.

### 5. The chips and the sidebar

`ShopActiveFilters` already existed with a Clear all; it gained the two new filter kinds. The
custom range is one chip with no slug, and its × clears both bounds — half a range is not a
filter anybody asked for.

The desktop filter column is `sticky top-36` inside its grid cell, with its own scroll and a
`max-h` that clears the sticky header. It is a plain CSS sticky rather than a scroll listener:
the panel is already a Client Component for its checkboxes, and adding a measurement loop to it
would have bought nothing the property gives for free.

## Consequences

- Every `/shop` URL carrying `?sort=newest` — internal links, bookmarks, anything a crawler
  holds — now renders A to Z rather than 404ing or erroring. The canonical URL for a listing is
  unchanged in shape, and its meaning is now an order that exists.
- The default order visible to shoppers changes for every unfiltered shop page. Nothing about
  which products are on which page is decided by anything but the sort, so pagination, totals
  and the `ItemList` schema all follow it.
- The admin product list's price filter changes with the storefront's, because they share
  `PRICE_BANDS`. That is intended; a second copy of the buckets is the thing worth avoiding.
- Category counts add one pass over the catalogue per shop render. It is a filter over 449
  in-memory records on a page that already filters them once.
