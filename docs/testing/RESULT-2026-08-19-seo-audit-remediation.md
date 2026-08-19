# Test Result: SEO audit remediation — 2026-08-19

- **Plan:** [PLAN-seo-audit-remediation.md](PLAN-seo-audit-remediation.md)
- **Commit:** working tree on `4e4cb16`
- **Environment:** local, Node 24, `npm run build` + `npx next start` on port 3111.
  Cashfree not transacted against — the SDK was fetched and read, not run.

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | No `"rating"` in the file; no product has the property |
| TC-02 | Pass | No `"reviews"` in the file; 49 ratings and 147 review objects removed |
| TC-03 | Pass | Reintroduced `rating` on P001 → exit 1, two failures (the explicit check and the unknown-key check) |
| TC-04 | Pass | Reintroduced `reviews` on P002 → exit 1, same pair. Catalogue restored, re-validated green |
| TC-05 | Pass | `data/testimonials.json` deleted |
| TC-06 | Pass | 49/49 schemas have no `aggregateRating` |
| TC-07 | Pass | 49/49 schemas have no `review` |
| TC-08 | Pass | Five review strings absent from all 49 serialised graphs |
| TC-09 | Pass | Same, in the rendered `ld+json` script |
| TC-10 | Pass | Site-wide graph clean |
| TC-11 | Pass | `name`, `sku`, `brand`, `offers`, `image[]`, `additionalProperty` all intact |
| TC-12 | Pass | No `role="img"` on a rendered card; no "review" text |
| TC-13 | Pass | Zero references across every `.ts`/`.tsx` in `app/` and `components/` |
| TC-14 | Pass | `/product/P001`: 0 occurrences each of `aggregateRating`, `AggregateRating`, `"review"`, `"@type":"Review"`, `"@type":"Rating"`, `Customer Reviews`, `reviews` |
| TC-15 | Pass | `/`: 0 occurrences of "Customer Speak" and of all six testimonial names |
| TC-16 | Pass | `/about`: same. Its only "Customer" is the 10,000+ milestone stat from `config/business.ts` |
| TC-17 | Pass | 200; related products follow the buy panel on its own `border-t` with the section spacing the reviews block used |
| TC-18 | Pass | `rating-desc` in neither `SORT_OPTIONS` nor `isSortSlug` |
| TC-19 | Pass | Falls back to `newest` |
| TC-20 | Pass | Featured precedes non-featured within an `isNew` group, then id ascends |
| TC-21 | Pass | Identical id sets across all three sorts |
| TC-22 | Pass | Exactly the six, in order |
| TC-23 | Pass | `max-age=63072000; includeSubDomains; preload` |
| TC-24 | Pass | `nosniff`, `SAMEORIGIN`, `frame-ancestors 'self'` — the two framing headers agree |
| TC-25 | Pass | `strict-origin-when-cross-origin` |
| TC-26 | Pass | All three empty allowlists |
| TC-27 | Pass | `default-src 'self'`, `object-src 'none'`, `base-uri 'self'` |
| TC-28 | Pass | No `*` and no `http://` in either mode |
| TC-29 | Pass | `'unsafe-eval'` in development only |
| TC-30 | Pass | All six on `/product/P001`; `X-Powered-By` gone (`poweredByHeader: false`) |
| TC-31 | Pass | `script-src` includes `https://sdk.cashfree.com` |
| TC-32 | Pass | `form-action` and `frame-src` both include `payments.cashfree.com` and `payments-test.cashfree.com` |
| TC-33 | Pass | `connect-src` includes both `api.cashfree.com` and `sandbox.cashfree.com` |
| TC-34 | Pass | See "SDK verification" below |
| TC-35 | Pass | No `eval(`, `new Function` or `new Worker` in the 66KB SDK |
| TC-36 | Pass | `location.href` ×2, `createElement("form")` + `.submit()`, `createElement("iframe")` ×4 — each covered or ungoverned |
| TC-37 | Pass | 13/13 routes 200 with expected content type |
| TC-38 | Pass | `?collection=gifting` → `total: 0` |
| TC-39 | Pass | `robots: { index: false, follow: true }` |
| TC-40 | Pass | `follow: true` |
| TC-41 | Pass | Title "Gifting", description mentions gifting |
| TC-42 | Pass | `robots` undefined for `/shop`, `?category=rings` and `?page=2` |
| TC-43 | Pass | `<meta name="robots" content="noindex, follow">`; 0 `ItemList` blocks |
| TC-44 | Pass | `["OnlineStore","LocalBusiness"]` at `/#store` |
| TC-45 | Pass | `parentOrganization` → `/#organization` |
| TC-46 | Pass | Address identical to the Organization's; `geo` 26.8505, 75.7628 |
| TC-47 | Pass | Mon–Sat 10:00–18:00 in the schema and in `CONTACT_CONFIG.hours`, both derived from `BUSINESS.businessHours` |
| TC-48 | Pass | `₹49 – ₹499`, the real catalogue min and max |
| TC-49 | Pass | Support email, `+91 9358358834`, `INR`, `IN` |
| TC-50 | Pass | `[]`, equal to `BUSINESS.socialProfileUrls` and to the Organization's `sameAs` |
| TC-51 | Pass | Organization, store, WebSite |
| TC-52 | Pass | `other` is `{ "og:type": "product" }` |
| TC-53 | Pass | `openGraph` has no `type` |
| TC-54 | Pass | `siteName`, `url`, one image |
| TC-55 | Pass | Exactly one `og:type` meta, content `product` — see the caveat below |
| TC-56 | Pass | `CollectionPage` + `ItemList`, `mainEntity` → `#itemlist` |
| TC-57 | Pass | `isPartOf` → `/#website` |
| TC-58 | Pass | One `ListItem` per shown product, absolute URLs |
| TC-59 | Pass | Positions 13, 14, 15 |
| TC-60 | Pass | `"numberOfItems":18` against "of 18 pieces" on screen |
| TC-61 | Pass | Absolute, de-duplicated, variant images included (unchanged behaviour, verified) |
| TC-62 | Pass | `/shop?category=rings&sort=price-asc&page=2` → `/shop?category=rings&page=2` |
| TC-63 | Pass | All three sorts of one filter state collapse to `/shop?category=rings` |
| TC-64 | Pass | Canonical and `og:url` both the stripped URL |
| TC-65 | Pass | Served `<link rel="canonical">` carries no `sort` |
| TC-66 | Pass | 2026-08-19 → 2027-08-19; 2030-01-01 → 2031-01-01 |
| TC-67 | Pass | Later than now |
| TC-68 | Pass | Offer reads the derived value |
| TC-69 | Pass | 1200×630 WebP, 24,732 bytes against the PNG's 158,807 — an 84% reduction |
| TC-70 | Pass | 200 `image/webp` |

