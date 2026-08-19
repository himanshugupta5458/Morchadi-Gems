# ADR-034: SEO audit remediation — fabricated reviews removed, security headers added

- **Status:** Accepted
- **Date:** 2026-08-19
- **Prompt:** 31

## Context

An SEO audit of the site returned findings in four bands. One of them was not an SEO finding
at all — it was a liability.

**The catalogue was publishing reviews nobody wrote.** All 49 products carried a `rating`
(3.5–5.0, 30–150 reviews) and two or three `reviews` with invented reviewer names and invented
review bodies. That data was rendered three ways and emitted a fourth:

1. `aggregateRating` and `review[]` inside the `Product` JSON-LD on every product page
2. a star rating and a "128 reviews" link under every product title
3. a full "Customer Reviews" section with named reviewers and per-review stars
4. a star rating on every product card in the shop grid and both home strips

The home page and the about page also ran a "Customer Speak" band of six store-level
testimonials — invented names, invented quotes, four- and five-star ratings — from
`data/testimonials.json`.

Google's [spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
treat review markup that does not correspond to genuine, verifiable reviews as a structured
data violation. The penalty is not a lost rich result: it is a manual action, and the ones
issued for review spam are frequently site-wide rather than scoped to the offending pages. A
site-wide manual action on a store with no organic history is close to a reset. India's
consumer-protection rules on fake reviews (BIS IS 19000:2022, and the CCPA guidelines behind
it) reach the visible testimonials as well as the markup.

The remaining findings were ordinary: no security headers on any response, zero-result facet
pages indexable as thin pages, no `Store`/`LocalBusiness` node, `og:type` saying `website` on
pages that sell things, no `ItemList` on listing pages, a 159KB PNG share card, canonicals
that varied with `?sort=`, and a `priceValidUntil` hardcoded to `2027-12-31`.

## Decision

### 1. Every fabricated review is deleted, not hidden

`rating` and `reviews` are gone from `data/products.json` (49 ratings, 147 review objects), from
the `Product` type, from `ProductSchema`, and from every component that rendered them.
`data/testimonials.json` and the `Testimonial` type are deleted too.

Deleted rather than retained-but-unrendered. A field that exists is a field something will
read again: the next person to add a "Top rated" sort or a rating badge would find the data
sitting there looking authoritative, with nothing in the record saying it was invented. The
validator now *fails* a product that carries either key, so the absence is enforced rather than
merely current.

These components are deleted with it: `StarRating`, `ProductReviews`, `TestimonialBand`,
`TestimonialCard`, `TestimonialCarousel`, and `Monogram` (which existed only to give a reviewer
an avatar). `getInitials` in `lib/format.ts` and the `amber` colour token — reserved in
[ADR-004](ADR-004-design-system.md) for star fill and nothing else — go with them.

Two things follow from the data being gone rather than merely unrendered:

- **The "Top rated" sort is retired.** A sort control is a claim that the data behind it
  exists. `SortSlug` is now `newest | price-asc | price-desc`; `?sort=rating-desc` falls back to
  the default rather than erroring.
- **"Newest" breaks ties on `flags.featured` instead of `rating.average`.** The catalogue still
  has no timestamp ([ADR-008](ADR-008-shop-architecture.md)), and featured is the other field
  that records which pieces the owner is pushing.

### 2. The store-level testimonials are removed rather than relabelled

The alternative on the table was to keep the band, drop the star counts, and frame it as
illustrative. That was rejected: the problem is not the stars, it is six invented people saying
things they never said. A "sample" label under a named quote on a live storefront does not
make the quote true — it makes the store look like it is disclosing something it should not be
doing. The band comes back when the owner has real quotes with real attribution.

The home page now closes on the Morchadi Promise trust strip; the about page closes on its
call to action. Both read as composed sections rather than as a page missing its last band.

### 3. What goes back when real reviews exist

Reviews return only with: the reviewer's own words, a real name or an initial they consented
to, a `datePublished` per review, a genuine distribution (a four means a four, not a rounding
of five), and a real `reviewCount`. At that point `aggregateRating` and `review[]` come back
into `ProductSchema`, `validateNoFabricatedReception` in `scripts/validate-products.mjs`
becomes the shape checks it replaced, and `lib/no-fabricated-reviews.test.tsx` is rewritten
rather than deleted — the test that says "no fake reviews" becomes the test that says "reviews
match the collected data".

### 4. Security headers on every response

`next.config.mjs` gains a `headers()` block sending six headers on `/:path*`, defined in
`config/security-headers.mjs`:

| Header | Value |
| --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | see below |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

`poweredByHeader: false` also goes on, so responses stop naming the framework.

The policy module is plain `.mjs` rather than TypeScript because Next 14 cannot load a
TypeScript config, and a separate module rather than a literal inside the config so
`lib/security-headers.test.ts` can assert it without booting Next.

