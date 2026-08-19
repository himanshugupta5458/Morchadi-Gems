# Test Plan: SEO audit remediation

- **Scope:** the four bands of change made in
  [ADR-034](../decisions/ADR-034-seo-audit-remediation.md) — the removal of every fabricated
  review and rating, the six security headers, the zero-result `noindex`, and the schema and
  metadata fixes (store node, `ItemList`, `og:type`, canonical, `priceValidUntil`, WebP share
  card). **Not covered:** whether Cashfree actually charges a card, which is
  [PLAN-order-pricing.md](PLAN-order-pricing.md) and a sandbox transaction; and whether Google
  lifts or issues a manual action, which no test can assert.
- **Prerequisites:** none for the automated cases. The manual cases need
  `npm run build && npx next start` and, for TC-31 to TC-33, network access to
  `sdk.cashfree.com`.

## Cases

### Fabricated reviews — the data

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | The catalogue carries no rating | Scan `data/products.json` as text and as parsed records | No `"rating"` key anywhere; no product has the property | Automated |
| TC-02 | The catalogue carries no reviews | As TC-01 for `"reviews"` | No `"reviews"` key anywhere | Automated |
| TC-03 | A reintroduced rating fails the gate | Add `rating` to one record, run `npm run validate:products` | Exit 1 naming the product | Manual |
| TC-04 | A reintroduced review fails the gate | As TC-03 with `reviews` | Exit 1 naming the product | Manual |
| TC-05 | The testimonial data file is gone | Read `data/testimonials.json` | Throws — no such file | Automated |

### Fabricated reviews — the schema

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-06 | No `aggregateRating` on any product schema | `buildProductSchema` for all 49 | Property absent on every one | Automated |
| TC-07 | No `review` on any product schema | As TC-06 | Property absent on every one | Automated |
| TC-08 | No review vocabulary in a serialised product graph | Serialise `buildProductSchemaGraph` for all 49 | No `aggregateRating`, `AggregateRating`, `"review"`, `"@type":"Review"`, `"@type":"Rating"` | Automated |
| TC-09 | No review vocabulary in the rendered `ld+json` block | Render `JsonLd` for all 49 product graphs | Same five strings absent from the emitted script | Automated |
| TC-10 | No review vocabulary in the site-wide graph | Render `JsonLd` for `buildSiteSchemaGraph()` | Same strings absent | Automated |
| TC-11 | The rest of the Product schema survives | `buildProductSchema("P001")` | `name`, `sku`, `brand`, `offers`, `image[]`, `additionalProperty` all present and unchanged | Automated |

### Fabricated reviews — the UI

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-12 | No card carries a star row | Render `ProductCard` | No `role="img"` element; no "review" text; the name still renders | Automated |
| TC-13 | No route or component imports a removed module | Scan every `.ts`/`.tsx` under `app/` and `components/` | No reference to `StarRating`, `ProductReviews`, `TestimonialBand`, `TestimonialCard`, `TestimonialCarousel`, `Monogram`, `getTestimonials` | Automated |
| TC-14 | The product page has no reviews section | Fetch `/product/P001` from a production server | No "Customer Reviews", no "reviews", no fabricated reviewer name | Manual |
| TC-15 | The home page has no testimonial band | Fetch `/` | No "Customer Speak"; no fabricated name | Manual |
| TC-16 | The about page has no testimonial band | Fetch `/about` | No "Customer Love"; no fabricated name | Manual |
| TC-17 | The product page reflows cleanly | Fetch `/product/P001` | 200, related-products section follows the buy panel with its own border and spacing | Manual |

### Fabricated reviews — the fallout

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-18 | The rating sort is retired | Read `SORT_OPTIONS` and `isSortSlug` | `rating-desc` in neither | Automated |
| TC-19 | An old rating-sort URL still resolves | `getShopResults({ sort: "rating-desc" })` | Falls back to `newest`, does not throw | Automated |
| TC-20 | Newest breaks ties on the featured flag | Walk every page under `sort=newest` | Within an `isNew` group, featured precedes non-featured, then id ascends | Automated |
| TC-21 | Every sort returns the same set | Compare id sets across `SORT_OPTIONS` | Identical, only reordered | Automated |

### Security headers

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-22 | All six headers are built | `buildSecurityHeaders()` | Exactly CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` | Automated |
| TC-23 | HSTS is two years, subdomains, preload | Read the value | `max-age=63072000; includeSubDomains; preload` | Automated |
| TC-24 | Framing and sniffing are refused | Read the values | `nosniff`, `SAMEORIGIN`, and `frame-ancestors 'self'` agreeing | Automated |
| TC-25 | The referrer leaks origin, not path | Read the value | `strict-origin-when-cross-origin` | Automated |
| TC-26 | Three capabilities are disabled | Read `Permissions-Policy` | `camera=()`, `microphone=()`, `geolocation=()` | Automated |
| TC-27 | The policy is closed by default | Read the CSP | `default-src 'self'`, `object-src 'none'`, `base-uri 'self'` | Automated |
| TC-28 | No wildcard and no plaintext origin | Read the CSP in both modes | No `*`, no `http://` | Automated |
| TC-29 | `unsafe-eval` is development-only | Build the CSP with each flag | Present in dev, absent in production | Automated |
| TC-30 | Headers reach a real response | `curl -I` a product page on a production server | All six present; no `X-Powered-By` | Manual |

