# Result — SEO foundations, 2026-08-18

- **Plan:** [PLAN-seo-foundations.md](PLAN-seo-foundations.md)
- **Decision:** [ADR-029](../decisions/ADR-029-seo-foundations.md)
- **Prompt:** 29
- **Outcome:** 58/58 pass in the four new files; 601/601 across the whole suite

## Runs

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, no ESLint warnings or errors |
| `npm run test:run` | **601 passing across 28 files** (was 543 across 24) |
| `node scripts/validate-products.mjs` | `PASS — all checks green` |
| `npm run build` | **70/70** static pages from a cleared `.next` (was 68; `/sitemap.xml` and `/robots.txt` are the two new ones) |

## New files

| File | Tests |
| --- | --- |
| `lib/structured-data.test.ts` | 35 |
| `lib/sitemap.test.ts` | 12 |
| `lib/robots.test.ts` | 7 |
| `lib/json-ld.test.tsx` | 4 |

## What the run found

**One test had to be rewritten against reality.** The plan assumed a product priced at or
above the free-shipping threshold existed to assert a ₹0 rate against. None does: the
catalogue runs ₹49 to ₹499 and the threshold is ₹799, so every single-item offer publishes
₹99. The case was split in two — one asserting the flat rate on all 49 products *and* that
none reaches the threshold alone, one asserting ₹0 against a product record built at the
threshold. The second is what guards the boundary if the catalogue ever carries a piece that
crosses it.

**Nothing else failed.** No regression appeared in the 543 tests that already existed, which
matters because this prompt restructured `BUSINESS.address` from three display strings into six
fields and now derives the printed lines from them. The footer, `/terms` and `/privacy` render
byte-identical output.

## Verified against the built output, not only the unit tests

Built with `APP_BASE_URL=https://www.morchadigems.com` and inspected the emitted files.

**`/robots.txt`** — `Allow: /`, then `Disallow:` for `/cart`, `/address`, `/payment`,
`/order-confirmation`, `/style-guide` and `/api/`, then
`Sitemap: https://www.morchadigems.com/sitemap.xml`.

**`/sitemap.xml`** — 70 `<url>` entries: 8 static + 10 category + 3 collection + 49 product.
Zero matches for any checkout, cart, style-guide or API path. `gifting` is absent, correctly:
no product carries the tag.

**Product pages** — two `application/ld+json` blocks per page, `site-schema`
(`Organization`, `WebSite`) from the layout and `product-schema-{id}` (`Product`,
`BreadcrumbList`) from the page. Both parse. `P011`, which is out of stock, correctly publishes
`OutOfStock` alongside its `aggregateRating` of 4.7 from 219 ratings, `hasMerchantReturnPolicy`
with `merchantReturnDays: 7`, and `shippingDetails` at ₹99 to `IN` with 0–2 handling and 1–7
transit.

**Metadata sweep across every prerendered page** — title, description, `og:title`,
`og:description`, `og:image`, `og:url`, `og:type` and `twitter:card` present on all 15
prerendered routes. Canonical present and absolute on all eight indexable ones and correctly
absent on the five `noindex` ones. Product pages carry their own photograph in both cards;
everything else carries `/og/default.png`.

**The dynamic route** — `/shop` and `/shop?category=rings` were checked against a running
`next start` with `APP_BASE_URL` set, since they render per request rather than at build. Both
emit a self-referencing absolute canonical.

## Not covered here

Rich Results validation against the live domain, via the `claude-seo` plugin. That is a
post-deploy step: these tests prove the JSON-LD is generated correctly and parses, not that
Google accepts it. Expect that run to ask for `GTIN` or `MPN`, which the catalogue does not
carry and which are optional.
