# ADR-029: SEO foundations — a generated sitemap, robots rules, and structured data that repeats the real policies

- **Status:** Accepted
- **Date:** 2026-08-18
- **Prompt:** 29

## Context

The site had per-page titles, descriptions and canonicals from prompt 12 onward, and a
branded share card from prompt 22. It had nothing a search engine could read as commerce: no
sitemap, no `robots.txt`, no structured data. A jewellery listing without a `Product` node
gets a plain blue link where competitors get a price, a star rating, a stock state and a
returns line.

Three things made this more than a boilerplate task.

**The base URL was decided in two places.** `app/layout.tsx` read `NEXT_PUBLIC_BASE_URL`
directly and `lib/cashfree-config.ts` read `APP_BASE_URL` with the public variable as its
fallback. A sitemap, a `robots.txt` and every schema `@id` are absolute by definition, so a
third reading of the environment would have been a third opportunity to disagree.

**Google's product vocabulary asks for policy, not just price.** `hasMerchantReturnPolicy`
and `shippingDetails` are the fields that decide whether a result carries a returns and
delivery line. They are also the two fields easiest to lie in. The refund policy at `/refund`
does not offer a blanket seven-day return: personalised and made-to-order pieces are excluded,
and so is pierced jewellery. A `Product` node that told a crawler every piece was returnable
within seven days would contradict a policy page on the same domain.

**The address existed only as display lines.** `config/business.ts` held three strings meant
to be printed one per line. `PostalAddress` wants a locality, a region and a postal code as
separate fields, and recovering them by splitting on commas is parsing our own data back out
of a rendering of it.

## Decision

**One origin, in `lib/site-url.ts`.** `getSiteUrl()` reads `APP_BASE_URL`, falls back to
`NEXT_PUBLIC_BASE_URL`, then to `http://localhost:3000`, and normalises whatever it finds to a
bare origin so a trailing slash in an env file cannot double itself into every `@id`.
`absoluteUrl(path)` builds on it. `app/layout.tsx` now sets `metadataBase` from it, so the one
place a deployment's origin is decided is this file.

There is deliberately no request-origin fallback, which is where this differs from
`resolveAppBaseUrl` in `lib/cashfree-config.ts`. A return URL must be an origin the shopper's
browser can reach, so falling back to the request is right there. A canonical URL must be the
same everywhere, so falling back to the request is wrong here: every preview deployment would
declare itself canonical for the same page.

**A native sitemap and robots, with the logic in `lib/`.** `app/sitemap.ts` and
`app/robots.ts` are three-line Next route files delegating to `buildSitemap()` and
`buildRobots()`. The route files cannot be unit tested; the `lib/` functions can, and the tests
in `lib/sitemap.test.ts` and `lib/robots.test.ts` assert the routes return exactly what those
functions build.

The sitemap covers the eight indexable static routes, all ten category URLs, all 49 products
and the collections that currently hold something. `NON_INDEXABLE_PATHS` is exported from
`lib/sitemap.ts` and consumed by `lib/robots.ts`, so the set the sitemap refuses to publish and
the set `robots.txt` disallows are one list.

`lastModified` is a written-down constant, not the build clock. The catalogue carries no
timestamp — the same absence that makes `sort=newest` a flag rather than a date under ADR-008
— and a date derived from the deploy would tell a crawler that all seventy URLs changed every
time anything shipped.

**Structured data as typed builders in `lib/structured-data.ts`, one `@graph` per page.** The
layout emits `Organization` and `WebSite`; a product page emits `Product` and
`BreadcrumbList`. Nodes cross-reference by `@id`, so the product's `seller` points at the
Organization the layout published rather than repeating it. Every node has a declared
TypeScript interface, which is what makes a missing `priceCurrency` a compile error rather
than a Search Console warning three weeks after launch.

**The return policy states what the refund policy states.** `isReturnable(product)` is false
for a personalised piece and for pierced jewellery, and those products get
`MerchantReturnNotPermitted` with no `merchantReturnDays` at all. Everything else gets
`MerchantReturnFiniteReturnWindow` with `merchantReturnDays` read from `RETURN_WINDOW_DAYS`,
`ReturnByMail`, and `ReturnFeesCustomerResponsibility` — which is the vocabulary's term for
what section 5 of the policy says, that change-of-mind postage is at the buyer's cost.

Personalisation is decided by option *name*, not by the presence of options. Five products
carry an option group; only the two `Letter` rings are made to one buyer's specification. A
ribbon colour and a locket shape are variants that go back on the shelf, and marking them
non-returnable would understate a buyer's rights as badly as marking an engraved ring
returnable would overstate ours.

