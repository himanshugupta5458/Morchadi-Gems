# Result: SEO audit of live production — round three

- **Date:** 2026-08-19
- **Scope:** full-site audit of `https://morchadigems.com` against live HTTP responses. Findings only — no code changed.
- **Follows:** [RESULT-2026-08-19-seo-audit-followup.md](RESULT-2026-08-19-seo-audit-followup.md)
- **Health score:** 69/100, up from 66
- **Coverage:** all 70 sitemap URLs (all 200), plus 8 parameter and error-path probes, 10 crawler user-agents, TLS on both hosts

## Method and limits

Every finding below was verified against live HTTP responses from `https://morchadigems.com`
on 2026-08-19, not against repository source. Where a claim could not be verified, it is
labelled as unverified rather than asserted.

**What could not be measured, and why:**

| Missing | Cause | Consequence |
| --- | --- | --- |
| Field Core Web Vitals (CrUX) | No Google API credentials configured | Performance score is inferred from transfer sizes and TTFB, not measured |
| Lab Lighthouse run | PageSpeed Insights keyless quota exhausted; `claude-seo` Chromium runtime failed to install (`runtime import validation failed`) | No LCP/INP/CLS numbers, no screenshots, no mobile rendering capture |
| Indexation status | Site is not verified in Google Search Console | Cannot confirm a single page is indexed |
| Organic traffic | No GA4, no analytics of any kind on the site | Cannot rank findings by traffic impact |
| Backlink profile | No Moz/Bing/DataForSEO credentials | Off-site authority assessed only from public search |

The `site:` operator is not honoured reliably by the available search tool, so the absence of
`morchadigems.com` from those results is **not** evidence of non-indexation. Resolving that
question requires GSC, which is itself a finding below.

## Category scores

| Category | Weight | Score | Direction |
| --- | --- | --- | --- |
| Technical SEO | 22% | 88 | ▲ from 76 — `www` TLS fixed |
| Content Quality | 23% | 52 | ▲ from 45 — policy disclaimer removed |
| On-Page SEO | 20% | 68 | ◆ from 72 — re-measured, meta-description truncation found |
| Schema / Structured Data | 10% | 90 | ◆ unchanged |
| Performance (CWV) | 10% | 82 | ◆ from 88 — lowered for lack of measurement, not for a regression |
| AI Search Readiness | 10% | 42 | ▲ from 35 |
| Images | 5% | 55 | ◆ from 60 — re-measured |

## Resolved since the earlier audit today

Both are confirmed live, not merely committed.

**1. `www` TLS is fixed.** `www.morchadigems.com` now presents a valid Let's Encrypt
certificate (`CN=www.morchadigems.com`, issuer `CN=YR2`, issued 2026-08-19 07:29 UTC, expires
2026-11-17) and returns `HTTP/2 307` to `https://morchadigems.com/`. The previous failure —
`CN=TRAEFIK DEFAULT CERT` behind an HSTS `includeSubDomains; preload` header, which made the
cert error unbypassable — is gone. This was the single most damaging issue on the site and it
no longer reproduces.

**2. The policy-page disclaimer is gone.** `/terms`, `/privacy`, `/shipping` and `/refund`
return zero matches for `sample`, `lawyer`, `not been reviewed`, or the notice's
`aria-label`. `Last updated: 18 August 2026` is intact on all four, as is the policy prose.
Shipped in commit `4bd9a72`; the working tree is clean, so a future rebuild will not restore it.

---

## Critical

### C1 — No Google Search Console verification and no analytics of any kind

Verified on the live homepage: no `google-site-verification` meta tag, no `gtag`, no
`googletagmanager`, no Plausible, Umami, Clarity, or Meta pixel. The DNS TXT path cannot be
ruled out from here, but no HTML verification token is present.

This is ranked Critical not because it changes rankings — it does not — but because it makes
every other recommendation unfalsifiable. Right now nobody can answer whether the 49 product
pages are indexed, what queries the site already appears for, or whether any of the fixes
below moved anything. The site has been live and taking payments with no measurement at all.

There is a second-order blocker: the Content-Security-Policy `script-src` allowlists only
`'self'` and five Cashfree origins. Adding GA4 or GTM without editing the CSP will result in
the tag being silently blocked by the browser — the tag will appear installed in the source
and report nothing. Whichever analytics vendor is chosen, its origins must be added to
`script-src` and `connect-src` in the same change.

**Fix:** verify the property in GSC (HTML tag or DNS TXT), submit
`https://morchadigems.com/sitemap.xml`, and install one analytics tool with the matching CSP
origins added in the same commit. Verify afterwards that the beacon actually fires with the
CSP live, not on a local build with CSP off.