### Security headers — Cashfree compatibility

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-31 | The SDK host is a script source | Read `script-src` | Contains `https://sdk.cashfree.com` | Automated |
| TC-32 | The hosted checkout can be navigated to | Read `form-action` and `frame-src` | Both contain `payments.cashfree.com` and `payments-test.cashfree.com` | Automated |
| TC-33 | Both API modes can be reached | Read `connect-src` | Contains `api.cashfree.com` and `sandbox.cashfree.com` | Automated |
| TC-34 | The live SDK needs nothing else | Fetch `sdk.cashfree.com/js/v3/cashfree.js`, enumerate every host it names | Only the five allowed origins, plus Cashfree's unreachable QA hosts, a marketing link and the SVG namespace | Manual |
| TC-35 | The live SDK needs no `unsafe-eval` | Scan the fetched SDK | No `eval(`, no `new Function`, no `new Worker` | Manual |
| TC-36 | The redirect mechanisms are all covered | Scan the fetched SDK | Uses `location.href` (ungoverned), form `.submit()` (`form-action`), iframes (`frame-src`) — all allowed | Manual |
| TC-37 | Every route still serves | Request all 13 public routes under the headers | 200 with the expected content type | Manual |

### Zero-result facets

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-38 | The empty facet is genuinely empty | `getShopResults({ collection: "gifting" })` | `total === 0` | Automated |
| TC-39 | An empty facet is noindexed | `generateMetadata` for it | `robots: { index: false, follow: true }` | Automated |
| TC-40 | It stays crawlable outward | As TC-39 | `follow: true` | Automated |
| TC-41 | It still renders for a shopper | As TC-39 | Its own title and description | Automated |
| TC-42 | A populated facet is untouched | `generateMetadata` for `/shop`, `?category=rings`, `?page=2` | No `robots` key at all | Automated |
| TC-43 | No `ItemList` on an empty facet | Fetch `/shop?collection=gifting` | No `ItemList` in the HTML; `noindex, follow` meta present | Manual |

### Store schema

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-44 | The node is both types, at its own id | `buildOnlineStoreSchema()` | `["OnlineStore","LocalBusiness"]` at `/#store`, distinct from `/#organization` | Automated |
| TC-45 | It hangs off the Organization | As TC-44 | `parentOrganization` references `/#organization` | Automated |
| TC-46 | It carries address and coordinates | As TC-44 | Address equal to the Organization's; `geo` inside the Jaipur bounding box | Automated |
| TC-47 | Hours match the contact page | As TC-44 | `OpeningHoursSpecification` days/opens/closes equal `OPENING_HOURS_CONFIG`, and `CONTACT_CONFIG.hours` contains both times | Automated |
| TC-48 | Price range spans the real catalogue | As TC-44 | Contains the formatted min and max catalogue price | Automated |
| TC-49 | Contact and currency are stated | As TC-44 | Support email, phone, `INR`, `IN` | Automated |
| TC-50 | `sameAs` is config-driven and empty | As TC-44 | Equal to `BUSINESS.socialProfileUrls`, and equal to the Organization's | Automated |
| TC-51 | It ships in the site-wide graph | `buildSiteSchemaGraph()` | Three nodes: Organization, the store, WebSite | Automated |

### Schema, OG and canonical fixes

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-52 | A product page says `og:type: product` | `generateMetadata` for a product | `other` is `{ "og:type": "product" }` | Automated |
| TC-53 | It does not also say `website` | As TC-52 | `openGraph` has no `type` | Automated |
| TC-54 | The rest of the OG block survives | As TC-52 | `siteName`, `url`, one image | Automated |
| TC-55 | Exactly one `og:type` is emitted | Fetch `/product/P001` | One `og:type` meta, content `product` | Manual |
| TC-56 | `CollectionPage` pairs with `ItemList` | `buildCollectionPageSchemaGraph` | Two nodes; `mainEntity` points at the list's `@id` | Automated |
| TC-57 | The list belongs to the WebSite | As TC-56 | `isPartOf` references `/#website` | Automated |
| TC-58 | Each shown product is listed | As TC-56 | One `ListItem` per product, by name and absolute URL | Automated |
| TC-59 | Positions are absolute, not per page | As TC-56 with `rangeStart: 13` | Positions 13, 14, 15 | Automated |
| TC-60 | A real listing emits it | Fetch `/shop?category=rings` | `CollectionPage` + `ItemList`, `numberOfItems` equal to the match count | Manual |
| TC-61 | Every photograph is in `image[]` | `buildProductSchema` for all 49 | Absolute, de-duplicated, variant images included | Automated |
| TC-62 | Canonical drops a non-default sort | `buildCanonicalShopHref` on a sorted query | Sort stripped, filters and page kept | Automated |
| TC-63 | Every sort collapses to one canonical | Build canonicals for each `SORT_OPTIONS` entry of one filter state | One distinct URL | Automated |
| TC-64 | The page declares that canonical | `generateMetadata({ category: "rings", sort: "price-asc" })` | Canonical and `og:url` both `/shop?category=rings` | Automated |
| TC-65 | And in the served HTML | Fetch `/shop?category=rings&sort=price-asc` | `<link rel="canonical">` without the sort param | Manual |
| TC-66 | `priceValidUntil` is derived | `getOfferPriceValidUntil` on two fixed dates | Exactly one year later each time | Automated |
| TC-67 | It is always in the future | Call with no argument | Parses to later than now | Automated |
| TC-68 | The offer uses it | `buildOfferSchema` | `priceValidUntil` equals the derived value | Automated |
| TC-69 | The share card is WebP at the right size | Inspect `public/og/default.webp` and `SITE_CONFIG.ogImage` | 1200×630, `image/webp`, materially smaller than the PNG it replaced | Manual |
| TC-70 | It is served correctly | Fetch `/og/default.webp` | 200 `image/webp` | Manual |

## Gate

The full gate must be green: `npm run typecheck`, `npm run lint`, `npm run test:run`,
`npm run validate:products`, `npm run build`.
