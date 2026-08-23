# Test Result: SEO Audit Round Four — 2026-08-22

- **Plan:** no `PLAN-` file; this is a full-site audit run from the `claude-seo` skill against production, in the same series as [round three](RESULT-2026-08-19-seo-audit-round-three.md)
- **Commit:** `d1454c2`
- **Environment:** live production, `https://morchadigems.com`, behind Cloudflare. Findings traced back to the working tree where a source cause exists
- **Method:** all 70 sitemap URLs crawled and parsed; JSON-LD extracted from all 49 product pages; redirects, headers and payloads probed directly; five specialist passes (technical, content, schema, GEO, e-commerce)
- **Not covered:** no lab or field Core Web Vitals. The skill's Playwright runtime was not provisioned (`claude-seo doctor` reported `ready: false`, `browser_ready: false`), so LCP, INP and CLS were **not measured**. No live SERP or keyword-volume data. No screenshots

## SEO Health Score: 75.7 / 100

| Category | Score | Weight | Basis |
| --- | --- | --- | --- |
| Technical SEO | 84 | 22% | source-verified against the tree |
| Content Quality | 58 | 23% | E-E-A-T composite 48 |
| On-Page SEO | 92 | 20% | measured across all 70 URLs |
| Schema / Structured Data | 76 | 10% | all 49 products parsed, not sampled |
| Performance (CWV) | 88 | 10% | TTFB and payload only — **CWV not measured** |
| AI Search Readiness | 46 | 10% | entity corroboration near zero |
| Images | 90 | 5% | alt text 70/70; OG dimensions mismatched |

## Cases