**Shipping is computed by the function that charges it.** `buildShippingDetailsSchema` calls
`calculateShipping(product.pricing.price)` — the same function `lib/cart.ts` and `lib/order.ts`
use — so the published rate cannot drift from the charged one. An `Offer` describes one item,
so the basis is a single-unit order: today every product is priced under ₹799 and so every
offer publishes ₹99, and a shopper who fills a basket past the threshold pays less than the
schema says, never more. `DefinedRegion` names `IN` and nothing else. Handling is 0–2 days and
transit 1–7, from the same `DISPATCH_BUSINESS_DAYS` and `DELIVERY_BUSINESS_DAYS` the shipping
policy's sentences are built from.

**One breadcrumb array, rendered and published.** `buildProductBreadcrumb` moved to
`lib/breadcrumbs.ts`; the page passes the same array to `<Breadcrumb>` and to
`buildBreadcrumbSchema`. A `BreadcrumbList` disagreeing with the visible trail is the one
structured-data error read as misrepresentation rather than as a missing field.

**The address is stored in parts.** `BUSINESS.address` holds six fields; `lib/config.ts`
derives the printed lines from them and exposes `POSTAL_ADDRESS_CONFIG` in the shape
`PostalAddress` wants. The footer, the two policies that print the address and the schema all
read the same six values, and the printed output is byte-identical to what it was.

**Metadata completeness.** `/contact` was the one indexable page with a partial block — title,
description and canonical, no OpenGraph — so it moved to `buildPageMetadata`. No page had a
Twitter card at all; `twitter` is now restated wherever `openGraph` is, under the same
full-restate rule from ADR-007, because Next replaces a page's `twitter` block rather than
merging it. Product pages carry their own photograph in both cards; every other page carries
the branded default.

## Alternatives considered

**`next-sitemap` or a hand-written `public/sitemap.xml`.** A static file goes stale the moment
a product is added, and the package solves a problem Next 14 solves natively. Rejected.

**Deriving non-returnability from `product.options` being non-empty.** Simpler, and wrong for
three of the five products that carry options. Rejected in favour of matching on
personalisation option names, which is what the policy actually excludes.

**Publishing the free-shipping threshold as a conditional rate.** `ShippingRateSettings` with
`freeShippingThreshold`, or a pair of `OfferShippingDetails` carrying
`eligibleTransactionVolume`, would express "₹99, free over ₹799" exactly. Both are newer
vocabulary with thinner consumer support, and the threshold is a property of a *basket* while
an `Offer` describes an *item*. Publishing the single-item rate is understated rather than
wrong. Revisit if a product is ever priced at or above the threshold, where the current
builder already returns zero.

**A `SearchAction` on the `WebSite` node.** The site has no search endpoint. A
`potentialAction` pointing at a URL that does not resolve is a claim a crawler follows and
finds broken. Omitted.

**`og:type` of `product`.** Next's `OpenGraphType` union has no `product` member, and reaching
past the type to emit it by hand would trade a compile-time guarantee for a property Facebook
deprecated in favour of `og:type=website` plus structured data. Product pages stay `website`.

**A script tag per schema type.** More tags, no benefit; `@graph` keeps `@id` references
resolvable and the payload smaller.

## Consequences

The sitemap and `robots.txt` prerender at build time, so **`APP_BASE_URL` must be set in the
Vercel build environment**, not only at runtime. Set it wrong and every canonical, every
sitemap entry and every schema `@id` points at the wrong host. The dynamic `/shop` route reads
it per request and is the exception.

Three constants are now commitments that need a human to revisit: `OFFER_PRICE_VALID_UNTIL`
(bump when the catalogue is repriced), `CONTENT_LAST_MODIFIED_ISO` (bump when the catalogue or
the page set moves), and `PERSONALISED_OPTION_NAMES` (extend when a new kind of personalisation
is sold). Each is a single line with a JSDoc block saying when to touch it.

Adding a category, a collection or a product adds its sitemap entry with no code change, since
all three are read from the same tables the nav and the shop read.

`gifting` has no tagged product and so has no sitemap entry. It reappears the moment a product
carries the tag. This is checked by a test rather than by remembering.

What this prompt cannot do is confirm Google accepts the result. The tests prove the JSON-LD is
well formed, absolute, and consistent with the policy pages; **a Rich Results run against the
live domain, via the `claude-seo` plugin, is a post-deploy step.** Expect that pass to want
`GTIN`/`MPN` values the catalogue does not have, which are optional but improve eligibility.
