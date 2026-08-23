# ADR-052: A publication status on the product record, enforced at one chokepoint

- **Status:** Accepted
- **Date:** 2026-08-23
- **Prompt:** 66

## Context

The catalogue ships as code ([ADR-001](ADR-001-tech-stack.md)), which means a product becomes
public the moment its record lands in `data/products.json` and someone deploys. There has never
been a way to carry a record in the file without publishing it. That is fine while every record
is finished; it stops being fine the moment the Draft A pipeline
([ADR-051](ADR-051-draft-a-content-pipeline.md)) starts producing records that are structurally
complete but not yet approved by the owner. Those records need to sit in the file — validated,
diffable, reviewable — without a shopper being able to reach them.

The obvious shape is a `status` field. The part that is not obvious, and the part this ADR
exists for, is **where the field is read**.

`data/products.json` is read by more surfaces than the phrase "the product page" suggests. An
audit of every reader found fourteen distinct paths into the catalogue: the shop listing, the
three shop facets (category, collection, price band) and the three sort orders, the home page's
best-sellers and new-arrivals rows, the related-products rail, `generateStaticParams` for the
prerendered product routes, `app/sitemap.ts`, the `CollectionPage`/`ItemList` JSON-LD on the
listing, the `OnlineStore` node's aggregate `priceRange`, the cart's client catalogue, and the
three server-side order catalogues that price, capture and option-validate a purchase.

A field that each of those fourteen remembers to check is a field that thirteen of them will
check correctly and one will not, and the one that does not is discovered by a shopper. Worse,
the failure is silent in exactly the places it matters most: an unpublished product leaking into
the sitemap gets it indexed, and one leaking into `getOrderPricingCatalogue` makes it *buyable*.

## Decision

**1. `status: "draft" | "active"` is a required field on `Product`.** Every one of the 49
existing records was migrated to carry `status: "active"` explicitly, and
`scripts/validate-products.mjs` fails the gate on a product that omits it or carries anything
else. Required rather than optional, so "no status" is a defect the gate catches rather than a
guess the code makes.

**2. The read side defaults a missing status to `active`.** `lib/products.ts` treats only an
explicit `"draft"` as withholding a product. This is the backward-compatible reading, and the
validator above is what stops anything from ever depending on it.

**3. The filter lives at one chokepoint, not at fourteen call sites.** `lib/products.ts` derives
a module-level `activeProducts` once, and **every existing exported accessor reads it** —
`getAllProducts`, `getProductById`, `getProductsByCategory`, `getFeaturedProducts`,
`getNewArrivals`, `getRelatedProducts`, `getCatalogueIndex`, `getOrderPricingCatalogue`,
`getOrderCaptureCatalogue` and `getOrderOptionCatalogue`. Not one consumer file was changed to
add a status check, because not one consumer file needed to know status exists.

This is the decision the "audit every consumer" instruction actually produces. The audit was
run — all fourteen paths were traced and are listed in the build log — and what it found was
that every one of them reaches the catalogue through `lib/products.ts`. Given that, pushing the
filter down to the single module they share is strictly safer than fourteen correct edits,
because it also covers the fifteenth surface, the one nobody has written yet. A shop facet added
next month inherits the rule without being told about it.

**4. `getAllProductsIncludingDrafts()` is the one deliberate way past it.** Its readers are
tools that check the file rather than surfaces that publish it — a validator has to see a draft
to validate it. No route, page, component or order path may call it.

**5. A draft product page 404s.** This was a real choice between two safe-sounding options:
serve the page at its direct URL but keep it out of every listing and the sitemap, or refuse it
outright. **We refuse it.** `getProductById` returns `undefined` for a draft, so the product
page's existing `notFound()` fires, and because `generateStaticParams` also reads the filtered
catalogue while `dynamicParams` stays `false`, the route is never built in the first place — the
404 is Next's own, decided before any of our code runs.

The alternative — a reachable-but-unlisted page — is the shape that leaks. An unlisted URL is
still a URL: it gets pasted into a chat, forwarded, picked up by a crawler that found it in a
referrer header, and it renders a price and an Add to cart button for a piece the owner has not
approved. "Hidden from listings" and "not published" are different claims, and only the second
is one this catalogue can honestly make. The cost is that there is no preview URL for an
unapproved product; the answer to that is the local dev server, where flipping one word in a
JSON file is the whole workflow.

## Alternatives considered

**A boolean `published` instead of a status enum.** Rejected. A boolean answers one question and
cannot grow; `status` already has an obvious third value (`archived`, for a piece the owner has
stopped stocking but whose URL should keep resolving or redirecting rather than 404), and adding
it later to an enum is a row in a union, where adding it to a boolean is a migration.

**Filtering at each consumer.** Rejected on the reasoning above: fourteen correct edits today
and an unbounded number of chances to forget tomorrow. It also makes the guarantee
unstateable — there would be no single place to point at and say "this is where a draft stops".

**Filtering in the shop and sitemap only, leaving the order path unfiltered.** Rejected. It
reads as harmless — nothing links to a draft, so nothing can add one to a cart — but the cart
posts product ids, and the server prices whatever id it is given against the catalogue it holds.
Leaving drafts in `getOrderPricingCatalogue` means a hand-written `curl` can buy an unapproved
product at whatever price its half-finished record happens to carry. The order catalogues are
the *most* important place to filter, not the least.

**Keeping drafts in a separate file.** Rejected. It doubles the schema's surface, and every
validator, type and script would need to learn about the second file. The whole value of the
catalogue being one file is that one gate checks all of it.

## Consequences

Adding a product to the catalogue without publishing it is now one word in a JSON record.
Publishing it is one word changed and a deploy — still a diff, still an audit trail, which is
the property [ADR-001](ADR-001-tech-stack.md) exists to protect.

The counters in `scripts/validate-products.mjs` that back a *rendered* surface — the
best-sellers floor, the new-arrivals floor, the sold-out coverage check, and the
"every category has products" check — now count published products only. A catalogue whose only
four featured pieces are drafts has an empty home row, and the gate says so rather than
counting records nobody can see. `EXPECTED_PRODUCT_COUNT` still counts every record in the file,
drafts included, because it is a check on the file rather than on a surface.

What would force a revisit: an `archived` state, which needs a routing decision (410? 301 to the
category?) that a 404 does not answer well; or a genuine need to preview an unapproved product
on the production host, which would need a signed, `noindex`, non-buyable preview route rather
than a relaxation of the rule above.

The regression suite for all of this is `lib/product-status.test.ts`, which injects a synthetic
draft into the catalogue and asks all fourteen surfaces at once. See
[the test result](../testing/RESULT-2026-08-23-product-status-field.md).