| ID | Result | Notes |
| --- | --- | --- |
| SEO-01 | Pass | All 70 sitemap URLs return 200. No 4xx, no 5xx, no redirect chains |
| SEO-02 | Pass | 70/70 unique titles, meta descriptions and canonicals. Zero duplicates |
| SEO-03 | Pass | 70/70 self-canonical and correct. 70/70 exactly one H1 |
| SEO-04 | Pass | 0 images missing `alt` across 70 pages. `srcSet`/`sizes`/`fill` correct, no CLS geometry, `fetchPriority="high"` on the LCP image |
| SEO-05 | Pass | `http`→`https` 301; `/shop/`→`/shop` 308; 404 returns `noindex` and branded copy; `/admin` 307 to `/` |
| SEO-06 | Pass | TTFB 56–92 ms; HTML 15.7–18.6 KB brotli; one stylesheet; static prerender on all 75 pages |
| SEO-07 | **Pass — prior finding withdrawn** | `hasMerchantReturnPolicy` is **correct**. 35/49 `MerchantReturnFiniteReturnWindow` at 7 days; 14/49 `MerchantReturnNotPermitted` — exactly the 7 earrings, 5 nose pins and 2 engraved initial rings (P001, P005) that `/refund` excludes. Verified across all 49, not sampled |
| SEO-08 | Pass | Empty facets already return `noindex, follow` with no `ItemList` (ADR-034). `SearchAction` correctly absent and test-enforced (`lib/structured-data.test.ts:118`) |
| SEO-09 | **Fail** | `www.morchadigems.com` returns **302, not 301**. Issued outside this repo — no `redirects()` in `next.config.mjs`, no www branch in `middleware.ts` |
| SEO-10 | **Fail** | `DEPLOY.md` §3 still documents `https://www.morchadigems.com` as the canonical origin while production emits the bare apex. Following DEPLOY.md literally on a rebuild would flip every canonical, sitemap `loc` and JSON-LD `@id` to another origin |
| SEO-11 | **Fail** | `og:type` renders as `name="og:type"` not `property="og:type"` on all 49 product pages. Next 14 cannot emit it correctly — `openGraph.type: "product"` hits a `default:` branch that throws `Invalid OpenGraph type`. Documented tradeoff at `lib/metadata.ts:53-56` |
| SEO-12 | **Fail** | OG image dimensions declared `1200×630` for all 49 products (`product/[id]/page.tsx:41-42`), but the real files are 800×800, 1000×1000, 1024×1024 and 819×1024. None is 1200×630 |
| SEO-13 | **Fail** | `?category=rings&page=2` is indexable and carries a `<title>` identical to page 1, with its own canonical and no `noindex` |
| SEO-14 | **Fail** | `/shop?collection=gifting` is linked from the footer of all 70 pages, returns 200 and renders "Nothing matches those filters". Zero SKUs carry the tag. Correctly `noindex`, so no index bloat — but a sitewide dead-end link |
| SEO-15 | **Fail** | `sameAs: []` on both `Organization` and `LocalBusiness`, every page. No social, marketplace or GBP profile exists to link |
| SEO-16 | **Fail** | Zero reviews, ratings or testimonials sitewide; no `AggregateRating`/`Review` on any of 49 products. Correctly not fabricated, but no review rich-result eligibility |
| SEO-17 | **Fail** | "skin-friendly" ships in the meta description of every page via `PRODUCT_DESCRIPTOR` (`lib/config.ts:54`) and appears 8–13 times in body copy, but the catalogue contains **zero** occurrences of "sensitive skin", "hypoallergenic", "nickel", "lead-free" or "allergy". The claim is unsubstantiated anywhere on the site |
| SEO-18 | **Fail** | Category depth is severely skewed: rings 18 SKUs, but pendants 1, necklaces 2, watches 2. Six of ten categories hold ≤3 products yet render as fully indexable category pages |
| SEO-19 | **Fail** | All 14 filtered views share one templated meta description from `listingDescriptionOf` (`shop/page.tsx:55-60`), differing only by the swapped category noun. No unique body copy on any of them — the six H2s are footer and filter chrome |
| SEO-20 | **Fail** | No informational content of any kind. No blog, no care guide, no sizing guide, no explainer for anti-tarnish — the site's own stated differentiator |
| SEO-21 | Info | No GSC/Bing verification meta tag on the homepage. GA4 **is** live (`G-04ND4TOJ6R`) — an earlier "no analytics" claim from a prior round is stale. Verification may still be by DNS TXT; not determinable from outside |
| SEO-22 | Info | `s-maxage=31536000` on HTML is real and its mitigation (DEPLOY.md §4, ADR-049) is procedural — a Cloudflare dashboard setting nothing in the repo enforces |
| SEO-23 | Info | No `gtin`/`mpn` on any product. Legitimate for a private-label catalogue, but worth setting `identifier_exists: false` deliberately in any Merchant Center feed |

## Failures

### The two that would change what a rebuild produces
SEO-09 and SEO-10 are one problem. `docs/PROJECT-STATE.md` already flagged the origin ambiguity on 2026-08-21 and marked it `[VERIFY WITH OWNER]`; it is still open, and the redirect has since moved 307 → 302 without the underlying question being answered. Both need an owner decision on which origin is canonical, then a 301 and a DEPLOY.md correction.

### The claim with no evidence behind it
SEO-17 is the most consequential content failure. A jewellery brand asserting skin-friendliness in every meta description with no substantiating page cannot rank for, or be cited on, the safety queries that claim invites — and the assertion is doing real commercial work in the SERP snippet.

### The structural one
SEO-18 and SEO-19 compound. A category page with one product and no unique prose cannot compete for a category head term regardless of URL shape, which is why the query-string-vs-path question (`/shop?category=rings` vs `/shop/rings`) is **not** the first thing to fix — the pages have no content to carry to a cleaner URL.

## Summary

6 passed, 14 failed, 3 informational. **Shippable — nothing found blocks crawling, indexing or rendering, and no Critical was confirmed.** The technical and on-page foundation is strong and in several places better than the prior rounds recorded. The failures cluster in off-site authority, substantiation and category-level content, none of which is a code defect.

One prior finding is **withdrawn**, not carried forward: the return-policy schema is correct (SEO-07). It was reported as a contradiction earlier in this run on the strength of a single sampled product, P005, which is one of the fourteen items legitimately excluded from returns. Parsing all 49 disproved it.
