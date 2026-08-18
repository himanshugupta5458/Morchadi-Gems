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
