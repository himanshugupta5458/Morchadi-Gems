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
- **Environment:** local / container build, Cashfree sandbox or production

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
| [PLAN-catalogue-ia.md](PLAN-catalogue-ia.md) | [2026-08-18](RESULT-2026-08-18-catalogue-ia.md) — two-tier catalogue IA |
| *(no plan — data import verification)* | [2026-08-18](RESULT-2026-08-18-product-catalogue-real-import.md) — the owner's real catalogue imported under P-code ids |
| *(no plan — data correction)* | [2026-08-18](RESULT-2026-08-18-all-real-catalogue.md) — the last invented products removed, all 49 real |
| *(no plan — regression guards)* | [2026-08-18](RESULT-2026-08-18-funnel-ui-polish.md) — funnel UI polish, 480/480 pass |
| *(no plan — regression guard)* | [2026-08-18](RESULT-2026-08-18-button-padding.md) — button padding verified against the emitted CSS, 481/481 pass |
| *(no plan — regression guard)* | [2026-08-18](RESULT-2026-08-18-hero-cta-equal-width.md) — hero paired CTAs equal width, 485/485 pass |
| [PLAN-product-schema-migration.md](PLAN-product-schema-migration.md) | [2026-08-18](RESULT-2026-08-18-product-schema-migration.md) — 49/49 pass, 543/543 suite |
| [PLAN-seo-foundations.md](PLAN-seo-foundations.md) | [2026-08-18](RESULT-2026-08-18-seo-foundations.md) — 58/58 pass, 601/601 suite |
| *(no plan — regression guard)* | [2026-08-19](RESULT-2026-08-19-mobile-scale.md) — the mobile type and spacing scale, desktop verified unchanged, 676/676 suite |
| *(no plan — deployment verification)* | [2026-08-19](RESULT-2026-08-19-container-build.md) — containerised production build, 43/43 as expected, 653/653 suite |
| *(no plan — regression guard)* | [2026-08-19](RESULT-2026-08-19-mobile-layout.md) — four mobile layouts differing in kind, plus a pre-existing overflow bug, 690/690 suite |
| [PLAN-seo-audit-remediation.md](PLAN-seo-audit-remediation.md) | [2026-08-19](RESULT-2026-08-19-seo-audit-remediation.md) — 70/70 pass, 735/735 suite |
| *(no plan — live-site audit)* | [2026-08-19](RESULT-2026-08-19-seo-audit-followup.md) — post-remediation SEO audit, 66/100, 3 criticals live, no code changed |
| *(no plan — content and data correction)* | [2026-08-19](RESULT-2026-08-19-catalogue-content-pass.md) — catalogue content pass, 15/15 pass, 747/747 suite |
| *(no plan — metadata pass)* | [2026-08-19](RESULT-2026-08-19-product-seo-metadata.md) — per-product search and social metadata for all 49, 762/762 suite |
| *(no plan — live-site audit)* | [2026-08-19](RESULT-2026-08-19-seo-audit-round-three.md) — third-round SEO audit, no code changed |
| *(no plan — schema verification)* | [2026-08-20](RESULT-2026-08-20-orders-crm-schema.md) — the orders/CRM migration applied and inspected in Postgres, `pricing.cost` proven absent from the built bundle, 814/814 suite |
| [PLAN-admin-auth.md](PLAN-admin-auth.md) | [2026-08-20](RESULT-2026-08-20-admin-auth.md) — admin login, sessions and subdomain routing, 73/73 pass, two defects found live and fixed, 895/895 suite |
| [PLAN-admin-auth.md](PLAN-admin-auth.md) — *Seed script prompts* | [2026-08-20](RESULT-2026-08-20-seed-admin-prompt.md) — the hidden password prompts made visible again, 20/20 pass, the regression test proven to fail on the old code, 907/907 suite |
| *(no plan — developer tooling)* | [2026-08-20](RESULT-2026-08-20-dev-all-command.md) — `npm run dev:all`, 38/38 pass plus five real runs including a cold start and a fresh volume, 945/945 suite |

## Runners

Two, answering different questions. Both must be green; neither replaces the other.

| Command | Covers |
| --- | --- |
| `npm run validate:products` | The **data** — `data/products.json` shape, conventions, and the image files it points at |
| `npm run test:run` | The **logic** — Vitest unit tests over `lib/`. `npm test` for watch mode |

Vitest is configured in `vitest.config.mts` and picks up `lib/**/*.test.{ts,tsx}`.

`vitest.config.mts` aliases `server-only` to that package's own `empty.js`. Next.js does the same
thing through the `react-server` export condition; plain Node resolution does not, so without the
alias importing any server-only module from a test throws on import. It is what lets the two
Prisma suites and the two admin suites import [`lib/prisma.ts`](../../lib/prisma.ts) at all.

