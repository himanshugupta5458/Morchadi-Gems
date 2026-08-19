# RESULT — 2026-08-19 — Post-remediation SEO audit (live production)

Full-site SEO audit of `https://morchadigems.com` run after [ADR-034](../decisions/ADR-034-seo-audit-remediation.md)
shipped. Audited live production over HTTP plus repository source. Four specialist passes —
technical, content/E-E-A-T, e-commerce/schema, GEO — with every reported finding re-verified
against the live site or source before inclusion.

**No code was changed by this audit.** It is a findings document.

## Scope

70 sitemap URLs: 8 static/policy, 49 `/product/[SKU]`, 13 `/shop?category=` and `?collection=` facets.

## SEO Health Score — 66/100

| Category | Weight | Score |
| --- | --- | --- |
| Content quality | 23% | 45 |
| Technical SEO | 22% | 76 |
| On-page SEO | 20% | 72 |
| Schema / structured data | 10% | 90 |
| Performance | 10% | 88 |
| AI search readiness | 10% | 35 |
| Images | 5% | 60 |

Performance carries no field data — CrUX and Search Console are not connected (finding C3), so 88 is
measured from origin response times (TTFB ~110ms) and source-level CLS handling, not from real users.

## Critical

**C1 — All four policy pages publicly disclaim their own terms.** `/terms`, `/privacy`, `/shipping`
and `/refund` render `components/PolicyDisclaimer.tsx`, live: *"Sample template … It has not been
reviewed by a lawyer … before relying on it or publishing it as binding terms."* On a store taking
real Cashfree payments this tells shoppers and raters the terms are not binding. Owner/legal blocker.
Falsify: `curl -s https://morchadigems.com/refund | grep "Sample template"` returns empty.

**C2 — HSTS `includeSubDomains` shipped before `www` had valid TLS.** The apex serves
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. `www.morchadigems.com`
resolves to the same IP (`82.29.165.124`) but presents `CN=TRAEFIK DEFAULT CERT` (self-signed) and
then 503, with no `www → apex` redirect. Because `includeSubDomains` is already being served, a
browser that has visited the apex forces HTTPS on `www` and then refuses the cert with no
click-through — HSTS suppresses the bypass interstitial. ADR-034 listed confirming `www` TLS as a
precondition for preload submission; the header shipped first. Do not submit to the preload list
until `curl -I https://www.morchadigems.com/` returns a valid cert and a 301 to the apex.

**C3 — No analytics and no Search Console verification tag.** No GA4/GTM/pixel and no
`google-site-verification` meta tag in the rendered HTML. The CSP allowlists only Cashfree origins,
so GA4 would be blocked until `config/security-headers.mjs` is updated. This gates the rest of the
report: keyword-targeting decisions in particular should follow real query data, not precede it.
Caveat: GSC can be verified by DNS TXT, so the missing meta tag is not proof the property is unverified.

## High

- **H1 — No unbranded query is targeted anywhere.** All 70 URLs are transactional. No page addresses
  skin sensitivity, gold-plating care, or anti-tarnish — despite that being the core sitewide claim.
  `app/about/page.tsx` already contains first-hand owner knowledge on exactly this; it has no page to live on.
- **H2 — 48 of 49 products have exactly one image.** Only `P002` has two. `ProductGallery` and
  `collectProductImages()` already handle multiples — the gap is photography, not code.
- **H3 — Facet pages are one templated sentence.** All 13 meta descriptions come from a single
  template in `app/shop/page.tsx` with the noun swapped. Pages are otherwise correctly built
  (unique titles/H1s, self-canonical, `CollectionPage` + `ItemList`, in sitemap).
- **H4 — Tail categories are link dead ends.** `getRelatedProducts()` is same-category only with no
  fallback. Pendants has one product (`P006`, out of stock); verified live that `/product/P006`
  renders zero outbound product links. Watches has two.
- **H5 — No entity corroboration.** `sameAs: []` on both Organization and store nodes, no social
  profiles on-site, no detectable GBP. Deliberate and config-driven — an owner input, not a bug.

## Medium

- **M1** — Two-facet combos (`?category=X&collection=Y`) are indexable and self-canonical but fall
  back to the generic "Shop All Jewellery" title and "The Collection" H1. Exposure is limited because
  `ShopFilterPanel` uses `router.push` with no anchors, so combos are not link-discoverable.
- **M2** — Product pages carry ~60–80 words of unique copy; no care, sizing, or materials guidance.
- **M3** — Homepage H1 "Everyday Sparkle" and shop H1 "The Collection" carry no keyword value.
  Sequence after C3.
- **M4** — No Merchant Center feed or account. Structured data alone does not produce Shopping presence.
- **M5** — SKU-only URLs (`Product` has no `slug` field), `?page=N` unbounded and always 200, no IndexNow.

## Low

L1 "Gifting" collection linked in nav but empty (correctly `noindex` and excluded from sitemap — the
nav link is the bug) · L2 `http→https` is 307 not 301 · L3 pagination tap targets 40px
(`components/Pagination.tsx`) · L4 sitemap `lastmod` is one hardcoded `CONTENT_LAST_MODIFIED_ISO`
across all 70 URLs · L5 `Product.brand` inline rather than an `@id` reference · L6 gallery alt text
repeats the product name · L7 some product images below 800px on the short side.

## Two corrections recorded

**`MerchantReturnNotPermitted` is correct, not a bug.** This audit flagged it first and wrongly.
`isReturnable()` excludes pierced categories and genuinely personalised items, keyed on option *name*
so a colour choice stays returnable while an engraved letter does not — 14 of 49 products, matching
what `/refund` excludes. Verified live against source with no build drift.

**Do not add `FAQPage` schema for rich results.** Structuring existing facts as plain Q&A is worth
doing for extractability, but Google retired FAQ rich results for all sites on 7 May 2026, so the
markup buys nothing in Google Search.

## Verified correct (do not relitigate)

SSR of nav/product links/JSON-LD with no JS · security headers · schema depth and `@id`
cross-referencing · return-policy modelling · `OutOfStock` on all six OOS products · zero-result
facets `noindex, follow` with no `ItemList` · `?sort=` stripped from canonical · `?category=bogus`
canonicalized to `/shop` · crawl depth ≤3 with no orphans · `dynamicParams = false` giving true 404s ·
100% alt-text coverage · CLS and LCP handling · raw IP returns 503 · no fabricated review signals ·
no hreflang needed for single-locale `en_IN` · all AI crawlers receive 200 with full HTML.

## Blocked on owner input

Legal review of the four policies · which social profiles will exist · GBP claim and its real map pin
(schema carries approximate Mansarovar coordinates) · GST registration status · confirmation that the
"10,000 customers" and "500 designs" figures on `/about` are real.