**The CSP, and why each Cashfree allowance is there.** The audit's own suggestion was a
permissive policy if a strict one risked the checkout. A strict one did not, because the
integration's network surface is small and was verified rather than guessed:

```
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self';
form-action 'self' <cashfree>; script-src 'self' 'unsafe-inline' <cashfree>;
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;
connect-src 'self' <cashfree>; frame-src 'self' <cashfree>; worker-src 'self' blob:;
manifest-src 'self'; upgrade-insecure-requests
```

where `<cashfree>` is exactly five origins: `sdk.cashfree.com`, `payments.cashfree.com`,
`payments-test.cashfree.com`, `api.cashfree.com`, `sandbox.cashfree.com`. No wildcard, and no
`http:` anywhere.

- `script-src` needs `sdk.cashfree.com` because `@cashfreepayments/cashfree-js` is a 4.6KB
  loader, not the SDK: `load()` injects a `<script>` pointing at
  `sdk.cashfree.com/js/v3/cashfree.js`. Without that host the pay button fails silently.
- `form-action` and `frame-src` cover how the real SDK hands the browser over. Reading the
  live `cashfree.js`: it uses `location.href` (a top-level navigation, which no CSP directive
  governs), a `createElement("form")` plus `.submit()` (which `form-action` governs), and
  iframes (which `frame-src` governs). All three are allowed to the five origins.
- `connect-src` carries both `api.cashfree.com` and `sandbox.cashfree.com` because the SDK
  talks to whichever matches its mode, and the mode is decided by `CASHFREE_ENV` at runtime.
