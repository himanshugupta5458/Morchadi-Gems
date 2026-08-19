# Testing

## Purpose

Test plans and the results of running them. A plan states what must be true before a
feature is considered shippable; a result records what actually happened when it was run,
including failures.

Money paths are the priority here. Server-side price validation, cart totals, and the
Cashfree order lifecycle each need a plan that includes hostile cases — a tampered price in
the request body, a quantity of zero or negative, an unknown product ID, a duplicate
webhook — not just the path where everything works.

## Naming convention

| Kind | Pattern | Example |
| --- | --- | --- |
| Plan | `PLAN-short-kebab-case-area.md` | `PLAN-checkout-flow.md` |
| Result | `RESULT-YYYY-MM-DD-short-kebab-case-area.md` | `RESULT-2026-08-17-checkout-flow.md` |

A result file links back to the plan it executed. A plan is a living document and may be
edited; a result is a snapshot and is never edited after it is written.

## Required structure — plan

```markdown
# Test Plan: Area

- **Scope:** what is covered, and explicitly what is not
- **Prerequisites:** env vars, sandbox credentials, seed data

## Cases

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | ... | ... | ... | Automated / Manual |

Include negative and adversarial cases, not only the happy path.
```

## Required structure — result

```markdown
# Test Result: Area — YYYY-MM-DD

- **Plan:** [PLAN-area.md](PLAN-area.md)
- **Commit:** short SHA
- **Environment:** local / Vercel preview, Cashfree sandbox or production

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass / Fail | ... |

## Failures
One subsection per failure, linking to the log in `../logs/` if one was written.

## Summary
N passed, N failed, N skipped — and whether this is shippable.
```

Record failures as failures. A result file that hides a failing case defeats its own
purpose.

## Index

| Plan | Latest result |
| --- | --- |
| [PLAN-product-catalogue.md](PLAN-product-catalogue.md) | [2026-08-17](RESULT-2026-08-17-product-catalogue.md) — 22/22 pass |
| [PLAN-shop-logic.md](PLAN-shop-logic.md) | [2026-08-17](RESULT-2026-08-17-shop-logic.md) — 53/53 pass |
| [PLAN-cart-logic.md](PLAN-cart-logic.md) | [2026-08-17](RESULT-2026-08-17-cart-logic.md) — 59/59 pass |
| [PLAN-address-validation.md](PLAN-address-validation.md) | [2026-08-17](RESULT-2026-08-17-address-validation.md) — 83/83 pass |
| [PLAN-order-pricing.md](PLAN-order-pricing.md) | [2026-08-17](RESULT-2026-08-17-order-pricing.md) — 36/36 pass |
| [PLAN-shipping-threshold.md](PLAN-shipping-threshold.md) | [2026-08-18](RESULT-2026-08-18-shipping-threshold.md) — 20/20 pass |
| [PLAN-cart-line-keys.md](PLAN-cart-line-keys.md) | [2026-08-18](RESULT-2026-08-18-cart-line-keys.md) — 85/85 pass |
| *(no plan — regression guards)* | [2026-08-18](RESULT-2026-08-18-funnel-ui-polish.md) — funnel UI polish, 480/480 pass |
| *(no plan — regression guard)* | [2026-08-18](RESULT-2026-08-18-button-padding.md) — button padding verified against the emitted CSS, 481/481 pass |
| *(no plan — regression guard)* | [2026-08-18](RESULT-2026-08-18-hero-cta-equal-width.md) — hero paired CTAs equal width, 485/485 pass |
| [PLAN-product-schema-migration.md](PLAN-product-schema-migration.md) | [2026-08-18](RESULT-2026-08-18-product-schema-migration.md) — 49/49 pass, 543/543 suite |
| [PLAN-seo-foundations.md](PLAN-seo-foundations.md) | [2026-08-18](RESULT-2026-08-18-seo-foundations.md) — 58/58 pass, 601/601 suite |
| *(no plan — deployment verification)* | [2026-08-19](RESULT-2026-08-19-container-build.md) — containerised production build, 43/43 as expected, 653/653 suite |
| [PLAN-seo-audit-remediation.md](PLAN-seo-audit-remediation.md) | [2026-08-19](RESULT-2026-08-19-seo-audit-remediation.md) — 70/70 pass, 735/735 suite |

## Runners

Two, answering different questions. Both must be green; neither replaces the other.

| Command | Covers |
| --- | --- |
| `npm run validate:products` | The **data** — `data/products.json` shape, conventions, and the image files it points at |
| `npm run test:run` | The **logic** — Vitest unit tests over `lib/`. `npm test` for watch mode |

Vitest is configured in `vitest.config.mts` and picks up `lib/**/*.test.{ts,tsx}`.

Most suites run in the default `node` environment. A `.test.tsx` file that needs a DOM opts in
per file with a `/** @vitest-environment jsdom */` docblock on its first line — the environment
is a property of the file, so it is declared in the file rather than pattern-matched in config.
`jsdom` and `@testing-library/react` are devDependencies and never reach a build.

