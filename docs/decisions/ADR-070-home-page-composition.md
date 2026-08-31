# ADR-070: Home page composition — ten tiles, a search box, and photographed collections

- **Status:** Accepted
- **Date:** 2026-08-31
- **Prompt:** 115

## Context

The home page had grown into six full-width bands of roughly equal weight, in an order that
served nobody in particular: hero, categories, new arrivals, best sellers, promises, track
order. Three problems were named against it.

A shopper who **already knows what they want** had no way to say so. The site had no search of
any kind, and the nav offers eleven categories and four collections — which is a taxonomy, not
an answer to "do you have a clover anklet".

A shopper deciding **whether to trust the shop** had to scroll past four bands to find out about
returns. The promise band sat between the best sellers and the track-order form.

And the page **read as static**: eleven category tiles in a five-across grid left an orphan on
the third row, the collection tier was a row of flat text links, and the gaps above "Shop by
Collection" and above "The Morchadi Promise" measured close to a full empty screen at desktop
width.

## Decision

Seven changes, each recorded here because each reverses or narrows something previously written
down.

**Ten category tiles, gift hampers held back.** `HOME_HIDDEN_CATEGORIES` in `types/product.ts`
names the exclusion and `HOME_CATEGORY_LIMIT` caps the grid. `gift-hampers` stays `surfaced`:
it is in the nav, the shop facets, the sitemap and its own listing, and 23 products carry it.
It is only out of the *tile grid*, because the other ten name a thing you wear and a hamper is a
way of buying several of them — a grid that asks "Rings or how it is packaged?" is not asking one
question. A list rather than a new field on `CategoryOption`, because this is a fact about one
page and not about the category; [ADR-055](ADR-055-category-vocabulary-and-surfacing.md)'s
`status` field is untouched and `SURFACED_CATEGORIES` is still eleven.

**Eight new arrivals, not twelve.** Two clean rows of the four-across grid instead of three.
The cap itself is unchanged in kind — `flags.isNew` is carried by 408 of 449 records, so the
strip has always had to state how much of that it wants.

**"Top notch quality" replaces "Anti-Tarnish Quality".** Anti-tarnish is true of most of the
catalogue and is still claimed where it is true — the site description, the hero, the pieces
themselves. The promise band covers *every* order, and a claim that covers every order has to be
one every order can keep. The category subtitle's "held to the same anti-tarnish standard" goes
the same way, and its "Eleven categories" is now derived from the list length rather than typed.

**A compact promise strip directly under the hero.** `TrustStripCompact` reads the same array as
the full band, so it is a second *rendering* and never a second copy — the free-shipping
threshold cannot differ between the top of the page and the bottom. The full band stays where it
was for anyone reading top to bottom, and the compact one is reused under the product page's buy
actions.

**Search, as a shop facet rather than a mode.** `ProductSearch` is a real `GET` form pointed at
`/shop` with the input named `q`, enhanced with a dropdown that asks `/api/search`. `ShopQuery`
grows a `search` field that is AND-ed with every other facet, carried in the canonical URL, and
cleared by its own chip. A route rather than a client-side index: the suggestion fields for 449
products come to roughly 50KB of JSON that every visitor would pay for on the chance they search.
A searched listing is `noindex, follow` — `?q=` accepts arbitrary text, and leaving it indexable
mints an unbounded set of near-duplicate pages, which is the internal-search trap
[ADR-034](ADR-034-seo-audit-remediation.md) already guards the empty-facet case against.

**Photographed collection tiles.** This reverses `CollectionStrip`'s own stated reasoning —
"collections cut across categories, so they have no single image that could honestly stand for
one". That held for an image chosen by hand. It does not hold for one *derived from the
collection's own membership rule*: `getCollectionCovers` asks `isProductInCollection`, the same
function the `?collection=` facet filters with, so every tile shows a piece the tile's own link
will list. A featured member is preferred where the collection has one, which is merchandising
rather than honesty. A collection with no photographed member keeps the plain treatment.

**A hover photograph on cards, and a curated social band.** The card reveals `media.images[1]`
on hover, and on a phone when its link takes focus. Thirteen of 449 records have a second
photograph; the other 436 render **no second image element at all**, so there is nothing to fade
to and no placeholder flashes. The social band renders manually curated posts from
`data/social-proof.json` — and it **ships empty, which is its finished state**. See below.

## Alternatives considered

**Make gift hampers `pending`.** Would have removed it from the nav, the shop facets and the
sitemap along with the grid, and stranded 23 products.

**An admin form for social proof, reusing the product editor's patterns.** Rejected on three
counts, in order of weight. The admin panel's writes are gated off in production
([ADR-064](ADR-064-admin-product-management.md)), so the form would edit nothing on the live
site. Each entry needs an image file in `public/social/` beside it, and a form that cannot upload
the photograph edits half the record. And a customer's words attributed to them by name is
exactly the kind of claim the catalogue already ships as code, because a diff is the best audit
trail a claim can have.

**Seeding the social band with sample entries.** Refused.
[ADR-034](ADR-034-seo-audit-remediation.md) removed fabricated reviews and testimonials from this
site, and `lib/no-fabricated-reviews.test.tsx` keeps them out. Inventing quotes to demonstrate the
component would reintroduce precisely what that ADR deleted, in a new file name. The section
renders nothing until a real post exists — the same rule `BUSINESS.socialProfileUrls` follows.

**A client-side search index.** Rejected on payload; see above. It would also have needed the
category labels and prices in the bundle, which is the shape `toCatalogueEntry` exists to keep
narrow.

**CSS-only reveal for the collection tiles.** `animation-timeline: view()` is not broadly
supported yet. `RevealOnScroll` is one `IntersectionObserver` that disconnects after firing once,
and it honours `prefers-reduced-motion` in script rather than in CSS — the hidden state is
`opacity: 0`, so a media query governing only the transition would leave those readers looking at
nothing.

## Consequences

The home page ships three new client components: the search box, the reveal wrapper, and (from
[ADR-069](ADR-069-floating-contact-clearance.md)) the contact button. Everything else on it is
still a Server Component, and the product cards are unchanged in that respect — the hover swap is
two stacked `next/image` fills crossfading in CSS.

`/api/search` is the first route on this site that exists purely to serve the storefront's own UI.
It reads `data/products.json` and touches no database, so it has no failure surface to add to
[ADR-048](ADR-048-database-health-and-failure-surfaces.md)'s table; a fetch that fails leaves the
form underneath still submitting to `/shop`.

`data/social-proof.json` is a second catalogue-shaped data file. Its rules are enforced by
`lib/social-proof.test.ts` rather than by a `validate:` script, because the file is small and
every rule in it is about a claim rather than about a schema. If it ever grows past a handful of
entries, that judgement should be revisited.

Revisit the tile cap if a twelfth category is agreed, and revisit the search route if the
catalogue grows past a few thousand records, at which point a linear scan per keystroke stops
being free.