- Every host the live SDK references was enumerated from the fetched file. The production set
  is the five above. It also mentions `qa.cashfree.net` and `regression.qa.cashfree.net`
  (Cashfree's internal environments, unreachable from `sandbox` or `production` mode),
  `www.cashfree.com` (a link, not a subresource) and `www.w3.org` (the SVG namespace) — none of
  which needs an allowance.

**Both `'unsafe-inline'` allowances are Next's, not ours.** Next serves an inline bootstrap
script on every page and inlines critical CSS and `next/font` faces. The supported way to
allow those precisely is a per-request nonce — and a nonce must be generated per response,
which turns all 49 statically prerendered product pages into dynamic renders. That trade was
not worth it on a site with no user-generated content and no third-party script surface beyond
Cashfree. The directive still does its real job here, which is bounding *where* code and
connections may come from.

`'unsafe-eval'` is added in development only, for the dev server's React Refresh runtime. The
production bundle needs none — confirmed against the fetched SDK, which contains no `eval(`,
no `new Function` and no `new Worker`.

`img-src` needs no remote host: every photograph is local. `font-src` needs no Google host:
`next/font/google` downloads the faces at build time and serves them from this origin.

### 5. A zero-result facet is `noindex, follow`

`/shop` emits `robots: { index: false, follow: true }` when the filter combination matches
nothing — today, `?collection=gifting`, which is a real collection with no product tagged into
it. The page still renders its empty state and its way out for a shopper; it just stops being a
thin page a crawler spends budget on and a searcher lands on to find nothing. `follow` stays on
so the links out of it are still crawled. No `ItemList` is emitted for such a page either: an
empty list is not a smaller list, it is a claim about a collection with no members.

### 6. `OnlineStore` + `LocalBusiness`, as one node beside the Organization

A new node at `/#store`, in the site-wide graph next to `Organization` and `WebSite`, carrying
`address`, `geo`, `openingHoursSpecification`, `priceRange`, `telephone`, `email`,
`currenciesAccepted`, `paymentAccepted`, `areaServed`, `sameAs`, and a `parentOrganization`
reference back to `/#organization`.

**Why two types on one node.** `Store` alone implies retail premises a shopper can walk into,
which this business does not have — that would be exactly the kind of unverifiable claim
[ADR-018](ADR-018-honest-product-description.md) rules out. `OnlineStore` alone is a subtype of
`Organization`, and `geo` and `priceRange` are `LocalBusiness` properties that would be
invented ones on it. Both types together are literally true: a real business at a Jaipur
address whose only counter is this website. Multi-typing is valid JSON-LD.

**Every value is a fact already in the repository.** The address comes from
`BUSINESS.address`; the hours come from a new `BUSINESS.businessHours`, from which
`CONTACT_CONFIG.hours` is now *derived*, so the sentence the contact page prints and the
`OpeningHoursSpecification` a crawler reads cannot drift; `priceRange` is computed from the
real catalogue (`₹49 – ₹499` today) rather than written down. The one approximation is
`BUSINESS.geoCoordinates` — the Mansarovar locality to four decimal places, flagged in its own
doc comment as a value to replace with the pin from the Google Business Profile.

**`sameAs` is config-driven and empty.** It reads `BUSINESS.socialProfileUrls`, which is `[]`
until the owner has accounts to name. Empty is the honest state: it claims nothing. Populating
it is pasting URLs into that one array — both the Organization and the store node read it.

### 7. The remaining schema and metadata fixes

- **`og:type`.** Product pages declare `product` instead of `website`. Next 14's typed
  `openGraph.type` accepts a fixed union that does not include `product`, and passing an
  unlisted value *throws at render*. So the page omits `openGraph.type` and states it through
  `metadata.other`, which Next writes as `name="og:type"` where Open Graph asks for
  `property="og:type"`. Lenient parsers read it; strict ones read no `og:type`, which is where
  the page already was rather than somewhere worse. Nothing a search engine needs rides on it —
  the `Product` JSON-LD is what says this page sells a thing. Revisit when Next's union grows
  or an escape hatch for raw head tags exists.
- **`ItemList` + `CollectionPage`** on `/shop` and every filtered listing: the products
  actually shown, by name and absolute URL, with positions numbered from where the page starts
  in the whole result set (page two starts at thirteen) and `numberOfItems` reporting the full
  match count.
- **Every product photograph in `image[]`.** Already the case before this prompt —
  `collectProductImages` merges `media.images` with `media.variantImages` and de-duplicates.
  Verified, not changed.
- **The share card is WebP.** `public/og/default.webp` at 24.7KB replaces a 158.8KB PNG at the
  same 1200×630, generated by `npm run generate:brand-assets` at quality 90.
  `SITE_CONFIG.ogImage` states `type: "image/webp"`.
- **Canonicals drop a non-default `sort`.** `buildCanonicalShopHref` strips it, so
  `/shop?category=rings&sort=price-asc` declares `/shop?category=rings`. Filters and page number
  are *not* stripped: each of those genuinely selects a different set of products, and folding
  them together would point a crawler at a page that does not contain what it just read.
- **`priceValidUntil` is derived.** `getOfferPriceValidUntil()` returns the build date plus one
  year instead of the literal `2027-12-31`, which was correct once and then decayed silently.

## Alternatives considered

**Keep the review data, stop emitting the schema.** Rejected. It removes the manual-action
exposure and leaves the fabricated stars and the fabricated reviewers on screen, which is the
part a shopper is actually deceived by — and it leaves the data one commit away from being
emitted again.

**Keep the testimonial band with a "sample" label.** Rejected; see decision 3.

**Keep an empty `reviews: []` and `rating: { average: 0, count: 0 }` on every product.**
Rejected. `count: 0` is a fact nobody needs stated 49 times, and it re-opens the question of
what a zero rating renders as. Absence says the same thing and cannot be rendered wrong.

**A nonce-based CSP with no `'unsafe-inline'`.** Rejected for now; see decision 4. It costs
static prerendering of all 49 product pages to close a hole this site has no obvious way to
be exploited through.

**`Store` or `LocalBusiness` alone for the store node.** Rejected; see decision 6.

**Noindex every `?sort=` URL instead of canonicalising it.** Rejected. Canonicalisation
consolidates the signals onto one URL; noindex throws them away.

**Leave the OG card as PNG.** Considered, and worth stating as a real trade: some link
unfurlers — WhatsApp in particular, which matters for an Indian storefront with a WhatsApp
button — have historically been unreliable with WebP OG images, where every one of them
handles PNG. The audit asked for the conversion and 134KB is a real saving on a file every
crawler fetches, so it ships as WebP with `type` declared. If share previews are seen to break
in WhatsApp, the fix is one line in `scripts/generate-brand-assets.mjs` and one in
`SITE_CONFIG.ogImage`.

## Consequences

**Easier.** The site now makes no claim it cannot substantiate — the honest-content principle
of [ADR-018](ADR-018-honest-product-description.md) and
[ADR-021](ADR-021-all-real-catalogue.md) now covers reception as well as description and
stock. The catalogue record is smaller and the client bundle no longer carries a star
renderer. Business facts stay in one file: hours, coordinates and social profiles are all
`config/business.ts` edits with no code change.

**Harder.** The store has no social proof on any page, which costs conversion — that is the
price of not having collected any yet, not a cost this change introduced. Anyone re-adding
reviews has to satisfy the validator, the schema builder and
`lib/no-fabricated-reviews.test.tsx`, which is the intent.

**What would force a revisit.** Real reviews arriving (decision 3). Next gaining `product` in
its Open Graph union, or a raw-head-tag escape hatch (decision 7). A third-party script — an
analytics tag, a chat widget, a pixel — being added: it will be blocked by `script-src` and
`connect-src` until its origins are added to `config/security-headers.mjs`, which is the
policy working, not failing.

**Still owner work, and not code.** Populate `BUSINESS.socialProfileUrls` once the Instagram
and Facebook accounts exist. Confirm TLS terminates on the `www` host before submitting the
domain to the HSTS preload list, since `includeSubDomains; preload` is close to irreversible.
Expand the thin page descriptions the audit flagged. Create the Google Business Profile, and
replace `BUSINESS.geoCoordinates` with its pin. Start collecting real reviews.