Four suites need a reachable Postgres — `lib/prisma-connection.test.ts`, `lib/prisma-schema.test.ts`,
`lib/admin-session.test.ts` and `lib/admin-auth.test.ts` — and every one of them **skips with a
printed reason rather than failing** when there is none, so a fresh clone and a CI runner still
exit 0. Each cleans up after itself: the schema suite rolls its transaction back, and the two
admin suites delete the throwaway admin they created.

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
| `lib/robots.test.ts` | `robots.txt` — the allow rule, the disallow list shared with the sitemap, the absolute sitemap link, and the admin subdomain's own deny-all file | [PLAN-seo-foundations.md](PLAN-seo-foundations.md), [PLAN-admin-auth.md](PLAN-admin-auth.md) |
| `lib/json-ld.test.tsx` | The rendered `application/ld+json` block — every graph parses back, and a hostile product name cannot close the script tag | [PLAN-seo-foundations.md](PLAN-seo-foundations.md) |
| `lib/no-fabricated-reviews.test.tsx` | That no rating or review survives anywhere — the catalogue file, the schema, the rendered `ld+json`, a product card, and every source file under `app/` and `components/` — plus the product page's `og:type` | [PLAN-seo-audit-remediation.md](PLAN-seo-audit-remediation.md) |
| `lib/product-copy.test.ts` | The approved descriptions — word range, paragraph storage, no copy-pass review metadata — plus the catalogue's material honesty (no karat, hallmark, 916 or sterling claim; no cubic zirconia called crystal; every "Silver" name qualified), now swept across the `seo` strings as well | [2026-08-19](RESULT-2026-08-19-catalogue-content-pass.md) |
| `lib/product-seo.test.ts` | The per-product `seo` block — every field measured in code points against the bound for its surface, no duplicate `metaTitle` or primary keyword, one alt per photograph, the honesty rules applied to the metadata, and what `generateMetadata` actually publishes including the Twitter mirror and the absolute title | [2026-08-19](RESULT-2026-08-19-product-seo-metadata.md) |
| `lib/security-headers.test.ts` | The six response headers and every CSP directive, including the five Cashfree origins the checkout needs and the development-only `unsafe-eval` | [PLAN-seo-audit-remediation.md](PLAN-seo-audit-remediation.md) |
| `lib/shop-indexing.test.ts` | Canonical URLs with the sort stripped, and `noindex, follow` on a facet that matches nothing | [PLAN-seo-audit-remediation.md](PLAN-seo-audit-remediation.md) |
| `lib/catalogue-ia.test.ts` | The two-tier IA — the category tier, the collection tier, and the two nav dropdowns built from them | [PLAN-catalogue-ia.md](PLAN-catalogue-ia.md) |
| `lib/product-schema.test.ts` | The migrated record shape — grouped fields, option groups, per-variant images, multi-image products, and `toCatalogueEntry` | [PLAN-product-schema-migration.md](PLAN-product-schema-migration.md) |
| `lib/product-gallery.test.tsx` | The thumbnail strip, `resolveVariantImage`, the per-variant swap, and the cart line's thumbnail | [PLAN-product-schema-migration.md](PLAN-product-schema-migration.md) |
| `lib/option-controls.test.tsx` | The four named option controls — dropdown, swatch, pills, chips — and the contract every one of them keeps | [PLAN-product-schema-migration.md](PLAN-product-schema-migration.md) |
| `lib/money-path.test.ts` | The money path end to end — what the pricing catalogue may carry, a tampered request, and that a recorded choice, a variant image or a second gallery image changes no amount | [PLAN-order-pricing.md](PLAN-order-pricing.md), [PLAN-product-schema-migration.md](PLAN-product-schema-migration.md) |
| `lib/verify.test.ts` | Payment verification — Cashfree status normalisation and its fail-closed default, `order_amount` reading, order-id shape, response parsing, the stale-bundle guard, and failure descriptions | [verify-order contract](../api/verify-order.md) |
| `lib/order-confirmation.test.tsx` | `/order-confirmation` in every state — unusable link, verification in flight, PAID, PENDING, FAILED, NOT_FOUND, and when our own verification cannot answer | [verify-order contract](../api/verify-order.md) |
| `lib/notify.test.ts` | The admin order message, the CallMeBot URL, credential reading, and dispatch | [notify-admin contract](../api/notify-admin.md) |
| `lib/notify-client.test.tsx` | The notified flag, notifying on a paid order, and that the notification never reaches the customer | [notify-admin contract](../api/notify-admin.md) |
| `lib/notify-boundary.test.ts` | That the CallMeBot key never crosses into the browser bundle | [notify-admin contract](../api/notify-admin.md) |
| `lib/contact.test.ts` | Contact-form validation — the reused checkout validators, subject and message bounds, the aggregate validator, and the Web3Forms payload | — |
| `lib/contact-form.test.tsx` | `/contact` — validation, and the two branches with and without a Web3Forms key | — |
| `lib/wordmark.test.tsx` | `Wordmark`, including the text variant used on dark grounds | — |
| `lib/responsive-scale.test.ts` | The mobile scale's class pairs, and that no desktop breakpoint value moved | [2026-08-19](RESULT-2026-08-19-mobile-scale.md) |
| `lib/mobile-layout.test.tsx` | The mobile product cap and the four layouts that differ in kind from desktop | [2026-08-19](RESULT-2026-08-19-mobile-layout.md) |
| `lib/prisma-connection.test.ts` | That the Prisma singleton opens a real connection to the local Postgres and answers `SELECT 1`, and that one client survives a module re-evaluation. **Skips rather than fails when no database is reachable** — a fresh clone and CI have no Docker Postgres, and a connectivity check must not become a gate they cannot pass | [ADR-040](../decisions/ADR-040-postgres-for-orders.md), [DEV-DATABASE.md](../DEV-DATABASE.md) |
| `lib/admin-routing.test.ts` | The admin panel's address — `ADMIN_HOSTNAME` resolution, `Host` and `X-Forwarded-Host` parsing, which hostnames count as a development machine, the public URL of every admin page on both, and `decideAdminRoute` across the admin subdomain, the storefront domain and localhost. Also drives `middleware.ts` itself with real `NextRequest`s and asserts the rewrite, redirect and pass-through headers it emits | [PLAN-admin-auth.md](PLAN-admin-auth.md), [ADR-041](../decisions/ADR-041-admin-subdomain-and-auth.md) |
| `lib/admin-session.test.ts` | Sessions — creation, the seven-day expiry, that the token is stored only as a SHA-256 digest, validation of unknown/empty/expired tokens, destruction of one session and of all of an admin's, the expiry sweep, and the cookie attributes including `Secure` following the environment. **Skips with no database**, like the Prisma suites | [PLAN-admin-auth.md](PLAN-admin-auth.md), [admin-login contract](../api/admin-login.md) |
| `lib/admin-auth.test.ts` | Login and logout end to end through the real route handlers — bcrypt hashing and salting, correct credentials, and the anti-enumeration contract: wrong password and unknown username answered with **byte-identical** bodies at the same status, above the same timing floor. **Skips with no database** | [PLAN-admin-auth.md](PLAN-admin-auth.md), [admin-login contract](../api/admin-login.md), [admin-logout contract](../api/admin-logout.md) |
| `lib/seed-admin-prompt.test.ts` | The terminal reader behind `npm run seed:admin` — that a question is written and **nothing afterwards erases it**, that a secret is never echoed in whole or in part, that a backspace is erased when visible and silent when hidden, that arrow keys are dropped rather than typed, that three consecutive prompts each appear, and that a pasted CRLF or type-ahead cannot answer the following prompt. Drives `scripts/tty-prompt.mjs` with ordinary streams, which is possible only because it takes them as arguments | [PLAN-admin-auth.md](PLAN-admin-auth.md), [2026-08-20](RESULT-2026-08-20-seed-admin-prompt.md), [log](../logs/2026-08-20-password-prompt-never-appears.md) |
| `lib/dev-stack-plan.test.ts` | The decision logic behind `npm run dev:all` — whether `DATABASE_URL` is the local Docker Postgres or a remote server no local command should touch, which compose service publishes its port, and what a container's state and health mean for the wait. **Only `healthy` ends the wait**; a merely running container, and a service with no healthcheck at all, are both refused rather than assumed ready. Three cases guard the boundary instead: that `dev-stack` appears in neither the `Dockerfile` nor `build` nor `start`. Drives `scripts/dev-stack-plan.mjs`, which is pure by design so the suite needs no Docker daemon and no remote database | [2026-08-20](RESULT-2026-08-20-dev-all-command.md), [DEV-DATABASE.md](../DEV-DATABASE.md) |
| `lib/prisma-schema.test.ts` | That the orders/CRM schema accepts writes matching its own shape — a customer, order, line item and status-history row through the generated client, the declared defaults, `Json` round-trips, and a `returned` order with an orthogonal refund. Each case runs inside an interactive transaction unwound by a thrown sentinel, so it leaves the database exactly as it found it. Skips with no database, like its sibling | [ADR-040](../decisions/ADR-040-postgres-for-orders.md), [2026-08-20](RESULT-2026-08-20-orders-crm-schema.md) |