---

## High

### H1 — A second Morchadi storefront owns the brand's search results

A search for `"Morchadi Gems" jewellery` returns **morchadijewels.com** — *"Morchadi Jewels |
Artificial Jewelry for Indian Women"* — and does not return morchadigems.com. That site sells
the same catalogue shape: rings, naths, bangles, anti-tarnish lines, personalised pieces,
Kashmiri watches, "under ₹99" entry pricing. It carries different contact details
(`support@morchadijewels.com`, `+91 7877866212`, free shipping above ₹1499) from this site
(`admin@morchadigems.com`, `+91 9358358834`, free shipping above ₹799).

The same search also surfaces a GST registration for **MORCHADI ENTERPRISES**
(`08BBYPG5053R1ZO`, Rajasthan) — and this site's JSON-LD declares
`"legalName": "Morchadi Enterprise"`.

**I cannot verify from outside whether these are one business or two, and this finding is not
an accusation of anything.** But one of two situations is true, and both need a decision from
the owner:

- *Same owner, two storefronts.* Brand equity, links and search authority are split across
  two domains competing for the same head term. The older domain wins the brand SERP and the
  new one is invisible even for its own name. The fix is a consolidation decision:
  301-redirect one to the other, or differentiate them explicitly and cross-link.
- *Different businesses with near-identical brand names.* Then morchadigems.com is fighting an
  incumbent for its own brand query and needs the off-site footprint in H2 urgently, plus
  possibly a naming review.

Either way, the practical effect today is the same: a shopper who hears the brand name and
searches for it lands on the other site.

### H2 — No off-site footprint at all; `sameAs` is an empty array

Both the `Organization` and the `OnlineStore`/`LocalBusiness` nodes emit `"sameAs": []`. No
Instagram, Facebook, YouTube, Google Business Profile, or marketplace listing was found for
this domain in public search. For a Jaipur jewellery brand selling to Indian women, Instagram
is not a nice-to-have channel — it is where the category's discovery happens, and it is also
the entity corroboration Google and AI assistants use to decide the brand is real.

An empty `sameAs: []` is also worse than omitting the property: it explicitly asserts "this
entity has no other web presence."

**Fix:** create the profiles, populate `sameAs` with the real URLs, and claim a Google
Business Profile against the Jaipur address already in the schema. Until real URLs exist,
drop the empty arrays rather than publishing them.

### H3 — Fifteen meta descriptions are truncated in search results

The homepage and all fourteen collection pages carry descriptions of **179–193 characters**
against a display limit of roughly 155–160.

| Page | Length |
| --- | --- |
| `/shop` | 193 |
| `/` | 192 |
| `/shop?category=hair-accessories` | 190 |
| the other 12 facets | 179–186 |

Everything after ~160 characters is cut, and on every one of these pages the truncated tail is
the same clause: *"with free shipping over ₹799 across India and easy 7-day returns"* — the
strongest commercial hook on the page, never shown.

Worse, the fourteen facet descriptions are one template with a noun swapped at character 5:
`Shop {noun} at Morchadi Gems: anti-tarnish, skin-friendly artificial jewellery,
hand-finished and quality-checked, with free shipping over ₹799 across India and easy 7-day
returns.` The differentiating word survives truncation, but the remaining ~150 visible
characters are byte-identical across all fourteen. The 49 product descriptions, by contrast,
are 144–160 characters and individually written — the good pattern already exists in this
codebase.

### H4 — Collection pages waste their titles and carry no copy

Facet titles are 21–32 characters — `Rings · Morchadi Gems`, `Anklets · Morchadi Gems` — where
Google displays around 60. They target the bare category noun plus the brand, which means they
target nothing a shopper actually types. Nobody searches "rings"; they search "artificial rings
online india", "anti tarnish rings for women", "adjustable rings under 300".

The pages are also thin: 198–328 words, essentially all of it product-card text and global
chrome. There is no category introduction, no buying guidance, no internal links to related
categories. Ten category pages and three collection pages — thirteen of the site's strongest
commercial-intent URLs — are competing on product tiles alone.

### H5 — Forty-eight of forty-nine products have exactly one photograph

Measured on the gallery region of each product page, excluding the "You May Also Like" cards:
48 products render a single image; only P002 has two (`P002.webp`, `P002-2.webp`). The
`Product` schema's `image` array reflects this honestly — one URL for those 48.

