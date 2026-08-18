# Test plan — SEO foundations

## Scope

The sitemap, `robots.txt` and the JSON-LD structured data added in prompt 29, plus the base-URL
resolution all three depend on. See
[ADR-029](../decisions/ADR-029-seo-foundations.md).

Out of scope: whether Google's Rich Results tool accepts the output. That runs against a live
URL after deploy and is noted as a follow-up rather than tested here.

## What is being protected

Three classes of failure, in order of how expensive they are to discover late.

**A false claim.** Structured data is machine-readable copy. A `Product` node saying a
personalised ring is returnable within seven days contradicts `/refund` on the same domain, and
a shipping rate that does not match what checkout charges is worse than publishing no rate at
all. These assertions read from the same constants the policy pages and the cart read, so a
test fails if the two are ever changed apart.

**A wrong origin.** Every canonical, sitemap entry and schema `@id` is absolute. One relative
URL, or one URL built against the wrong host, is invisible in review and wrong on every page.

**A gap in coverage.** A product missing from the sitemap is never crawled; a checkout step
present in it is crawled and should not be.

## Cases

### `lib/structured-data.test.ts`

| Area | Case |
| --- | --- |
| Organization | Brand name, legal name, absolute `@id`, absolute logo and share image |
| Organization | Postal address as locality, region, postal code and country, not as printed lines |
| Organization | One support contact point, area served `IN` |
| Organization | `sameAs` is empty, because no social profile is configured |
| WebSite | `publisher` references the Organization `@id`; no `SearchAction` is emitted |
| Offer | Price is `pricing.price`; `mrp` appears nowhere in the serialised offer |
| Offer | `INR`; `InStock` for a stocked piece, `OutOfStock` for a sold-out one |
| Offer | `NewCondition`, a `priceValidUntil` in the future, `seller` by reference |
| Offer | Absolute `url` and `@id` |
| Return policy | Seven days, `ReturnByMail`, `ReturnFeesCustomerResponsibility` on a returnable piece |
| Return policy | `MerchantReturnNotPermitted` and **no** `merchantReturnDays` on a `Letter` ring |
| Return policy | `MerchantReturnNotPermitted` on earrings and nose pins, matching the hygiene exclusion |
| Return policy | A colour or shape choice stays returnable — a variant is not made to order |
| Return policy | `applicableCountry` `IN` and a link to `/refund` on all 49 products |
| Shipping | ₹99 on every product, and the assertion that none is priced past the threshold alone |
| Shipping | ₹0 for a piece priced at the threshold |
| Shipping | `DefinedRegion` `IN` on all 49 |
| Shipping | Handling max 2 days and transit max 7, tied to the policy sentences |
| Product | SKU is the P-code; brand, category label, name, description |
| Product | Every gallery image absolute, de-duplicated, variant photographs included |
| Product | `aggregateRating` and `review` present on all 49; author, rating and body per review |
| Product | Specs published as `additionalProperty` |
| Product | All 49 graphs round-trip through `JSON.parse(JSON.stringify(…))` unchanged |
| Product | No relative value under `url`, `item`, `@id` or `merchantReturnLink` in any graph |
| BreadcrumbList | Four steps in visible order, positions 1 to 4, absolute links, no `item` on the last |
| Base URL | `APP_BASE_URL` wins over `NEXT_PUBLIC_BASE_URL`; the public one is the fallback |
| Base URL | A trailing slash is stripped rather than doubled into every id |

### `lib/sitemap.test.ts`

| Area | Case |
| --- | --- |
| Route | `app/sitemap.ts` returns exactly what `buildSitemap()` builds |
| Coverage | The eight indexable static routes |
| Coverage | All 49 products, one entry each |
| Coverage | All ten categories |
| Coverage | Only the collections that currently hold a product |
| Exclusion | No cart, address, payment, order-confirmation or style-guide URL |
| Exclusion | No `/api/` URL |
| Form | Every URL absolute against the configured origin; no duplicates |
| Form | Priorities ordered home > shop > product > about > policy; all in `(0, 1]` |
| Form | Valid `changeFrequency` and an ISO `lastModified` on every entry |
| Form | Policies dated from `LEGAL_CONFIG`, everything else from the content constant |

### `lib/robots.test.ts`

| Area | Case |
| --- | --- |
| Route | `app/robots.ts` returns exactly what `buildRobots()` builds |
| Rules | `User-Agent: *`, `Allow: /` |
| Rules | Disallows cart, all three checkout steps, the style guide and `/api/` |
| Rules | The disallow list equals the sitemap's exclusion list plus `/api/` |
| Rules | Disallows nothing a shopper is meant to find |
| Rules | Absolute sitemap URL |

### `lib/json-ld.test.tsx`

| Area | Case |
| --- | --- |
| Emission | `type="application/ld+json"` |
| Well-formedness | The site graph and all 49 product graphs parse back to the object rendered |
| Escaping | A product name containing `</script><img …>` cannot close the tag or inject an element, and still parses back to the original string |

## How to run

```
npx vitest run lib/structured-data.test.ts lib/sitemap.test.ts lib/robots.test.ts lib/json-ld.test.tsx
```

## Follow-up outside this plan

Rich Results validation against the deployed domain, via the `claude-seo` plugin. The tests
above prove the JSON-LD is generated correctly; only a live run proves Google accepts it.
