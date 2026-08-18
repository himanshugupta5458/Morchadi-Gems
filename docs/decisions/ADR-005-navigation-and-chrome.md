# ADR-005: Navigation and global chrome

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 4

## Context

The catalogue has exactly one axis of taxonomy: a flat `Category` union of eight slugs
([ADR-002](ADR-002-product-data-model.md)). There are no sub-categories, no collections, no
tags, and — with no database and no admin panel ([ADR-001](ADR-001-tech-stack.md)) — no way
to add any without shipping code.

That collides with the shape jewellery retail expects. Indian jewellery storefronts almost
universally run a horizontal category bar where each category opens a mega-panel. A bar of
eight bare links with nothing behind them reads as an unfinished site, but the obvious fix —
inventing sub-categories to fill the panels — would put a taxonomy in the navigation that
does not exist in `data/products.json`.

The chrome also has to carry three things that are presentation, not commerce: a rotating
announcement strip, a floating WhatsApp button, and a store-level testimonial band. Each is
an opportunity to accidentally introduce state, a data source, or a dependency that later
prompts would have to unwind.

## Decision

**1. The mega-nav panels are price-band quick filters, not sub-categories.**

Each of the eight category triggers opens a panel with four links, all pointing at `/shop`
with query params:

| Link | Href |
| --- | --- |
| All {Category} | `/shop?category={slug}` |
| Under ₹999 | `/shop?category={slug}&price=under-999` |
| ₹1,000 – ₹4,999 | `/shop?category={slug}&price=1000-4999` |
| ₹5,000 & above | `/shop?category={slug}&price=5000-plus` |

Price is the second axis the catalogue already has — every product carries a `price`, so
these filters are derivable from the data and cannot drift from it. The band boundaries
match the budget / mid / premium spread the seed catalogue was built to.

`lib/navigation.ts` owns the shape. `NAV_CATEGORIES` derives from `CATEGORIES`, so the
desktop nav, the mobile accordion, and the footer's Shop column are all one source. Adding a
ninth category is a one-line change in `types/product.ts`.

**2. The header is sticky; the announcement bar is not.**

`header` is `sticky top-0`. The announcement strip sits above it in normal flow and scrolls
away. Category navigation and the cart are reachable from anywhere on a long product grid;
a promotional strip that follows the user down the page is not worth the vertical space.

**3. The announcement bar and the WhatsApp button are cosmetic and stateless.**

The announcement bar holds three hard-coded strings and one rotation index. It is
non-dismissible, so it stores nothing — no `localStorage`, no cookie, no server state. All
three messages stay in the DOM at full opacity in the accessibility tree, faded visually
rather than swapped, so screen readers read all three once instead of being interrupted
every four seconds; the fade is disabled under `prefers-reduced-motion`.

The WhatsApp button is a plain `<a>` to `wa.me`. There is no widget, no embedded chat, no
third-party script. The number and greeting live in `lib/config.ts` as the single place that
value is written.

**4. The cart badge reads a seam, not cart state.**

Cart state does not exist yet. `lib/cart-count.ts` exports `useCartItemCount()`, which
returns `0`; `CartLink` hides the badge at 0. When the cart context lands, that hook body is
the only thing that changes — no chrome component is touched. Building a partial cart store
now to feed a badge would mean rewriting it in the cart prompt.

**5. Category links resolve to routes that do not exist yet.**

`/shop`, `/cart`, `/about`, `/contact`, `/terms`, and `/product/[id]` all 404 today. The
chrome links to their final URLs anyway rather than to `#` placeholders, so no sweep is
needed later to find and repoint dead anchors.

## Alternatives considered

**Invent sub-categories for the panels** (Necklaces → Chokers, Long Chains, Temple). Would
look right and be a lie: nothing in `data/products.json` distinguishes them, so either
`/shop` ignores the param or every product needs a hand-assigned sub-category with no admin
panel to maintain it. Rejected — the navigation must not promise a taxonomy the data cannot
honour.

**Panels filled with material or occasion filters** (gold / silver / kundan, bridal /
daily). `details.material` is free text, not an enum, and occasion is not modelled at all.
Both would need a data-model change first. Reasonable later; not derivable today.

**Plain links, no dropdowns.** Honest and the least code. Rejected because eight top-level
links is the whole of the navigation — with no dropdowns, a shopper's only way to narrow by
price is to land on `/shop` and find the filter panel. The quick filters put the second axis
one hover away.

**Sticky announcement bar.** Rejected: 36px of permanently occupied viewport for a message
that has been read once.

**A WhatsApp chat widget SDK.** Rejected: a third-party script on every route for what a
link does, plus a privacy surface the site does not otherwise have.

**Testimonials on the `Product.reviews` array.** Rejected: those are per-product and already
render on the product page. Store-level testimonials answer a different question ("is this
shop trustworthy" vs "is this piece good"), so they get their own type and JSON file.

## Consequences

Adding a category is one line in `types/product.ts` and it appears in the desktop nav, the
mobile accordion, and the footer with its four quick filters already wired.

`/shop` now has a contract to honour: it must read `category` and `price` query params and
treat the three band keys as its vocabulary. If `/shop` implements price filtering
differently, the band keys here must change with it — they are a public URL surface, so
changing them later breaks any shared or bookmarked link.

The price bands are hard-coded rupee boundaries. They will need revisiting if the catalogue
moves substantially up or down market; they are not derived from the current price
distribution at runtime.

The footer year is evaluated at build time, since every route is statically prerendered. A
site left un-deployed across a New Year shows the previous year until the next build.

What would force a revisit: adding a real second taxonomy (collections, occasions, materials
as an enum) — at that point the panels should show it and the price bands should move into
the `/shop` filter sidebar where they belong.