The gallery component and the schema already handle multiple images correctly, so this is not
a code gap. It is a photography gap, and it is the ceiling on both conversion and Google
Images/Shopping surfaces for the entire catalogue. For jewellery — where scale, fit and finish
are the whole purchase decision — one photo per product is the single largest commercial
constraint on the site.

### H6 — No page on the site targets a single unbranded query

The sitemap is 70 URLs: home, `/shop`, `/about`, `/contact`, 4 policies, 13 facets, 49
products. There is no blog, no guide, no FAQ page, no care page. Every URL is transactional or
administrative.

This matters more here than on a typical store because the product copy is genuinely
expert. From `/product/P031` alone: *"A screw fitting is the more secure of the two common
options and it does not work loose through a night of dancing the way a push fit sometimes
does"*, and *"Nose jewellery meets more skin oil than anything else in a jewellery box, and
that is what dulls plating, not age."* From `/about`: the 2020 move to anti-tarnish plating
because *"the single most common complaint about artificial jewellery is that it turns after a
month."*

That is first-hand operator knowledge of exactly the kind Google's helpful-content systems and
AI assistants reward — and it is currently locked inside pages that can only ever rank for
product names. "Screw fit vs push fit nath", "how to stop artificial jewellery turning your
skin green", "what is anti-tarnish plating" are queries this business can answer better than
the sites currently ranking for them, and it has no page to do it from.

---

## Medium

### M1 — `/product/P006` renders zero outbound product links

P006 (Floating Locket Pendant) is the only pendant in the catalogue and is out of stock. Its
page contains no "You May Also Like" section at all — verified: zero `/product/P*` hrefs in the
document body. Related products are selected within category with no cross-category fallback,
so a single-item category produces an empty set and the section disappears silently.

The result is a dead end: an out-of-stock page with no path onward for either a shopper or a
crawler. Thirteen further products render only 1–2 related links for the same reason
(P002, P003, P022, P023, and the eight bangle/anklet/hair items).

**Fix:** when in-category candidates fall short of the target count, fill from the nearest
related category or from best-sellers.

### M2 — Product shipping schema never mentions free shipping

All 49 offers emit `shippingRate: {value: 99, currency: INR}` with no
`freeShippingThreshold`. The store's actual rule — and the one advertised in the announcement
bar, on the policy pages and in the meta descriptions — is ₹99 flat, free over ₹799.

Schema.org's `OfferShippingDetails` supports the threshold via `shippingRate` with
`freeShippingThreshold`. As written, every structured-data consumer, including Google's
free-listing surfaces, is told shipping always costs ₹99. The site is under-selling a real
offer in the one place machines read.

### M3 — Collection and static pages carry no `BreadcrumbList`

Breadcrumb schema is present on all 49 product pages and absent everywhere else, including the
13 facet pages that do render a visible breadcrumb trail in the UI. The markup and the page
disagree.

### M4 — The OG image is WebP-only, on a WhatsApp-first market

`https://morchadigems.com/og/default.webp` is `image/webp`, 24,732 bytes, 1200×630, correctly
declared with `og:image:type`, dimensions and alt. Facebook handles WebP; several other
scrapers historically do not, and WhatsApp link previews are the weakest of them.

This site ships a floating WhatsApp chat button and sells to an Indian audience — WhatsApp is
almost certainly the primary channel by which a product link gets shared between shoppers. A
link that renders no preview thumbnail there loses most of its click-through.

**I have not been able to verify WhatsApp's current WebP behaviour from this environment**, so
treat this as a risk to test rather than a confirmed defect: share a product URL into a
WhatsApp chat and look at the preview. If the thumbnail is missing, serve a JPEG or PNG at
`og:image` and keep the WebP as a secondary entry.

### M5 — Category pages are the only route to 6 of 49 products

P012 and P015–P019 receive zero inbound internal links from any of the 70 sitemap URLs. They
are not orphans — they are reachable at `/shop?page=2..5` and
`/shop?category=rings&page=2`, both of which are linked and crawlable — but they sit one
pagination hop deeper than everything else and appear on no sitemap URL. Rings is the largest
category (21 products against a 12-per-page limit), so the overflow is structural and will
recur as the catalogue grows.

Paginated URLs self-canonicalise correctly (`?page=2` → `?page=2`, and an out-of-range
`?page=99` correctly canonicalises to the clamped `?page=5`), so there is no index-bloat risk
here — only a link-equity one.

---

## Low

### L1 — HTTP-to-HTTPS is a 302, not a 301

`http://morchadigems.com/` returns `302 Found`. With `Strict-Transport-Security:
max-age=63072000; includeSubDomains; preload` in place the practical impact is near zero, but
a permanent redirect is the correct signal.