## SDK verification (TC-34)

`https://sdk.cashfree.com/js/v3/cashfree.js` was fetched (66,572 bytes) and every host it
names was enumerated:

| Host | In the policy? | Why |
| --- | --- | --- |
| `sdk.cashfree.com` | Yes | The SDK itself |
| `payments.cashfree.com` | Yes | Production hosted checkout |
| `payments-test.cashfree.com` | Yes | Sandbox hosted checkout |
| `api.cashfree.com` | Yes | Production API |
| `sandbox.cashfree.com` | Yes | Sandbox API |
| `qa.cashfree.net`, `regression.qa.cashfree.net` | No | Cashfree's internal environments, unreachable from `sandbox` or `production` mode |
| `www.cashfree.com` | No | A link, not a subresource |
| `www.w3.org` | No | The SVG namespace, not a fetch |
| `example.com`, `no.hostname.com` | No | Placeholders in the SDK's own defaults |

## Failures

None.

## Caveats, not failures

**TC-55 — the `og:type` attribute.** The tag is emitted as `<meta name="og:type" ...>` rather
than `<meta property="og:type" ...>`. Next 14's typed `openGraph.type` accepts a fixed union
that excludes `product` and *throws at render* on anything outside it, so the value is stated
through `metadata.other`, which Next always writes with `name`. Lenient parsers read it;
strict ones read no `og:type`, which is where the page already was. Reasoning and the
conditions for revisiting are in
[ADR-034](../decisions/ADR-034-seo-audit-remediation.md).

**The checkout was not transacted.** CSP compatibility was established by reading the SDK
rather than by paying with a sandbox card — TC-34 to TC-36 identify every host it contacts and
every mechanism it redirects by, and each is covered by an explicit directive. A sandbox
payment end to end remains the stronger check and belongs to
[PLAN-order-pricing.md](PLAN-order-pricing.md).

**The `noindex` case is data-dependent.** `?collection=gifting` is empty because no product
carries the `gifting` tag. If one ever does, TC-38 to TC-43 need repointing at whatever
combination is empty then; TC-38 exists to fail loudly at that moment rather than let the
other five pass vacuously.

## Gate

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass — no warnings or errors |
| `npm run test:run` | Pass — 735/735 across 36 files |
| `npm run validate:products` | Pass — 49 products; the nine pre-existing discount advisories are unchanged |
| `npm run build` | Pass — 70 static pages, no warnings |

## Summary

70 passed, 0 failed, 0 skipped. Suite grew from 702 to 735. Shippable.