| Suite | Covers | Plan |
| --- | --- | --- |
| `lib/shop.test.ts` | Filtering, sorting, pagination, URL vocabulary | [PLAN-shop-logic.md](PLAN-shop-logic.md) |
| `lib/quantity.test.ts` | `clampQuantity` bounds, flooring, and non-finite input | — small enough to read directly |
| `lib/cart.test.ts` | Cart arithmetic — add/merge/clamp, remove, set quantity, pruning, hostile persisted data, subtotal/shipping/total, and line identity once a product has options | [PLAN-cart-logic.md](PLAN-cart-logic.md), [PLAN-cart-line-keys.md](PLAN-cart-line-keys.md) |
| `lib/options.test.ts` | `lineKey`, option defaults and resolution, staleness, hostile stored selections, the order summary | [PLAN-cart-line-keys.md](PLAN-cart-line-keys.md) |
| `lib/order-options.test.ts` | Merging a product's lines before pricing, order-time option validation, Cashfree `order_tags` packing | [PLAN-cart-line-keys.md](PLAN-cart-line-keys.md) |
| `lib/product-options.test.tsx` | The product-page selectors, the cart line echo, the personalized note, per-line edits | [PLAN-cart-line-keys.md](PLAN-cart-line-keys.md) |
| `lib/cart-context.test.tsx` | `CartProvider` hydration, `localStorage` persistence, the header badge, and the `/cart` view | [PLAN-cart-logic.md](PLAN-cart-logic.md) |
| `lib/address.test.ts` | Per-field and aggregate address validation, the Indian states list, focus order | [PLAN-address-validation.md](PLAN-address-validation.md) |
| `lib/checkout.test.ts` | The `sessionStorage` checkout bundle — assembly from cart lines, the recorded choices it carries, and parsing hostile stored data | [PLAN-address-validation.md](PLAN-address-validation.md), [PLAN-cart-line-keys.md](PLAN-cart-line-keys.md) |
| `lib/address-checkout.test.tsx` | `/address` — the empty-cart guard, blur/submit validation, focus, the handoff to `/payment`, repopulation | [PLAN-address-validation.md](PLAN-address-validation.md) |
| `lib/order.test.ts` | Server-side order pricing — catalogue-only totals, `mrp` exclusion, hostile items, per-item error collection, untrusted-body parsing, the free-shipping boundary | [PLAN-order-pricing.md](PLAN-order-pricing.md), [PLAN-shipping-threshold.md](PLAN-shipping-threshold.md) |
| `lib/button-styles.test.ts` | The two button scales by their literal padding and type classes, that only the box differs, and that no height or line-height class constrains them | [2026-08-18](RESULT-2026-08-18-button-padding.md) |
| `lib/hero-cta.test.tsx` | The hero call-to-action pair — one grid parent of two equal columns, `fullWidth` on both, one box across the pair, and the gap between them | [2026-08-18](RESULT-2026-08-18-hero-cta-equal-width.md) |
| `lib/copy-dashes.test.ts` | The em-dash sweep — catalogue strings, and every non-test source file with comments stripped | [2026-08-18](RESULT-2026-08-18-funnel-ui-polish.md) |
| `lib/structured-data.test.ts` | The JSON-LD builders — Organization, the OnlineStore/LocalBusiness node, WebSite, Product, Offer, the real return and shipping policies, the derived price validity, CollectionPage and ItemList, BreadcrumbList, and absolute URLs | [PLAN-seo-foundations.md](PLAN-seo-foundations.md), [PLAN-seo-audit-remediation.md](PLAN-seo-audit-remediation.md) |
| `lib/sitemap.test.ts` | The sitemap — all 49 products, ten categories, populated collections, the excluded checkout and API paths, priorities and dates | [PLAN-seo-foundations.md](PLAN-seo-foundations.md) |
| `lib/robots.test.ts` | `robots.txt` — the allow rule, the disallow list shared with the sitemap, and the absolute sitemap link | [PLAN-seo-foundations.md](PLAN-seo-foundations.md) |
| `lib/json-ld.test.tsx` | The rendered `application/ld+json` block — every graph parses back, and a hostile product name cannot close the script tag | [PLAN-seo-foundations.md](PLAN-seo-foundations.md) |
| `lib/no-fabricated-reviews.test.tsx` | That no rating or review survives anywhere — the catalogue file, the schema, the rendered `ld+json`, a product card, and every source file under `app/` and `components/` — plus the product page's `og:type` | [PLAN-seo-audit-remediation.md](PLAN-seo-audit-remediation.md) |
| `lib/security-headers.test.ts` | The six response headers and every CSP directive, including the five Cashfree origins the checkout needs and the development-only `unsafe-eval` | [PLAN-seo-audit-remediation.md](PLAN-seo-audit-remediation.md) |
| `lib/shop-indexing.test.ts` | Canonical URLs with the sort stripped, and `noindex, follow` on a facet that matches nothing | [PLAN-seo-audit-remediation.md](PLAN-seo-audit-remediation.md) |