### L2 — `<html lang="en">` against `og:locale: en_IN`

The document declares generic English while the Open Graph locale declares Indian English.
`en-IN` in both places is more precise for a market-specific store.

### L3 — Homepage canonical omits the trailing slash

`<link rel="canonical" href="https://morchadigems.com">` while the sitemap lists
`https://morchadigems.com/`. Google normalises this, but the two should agree.

### L4 — `foundingDate: 2016` against a 2023 GST registration

The `/about` page and schema both claim 2016 and "10,000+ customers"; public GST records show
MORCHADI ENTERPRISES registered 06 Jan 2023. Trading offline before registering is entirely
ordinary and this is very likely fine — noted only so the owner knows the two dates are
publicly visible side by side and can decide whether the About copy should say so.

### L5 — No `llms.txt`

Returns 404. Google ignores the convention entirely and no major AI crawler is known to require
it, so this is genuinely optional — recorded so it is not raised again as if it mattered.

---

## Verified correct — recorded so it is not re-raised

These were checked against the live site and are working. Several are things a generic audit
tool would flag as problems.

**Technical.** `robots.txt` allows everything except `/cart`, `/address`, `/payment`,
`/order-confirmation`, `/style-guide`, `/api/` — exactly the set that should be excluded — and
declares the sitemap. All 70 sitemap URLs return 200 with zero redirects and zero errors. `/nope`
and `/product/P999` both return true 404s. Compression is active and effective (homepage
181,100 bytes → 20,884 on the wire; the 124KB JS chunk → 31,842). Security headers are
comprehensive: strict CSP, HSTS with preload, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`. All ten crawler user-agents tested — Googlebot,
Bingbot, GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, CCBot, Amazonbot,
meta-externalagent — receive identical full 200 responses.

**Canonicalisation.** This is unusually well handled. `?sort=` is stripped
(`/shop?sort=price-asc` → `/shop`); an invalid facet value canonicalises to the parent
(`?category=bogus` → `/shop`); a valid facet self-canonicalises; pagination self-canonicalises;
an out-of-range page clamps. A zero-result facet combination
(`?category=pendants&collection=best-sellers`) correctly returns `noindex, follow`.

**Rendering.** Full content, navigation, links and JSON-LD are present in the raw HTML with no
JavaScript executed. TTFB is 53–151 ms across home, shop and product routes.

**Schema.** `Organization` + `OnlineStore`/`LocalBusiness` + `WebSite` on all 70 pages, cross-
referenced by `@id`, with `Product` and `BreadcrumbList` on all 49 product pages and
`CollectionPage` + `ItemList` on all 14 collection pages. All parse without error. Every
`Product` carries name, image, sku, brand, description and a complete `Offer`. Availability is
honest — 43 `InStock`, 6 `OutOfStock`. Return policy is not boilerplate: 35 products carry
`MerchantReturnFiniteReturnWindow` with `merchantReturnDays: 7`, and 14 carry
`MerchantReturnNotPermitted` — matching the pierced and personalised exclusions written into
`/refund` exactly.

**On-page.** 70 unique titles, zero duplicates. Exactly one `<h1>` per page. Every page carries
9–11 Open Graph tags plus a Twitter card. Product titles (50–57 chars) and product meta
descriptions (144–160 chars) are individually written and correctly sized.

**Images.** 100% meaningful-alt coverage. The ten homepage category tiles carry `alt=""`, which
is correct — each sits inside an anchor whose visible text already names the category, so alt
text would duplicate the link name for a screen reader. All imagery is WebP with responsive
`srcset` and lazy loading below the fold.

**No fabricated trust signals.** No `aggregateRating`, no `review` markup, no testimonials
anywhere — the invented reviews removed in the earlier remediation have not returned.

## What would move the score most

The gap between 69 and the mid-80s is almost entirely content and off-site, not code. Technical
SEO and schema are close to finished; the site is well built and honestly marked up. What it
lacks is measurement (C1), an identity in search results (H1, H2), photographs (H5), and any
page that answers a question (H6).

---

# Action plan

Ordered by dependency, not by severity. Several high-severity items cannot be judged until
measurement exists, and one requires a business decision no amount of code can make.

## Phase 1 — Make the site measurable (this week)

**1. Verify Google Search Console and install analytics.** `C1`
Blocks everything below it: without indexation data and query data, no later change can be
shown to have worked or failed.
- Verify the property (HTML tag or DNS TXT) and submit `https://morchadigems.com/sitemap.xml`.
- Pick one analytics tool and install it.
- **In the same commit**, add that tool's origins to `script-src` and `connect-src` in the CSP.
  The current policy allows only `'self'` and five Cashfree origins, so a tag added without
  this will be blocked by the browser and report zero while appearing correctly installed.
- Confirm the beacon fires against the live CSP, not a local build with CSP disabled.
- Then read the Pages report and answer the question nobody can currently answer: how many of
  the 70 URLs are indexed.

**2. Decide what to do about morchadijewels.com.** `H1`
A business decision, not a code change, and nothing in the content plan below is worth funding
until it is made. If both storefronts are yours, consolidating them — 301 one to the other — is
almost certainly worth more than every other item on this list combined, because it ends a
split of brand authority and hands this domain a search presence for its own name. If they are
unrelated, say so and the off-site work in Phase 2 becomes urgent rather than merely important.

**3. Test the WhatsApp preview.** `M4`
Two minutes: share a product URL into a WhatsApp chat and look. If no thumbnail renders, swap
`og:image` to a JPEG. If it renders, close the finding.

## Phase 2 — Establish an identity in search (weeks 2–3)

**4. Create the social profiles and populate `sameAs`.** `H2`
Instagram first — it is where this category is discovered in India. Then claim the Google
Business Profile against the Jaipur address already in the schema. Replace `"sameAs": []` with
the real URLs; until they exist, remove the empty arrays rather than publishing an explicit
"no other web presence" claim.

**5. Rewrite fifteen meta descriptions to fit.** `H3`
Homepage and all fourteen collection pages, currently 179–193 characters against a ~155–160
display limit. Give each facet its own copy rather than one template with the noun swapped —
the 49 product descriptions already show the pattern and are correctly sized at 144–160.

**6. Rewrite the collection page titles.** `H4`
`Rings · Morchadi Gems` is 21 characters of a ~60-character budget spent on a word nobody
searches alone. Target what shoppers type: category + material/property + market, e.g.
*Anti-Tarnish Artificial Rings Online India · Morchadi Gems*.

**7. Fix the related-products fallback.** `M1`
When in-category candidates fall short, fill from the nearest related category or best-sellers.
Resolves the P006 dead end and thickens thirteen further product pages.

## Phase 3 — Content and photography (month 2)

**8. Photograph the catalogue.** `H5`
48 of 49 products have exactly one image. The gallery and the schema already support multiples,
so no code is needed — this is a photography commission. Three to five shots per product, with
at least one on-body for scale. This is the largest single constraint on both conversion and
Google Images/Shopping visibility, and it is the slowest to execute, which is why it starts now
rather than later.

**9. Write 150–250 words of intro copy per collection page.** `H4`
Thirteen commercial-intent URLs currently carrying 198–328 words of product tiles and chrome.

**10. Write the informational pages.** `H6`
The knowledge already exists in the product copy and the About page — it simply has no URL that
can rank for a question. Start with what the catalogue already demonstrates expertise in:
- *Screw fit vs push fit naths — which to buy for a pierced nose*
- *How to stop artificial jewellery turning your skin green*
- *What anti-tarnish plating actually is, and how long it lasts*
- *Caring for gold-plated brass: what dulls it and what does not*

Each one is answerable from first-hand operator knowledge already written on this site. Link
them from the relevant category and product pages.

**11. Add the free-shipping threshold to product schema.** `M2`
All 49 offers currently declare a flat ₹99 with no `freeShippingThreshold`, which under-states
a real offer to every machine that reads the page.

**12. Add `BreadcrumbList` to collection and static pages.** `M3`
The UI already renders the trail; only the markup is missing.

## Phase 4 — Ongoing

- Read GSC weekly once data accumulates; re-rank this plan against real query data rather than
  against inference.
- Re-audit after the Phase 1 and 2 work lands, with field CWV available through CrUX once GSC
  is verified.
- Housekeeping when convenient: 301 instead of 302 on HTTP→HTTPS (`L1`), `lang="en-IN"` (`L2`),
  trailing slash on the homepage canonical (`L3`).
- Commission the legal review of the four policy pages recommended in ADR-037. Removing the
  disclaimer stopped the site advertising that they were unreviewed; it did not review them.

## Not recommended

- **`llms.txt`** — Google ignores it and no major AI crawler requires it.
- **`FAQPage` schema** — Google retired FAQ rich results for all sites on 2026-05-07. The Q&A
  copy is worth writing for humans and AI extraction; the markup buys nothing.
- **Review schema** — do not re-add `aggregateRating` or `review` until real, verifiable
  customer reviews exist to put in them.
