# PROJECT-STATE — context handoff

**Written:** 2026-08-21 (regenerated in full; the previous edition was written 2026-08-19 and
had gone materially stale — see §13)
**Purpose:** the single briefing a new conversation reads before touching this repository.
**Verified against:** the working tree at commit `cc865b9` on `main`, plus the uncommitted
changes of the consolidation-audit prompt that regenerated this file, read file by file.

## How to read this file

Every fact below was taken from a file in this repository, or from a command run against it,
and can be re-checked the same way. The file cites where each one lives.

Anything that cannot be established from inside the repository — a live-site state, a dashboard
setting, a business decision, an external account — is marked **[VERIFY WITH OWNER]** rather
than asserted. There are nine such items and they are listed together at the end. The previous
edition had eleven; two have since been answered and are recorded as answered rather than
silently dropped.

Where the repository contradicts itself, this file says so instead of picking a side.

---

## 1. What this is

Morchadi Gems is a production e-commerce jewellery store selling affordable artificial /
fashion jewellery in India. Guest checkout, INR only, ships across India.

| Fact | Value | Source |
| --- | --- | --- |
| Brand name | Morchadi Gems | `config/business.ts` |
| Legal entity | Morchadi Enterprise | `config/business.ts` |
| Founded | 2016 | `config/business.ts` |
| Registered address | 203, Sunpro Kedarnath, Mangyawas Road, Geetanjali Colony, Mansarovar, Jaipur, Rajasthan 302020, IN | `config/business.ts` |
| Support inbox | admin@morchadigems.com | `config/business.ts` |
| Phone / WhatsApp | +91 9358358834 / `919358358834` | `config/business.ts` |
| Jurisdiction | Jaipur, Rajasthan | `config/business.ts` |
| Business hours | Mon–Sat, 10:00–18:00 IST | `config/business.ts` |
| Social profiles | **none** — `socialProfileUrls: []`, deliberately empty until accounts exist | `config/business.ts` |
| Geo coordinates | 26.8505, 75.7628 — the comment states these are *approximated to the Mansarovar locality, not surveyed* | `config/business.ts` |
| Free shipping threshold | ₹799 (inclusive), otherwise ₹99 flat | `lib/config.ts` |
| Returns window | 7 days | `lib/config.ts` |

The storefront domain is morchadigems.com and the admin panel is
`admin.morchadigems.com`, a second hostname served by the same deployment
([ADR-041](decisions/ADR-041-admin-subdomain-and-auth.md)).

**A live discrepancy in the repository's own records still stands:** `DEPLOY.md` §3 uses
`https://www.morchadigems.com` as the canonical origin in every example table, while the
round-three audit (`docs/testing/RESULT-2026-08-19-seo-audit-round-three.md`) records that live
`www` returns `HTTP/2 307` to the apex `https://morchadigems.com/` and that the apex is what was
crawled. Which origin is canonical in the deployed Coolify env vars is **[VERIFY WITH OWNER]**.

---

## 2. Stack and architecture

All versions read from `package.json` (dependency ranges as declared; the resolved lockfile
may pin higher patches).

| Layer | Choice |
| --- | --- |
| Framework | Next.js **14.2.35**, App Router |
| React | ^18 |
| Language | TypeScript ^5, `strict: true`, no `any`, no `@ts-ignore` (`tsconfig.json`, `CLAUDE.md`) |
| Styling | Tailwind CSS ^3.4.1 |
| Tests | Vitest ^4.1.10 + @testing-library/react ^16.3.2 + jsdom |
| Images | `sharp` ^0.35.3 (dev dep, required inside the container for `next/image`) |
| Payments | `@cashfreepayments/cashfree-js` ^1.0.7, hosted-checkout **redirect** (`redirectTarget: "_self"`) |
| Database | **Postgres, for orders / CRM / admins only** ([ADR-040](decisions/ADR-040-postgres-for-orders.md)). Prisma **6.19.2**, five models, three committed migrations. Checkout writes to it and the admin panel reads and writes it. The catalogue is still `data/products.json`, shipped inside the image, and is the sole authority on price |
| Admin panel | **A working order-management panel**, not a foundation — see §5. Login, sessions, an order list with tabs/filters/search/pagination, and a per-order detail screen with status transitions, refunds, address correction and COD/RTO receipt tracking ([ADR-041](decisions/ADR-041-admin-subdomain-and-auth.md), [ADR-044](decisions/ADR-044-admin-order-detail-and-layout-split.md)). **Not a catalogue admin** — catalogue changes still ship as code |
| Accounts | **none for shoppers.** Guest checkout only, no login; each order mints a throwaway `guest_*` id for Cashfree. A `customers` row keyed on phone is a CRM record, not a credential ([ADR-042](decisions/ADR-042-order-capture-in-postgres.md)). One operator account exists, created by `npm run seed:admin` |
| Payment types | **prepaid only, from the storefront.** The `payment_type` enum carries `prepaid`, `cod` and `partial_cod`, and the admin panel's refund logic already branches on all three — but no checkout offers a choice and `captureOrder` writes `prepaid` unconditionally |
| Analytics | **GA4, installed** ([ADR-039](decisions/ADR-039-analytics-and-utm-attribution.md)) — `NEXT_PUBLIC_GA_MEASUREMENT_ID`, rendered by `components/GoogleAnalytics.tsx`, with `googletagmanager.com` allowed in the CSP. Unset renders no tag at all. First-touch UTM capture rides alongside it |
| Output | `output: "standalone"`, `poweredByHeader: false` (`next.config.mjs`) |
| Deploy | Coolify on a Hostinger VPS, single image from the root `Dockerfile` ([ADR-032](decisions/ADR-032-coolify-docker-deploy.md), [ADR-047](decisions/ADR-047-prisma-generate-in-docker-build.md), `DEPLOY.md`) |
| DNS / CDN | Cloudflare, **proxied**, per the owner. `DEPLOY.md` §4 requires **Full (strict)** and calls out that Flexible breaks the payment flow |
| Owner notifications | CallMeBot WhatsApp, optional and best-effort (`lib/notify.ts`) |
| Contact form | Web3Forms, `NEXT_PUBLIC_WEB3FORMS_KEY`; unset means the form validates and honestly says delivery is not connected ([ADR-012](decisions/ADR-012-static-and-policy-pages.md)) |

**Repository layout.** `app/` (42 files, of which 30 are `page.tsx` / `route.ts` route files),
`components/` (95), `lib/` (130 files, of which **75 are test files**), `types/` (6), `config/`
(2), `scripts/` (7), `prisma/` (schema plus 3 migrations), `data/`, `docs/`, `public/` (68
files). `middleware.ts` sits at the repository root, because Next 14 runs exactly one and only
from there.

**The storefront lives in a route group.** `app/(storefront)/` holds every shop page and
`app/admin/` holds the panel, so the two have sibling layouts rather than the panel being a
nested child of the shop's chrome ([ADR-044](decisions/ADR-044-admin-order-detail-and-layout-split.md)).
Paths quoted in older documents as `app/product/[id]/page.tsx` are now
`app/(storefront)/product/[id]/page.tsx`.

**Cashfree environment.** `lib/cashfree-config.ts` resolves the mode from `CASHFREE_ENV`, and
anything other than the exact string `production` falls back to **sandbox** — "going live is an
explicit act." The local `.env.local` in this workspace is a dev file and says nothing about
production. **What the Coolify runtime has set is [VERIFY WITH OWNER].**

**Domain-agnosticism (relevant to §9).** Every absolute URL the site emits — canonicals, the
sitemap, `robots.txt`, every schema `@id`, the Cashfree `return_url` — is derived from
`APP_BASE_URL` (falling back to `NEXT_PUBLIC_BASE_URL`, then localhost) in `lib/site-url.ts`
and `lib/cashfree-config.ts`. There is deliberately **no request-origin fallback** for the
prerendered URLs. The admin hostname is likewise read from `ADMIN_HOSTNAME`
(`lib/admin-routing.ts`), with `admin.morchadigems.com` as the fallback. Moving the build to
another domain is an env change plus a rebuild, not a code change.

---

## 3. Non-negotiable decisions

Each of these is enforced somewhere, not merely written down.

**Server-authoritative pricing.** The client sends product IDs, quantities and option
selections; the server prices them from `data/products.json` at request time. Any price, total
or item amount arriving from the client is untrusted and never used to create a payment order.
`CLAUDE.md`; `app/api/create-order/route.ts`; ADR-013; tests in `lib/order.test.ts`,
`lib/money-path.test.ts`.

**The catalogue is never in the database.** An order row records the price and the cost that
applied when it was placed; it is never the source consulted to decide what something costs.
ADR-040, restated in `prisma/schema.prisma`'s own header.

**Secrets never reach the client bundle.** `lib/cashfree-config.ts`, `lib/prisma.ts`,
`lib/order-capture.ts`, `lib/admin-auth.ts`, `lib/admin-session.ts`, `lib/order-id.ts`,
`lib/order-tracking.ts` and `lib/admin-order-*.ts` all open with `import "server-only"`, so
importing any of them from a `"use client"` file is a build error rather than a review catch.
Only `NEXT_PUBLIC_*` may appear client-side. `lib/notify-boundary.test.ts` asserts the stronger
property for the CallMeBot pair: no client module reaches them at any import depth.

**The database is off the critical path of a payment.** `captureOrder`,
`recordVerifiedPaymentStatus` and `findTrackingIdForCashfreeOrder` never throw — a dead Postgres
logs and returns a degraded value, and the checkout is byte-identical. ADR-042;
`lib/checkout-database-failure.test.ts`.

**Admin writes are validated on the server, not only in the form.** The lifecycle table, the
address-editable window, the refund ceiling and the receipt-toggle preconditions are all
re-derived from the order row inside the route handler; `changedBy` comes from the session and
can never come from the body. ADR-044; `lib/order-status-change.ts`, `lib/admin-order-updates.ts`.

**Middleware is a gate, not the authentication.** It runs on the Edge runtime and can only see
that *a* cookie was sent. Every protected page and every admin endpoint resolves the session
against Postgres on the Node runtime. ADR-041.

**`/track` selects only what a customer may see.** `changed_by`, `reason`, the name, phone,
address, payment type, both COD amounts, the Cashfree ids, the UTM triple, every line item and
`total_cost` are absent from the query and from the types, so a component cannot render what it
was never handed. ADR-045; `lib/order-tracking-page.test.tsx` asserts twenty such values are
absent from the rendered HTML.

**Honesty policy.** No "hallmarked", "certified", "916", "22K/18K solid", "sterling",
"precious", no karat on plated goods, no gemstone names for non-gemstones, no bare "pearls" for
imitation, no skin-friendly claim on German silver or bare brass. ADR-018; both skills in
`.claude/skills/`; `docs/CATALOGUE-DATA-TODO.md` exists precisely because gaps were recorded
rather than invented. Related: `lib/no-fabricated-reviews.test.tsx` and
`scripts/validate-products.mjs`.

**British spelling and Indian-English jewellery terms** throughout copy and metadata
("jewellery", "Colour", nath / kada / payal / jhumka).

**No em dashes in shopper-facing copy.** `lib/copy-dashes.test.ts` scans `app`, `components`,
`lib`, `config`, `types` and the product descriptions, with exactly one allowed exception
(`components/OrderTotals.tsx`, where a lone em dash is a numeric placeholder).

**No inline code comments; prose lives in JSDoc and `/docs`.** `CLAUDE.md`.

**CSP is Cashfree-safe and deliberately narrow.** `config/security-headers.mjs` allows `'self'`,
five Cashfree origins and `googletagmanager.com`. `'unsafe-inline'` on script and style is
Next's own bootstrap and critical CSS; `'unsafe-eval'` is development-only. Also shipped: HSTS,
`nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`,
and a `Permissions-Policy` denying camera, microphone and geolocation. ADR-034, ADR-039;
asserted in `lib/security-headers.test.ts`.
**Consequence: any further third-party tag added without editing that file will be silently blocked.**

**CallMeBot is off the critical path.** 5-second timeout, no retry, failures logged and
swallowed, credentials optional, and `/api/notify-admin` returns **200 whatever happens**.

**Full gate every prompt.** `npm run typecheck && npm run lint && npm run test:run &&
npm run validate:products && npm run build`, plus a `/docs` update and a `BUILD_LOG.md` row.

---

## 4. The catalogue

`data/products.json` — a flat JSON array, the single source of truth for prices. Re-counted on
2026-08-21 and **unchanged since the previous edition of this file**.

- **49 products**, ids `P001`–`P049`, contiguous.
- **Price range ₹49–₹499.** Every product carries `pricing.price`, `pricing.mrp` and
  `pricing.cost`. `cost` is never readable from any shopper-facing path.
- **6 out of stock:** P006, P008, P011, P015, P039, P040.
- **8 flagged `featured`** (Best Sellers) and **8 flagged `isNew`** (New Arrivals).
- **Images: 48 products have exactly one; P002 has two.** Files are `/products/P0NN.webp`.
- **5 products carry options; 44 are plain.**

**Record shape** (union of keys across all 49):

```
id, name, category, pricing{price, mrp, cost}, media{images[]}, options[]?,
specs{material, type, size?, closure?, stone?}, description, seo{...},
stock{inStock}, flags{featured, isNew}, collections[]?
```

**Categories** (11 in the vocabulary, 10 surfaced to shoppers — defined in `types/product.ts`,
counts from the data). `gift-hampers` is a valid category a record may carry that reaches no
shopper-facing surface until its first product ships; see
[ADR-055](decisions/ADR-055-category-vocabulary-and-surfacing.md):

| Category | Count |
| --- | --- |
| rings | 18 |
| earrings | 7 |
| nose-pins | 5 |
| bracelets | 5 |
| bangles | 3 |
| anklets | 3 |
| hair-accessories | 3 |
| necklaces | 2 |
| watches | 2 |
| pendants | 1 |
| gift-hampers | 0 — `pending`, not surfaced |

**Collections** (4 filter slugs, two hand-tagged and two derived): `gifting` and `anti-tarnish`
are tags a product opts into; `best-sellers` derives from `flags.featured` and `new-arrivals`
from `flags.isNew`. **8 products carry `anti-tarnish` and none carry `gifting`** — so `gifting`
is excluded from the sitemap by `getPopulatedCollectionPaths()` rather than publishing an empty
result page.

**Variant products (5).** Options never change price:

| Product | Option | Control | Values |
| --- | --- | --- | --- |
| P001 Wave Band Initial Ring | Letter | dropdown | 25 |
| P005 Silver-Tone Initial Signet Ring | Letter | dropdown | 22 |
| P006 Floating Locket Pendant | shape | chips | 4 |
| P010 Mini Watch Ring | Colour | swatch | 2 |
| P048 Satin Long Tail Bow Hair Clip | Colour | swatch | 4 |

---

## 5. What is done

Verified in code, not inferred from the log.

**The storefront funnel**, end to end: catalogue, shop with filters and facets, product pages
with variant selectors, cart, address, payment, Cashfree hosted checkout, and a confirmation
page that treats only a server-verified `PAID` as success.

**Order capture in Postgres** ([ADR-042](decisions/ADR-042-order-capture-in-postgres.md)).
`/api/create-order` writes the customer (found or created by phone), the order, one line item
per distinct product-and-choice, and the first status-history row. `/api/verify-order` updates
`cashfree_payment_status` and reads back the order number. Both writes are allowed to fail
without failing the checkout.

**Database health, and a decided answer per surface**
([ADR-048](decisions/ADR-048-database-health-and-failure-surfaces.md)). `/api/health` queries
Postgres — connectivity, then whether the `orders` table matches this image's Prisma Client —
and answers `200 healthy` or `503` with `unreachable` or `schema-mismatch`. It exists because
`/` renders from `products.json` and reports 200 through a total database outage, which made
"taking payments, recording nothing" a failure with no symptom. **It is not the container's
liveness probe and is documented as something never to wire up as one**: the shop is designed
to keep serving without Postgres. Alongside it, every surface that reads or writes the database
now has a decided failure behaviour — checkout and `/track` degrade silently, the login's
expiry sweep degrades, and the whole admin panel fails loudly in its own styled words.

**The ten-character order number** ([ADR-043](decisions/ADR-043-order-id-as-primary-identifier.md)).
`orders.id` over a 31-character alphabet with `0`, `O`, `1`, `I` and `L` excluded, minted from
`node:crypto` with a uniqueness check and a bounded retry. It is the order's public name; the
`MG_` Cashfree id is the payment's reference and appears as fine print.

**The admin panel** ([ADR-041](decisions/ADR-041-admin-subdomain-and-auth.md),
[ADR-044](decisions/ADR-044-admin-order-detail-and-layout-split.md)). Served on
`admin.morchadigems.com` by hostname rewriting in `middleware.ts`, inside this same deployment.
What it can do today:

| Surface | Capability |
| --- | --- |
| `/login` | bcrypt (cost 12), one failure message for every cause, a 600 ms failure floor, no username oracle |
| session | opaque 32-byte token, SHA-256 in `admin_sessions`, 7-day fixed expiry, `HttpOnly` + `SameSite=Lax` + environment-following `Secure`, swept on each login |
| `/orders` | Active / Resolved tabs, status filter, free-text search, date range, sort, pagination. Whole state in the URL; no JavaScript shipped |
| `/orders/{id}` | line items, totals, customer and delivery, full audit timeline, money panel, Cashfree ids |
| `/api/orders/{id}/status` | one transaction: transition + reason + refund settlement, guarded on the status the plan was made against |
| `/api/orders/{id}/address` | correction while the order is `placed` or `packed`, writing an audit row that names the fields that moved |
| `/api/orders/{id}/receipt` | independent RTO/return and COD-collection toggles, each with its own timestamp |
| `/logout` | deletes the row before clearing the cookie |
| `/robots.txt` | the subdomain's own deny-all file |

**Public order tracking** ([ADR-045](decisions/ADR-045-public-order-tracking.md)). `/track`
takes the order number alone, renders status, the dates statuses were reached and a refund only
once money actually moved, and is protected by an in-process sliding-window limiter at eight
lookups a minute. A track-order box also sits on the home page.

**Saved address in `localStorage`** ([ADR-046](decisions/ADR-046-saved-address-in-local-storage.md)),
and the frozen-customer-name bug fixed — a returning customer's name and email are now refreshed
from the order being placed, while first-touch attribution deliberately is not
(`docs/logs/2026-08-20-admin-shows-the-wrong-customer-name.md`).

**Analytics and attribution** ([ADR-039](decisions/ADR-039-analytics-and-utm-attribution.md)).
GA4 behind `NEXT_PUBLIC_GA_MEASUREMENT_ID`, first-touch UTM capture in `localStorage`, the
triple written to both the Cashfree `order_tags` and the `orders` / `customers` rows, and the
Google Tag host added to `script-src` in the same change that added the tag.

**SEO.** Per-product metadata for all 49, a 70-URL sitemap, `robots.txt`, Organization /
OnlineStore / WebSite / Product / BreadcrumbList / ItemList / CollectionPage JSON-LD, no
fabricated reviews anywhere, and the security-header pass. ADR-029, ADR-034, ADR-036.

**Mobile.** Two dedicated passes, ADR-031 and ADR-033.

**Policy disclaimers removed.** ADR-037; the policies read as in effect.

**Containerised build proven.** `output: "standalone"`, a three-stage Dockerfile, the two
standalone copy gotchas, and — as of [ADR-047](decisions/ADR-047-prisma-generate-in-docker-build.md),
2026-08-21 — an explicit `RUN npx prisma generate` in the builder stage, without which the image
build fails type-checking on the first `import type { OrderStatus } from "@prisma/client"`.

**Developer tooling.** `npm run dev:all` starts Docker Postgres, waits for genuine health,
applies pending migrations and starts the dev server. `npm run seed:admin` creates the operator
account behind a non-echoing terminal prompt.

**Gate status, re-run on 2026-08-21 after the database-health prompt:**

| Command | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | no ESLint warnings or errors |
| `npm run test:run` | **1261 passed, 75 files** |
| `npm run validate:products` | **PASS**, with 3 standing advisory blocks: 9 discounts above the 60% house style (real owner prices), 4 descriptions outside the word range, 9 products quoting an amount in search or social copy |
| `npm run build` | clean, 75/75 static pages |

**Documentation state (2026-08-21):** **47 ADRs** on disk, numbered `ADR-001`–`ADR-048`
(**there is no ADR-014**, and slot 031 was claimed twice — both recorded in
[`docs/decisions/README.md`](decisions/README.md)); `BUILD_LOG.md` at **56 prompt rows**;
**9 API contracts**; **18 test plans** and **32 test results**; **3 diagnosis logs**.
Git: **34 commits** on `main`, remote `github.com/himanshugupta5458/Morchadi-Gems`.

---

## 6. Pending, to close Phase 1

**Analytics is installed.** This section previously said it was not; that was true on
2026-08-19 and stopped being true at ADR-039. GA4 is the chosen vendor — the previous edition's
"GA4 vs Plausible is undecided" is answered and no longer a [VERIFY WITH OWNER] item.

Two things that remain open on the analytics thread:

1. Whether a measurement id is actually set in Coolify's **build** column — a value set only at
   runtime does nothing, because Next inlines `NEXT_PUBLIC_*` at compile time.
   **[VERIFY WITH OWNER].**
2. Search Console verification, which cannot be seen from the HTML. **[VERIFY WITH OWNER].**

**Latest audit score: 69/100**, recorded in
`docs/testing/RESULT-2026-08-19-seo-audit-round-three.md` (technical 88, content 52, on-page 68,
schema 90, performance 82, AI search 42, images 55). That is a repository record of a crawl run
on 2026-08-19, not a live reading, and it predates the analytics work that answered its C1.
**Whether it still holds is [VERIFY WITH OWNER]**, and a re-audit is the way to answer it.

Other open findings from that audit, all documented there: 15 meta descriptions on the homepage
and collection pages are 179–193 characters against a ~155–160 display limit (H3); collection
titles waste the character budget (H4); 48 of 49 products have a single photograph (H5, a
photography commission, no code needed); there are no informational pages that can rank for a
question (H6); the related-products fallback dead-ends on P006 (M1); and the WhatsApp share
preview has not been eyeballed (M4).

---

## 7. Phase 1.5 — final go-live

The ordering is the owner's. Two of the four are now reported done.

1. **Cloudflare CDN flip — done**, per the owner. `DEPLOY.md` §4 holds the settings that must
   go with it (Full (strict), Always Use HTTPS, no Rocket Loader). Whether checkout has been
   re-tested end to end *since* the flip is **[VERIFY WITH OWNER]** — that is exactly what the
   flip can break.
2. **Firewall and SSH hardening on the VPS — done**, per the owner. Not covered anywhere in
   this repository, and it is host configuration rather than code, so nothing here can confirm
   or contradict it.
3. **Production Cashfree swap — open.** Real keys from the production tab, whitelist the domain,
   set the business name on the account, rotate the secret, and run a real-money smoke test. Set
   `CASHFREE_ENV=production` in Coolify's **runtime** column; `APP_BASE_URL` must be set in
   **both** the build and runtime columns to the same value (`DEPLOY.md` §3).
   **[VERIFY WITH OWNER].**
4. **Marketing** last.

---

## 8. v2 — what has landed and what has not

**There is still no v2 plan document in this repository.** The sequence below is the owner's
stated plan, carried here so a new conversation knows the intended direction.

1. **Database — largely done.** ADR-040 took the decision, the schema landed, admin sessions
   landed, and real checkout traffic fills the tables. What remains from the original item is
   the production operations half: **`prisma migrate deploy` is not automated anywhere** — not
   in the Dockerfile, not in an entrypoint, not in a Coolify pre-deploy hook — and there is no
   backup policy in the repository. ADR-047 names this as still outstanding. See §13 item 2.
2. **CRM — done for orders.** The order list and the order detail screen both exist and both
   read and write the tables. Enquiries and analytics dashboards do not.
3. **Transactional emails and order tracking.** Tracking is **done** (ADR-045). Transactional
   email is not built at all; the CallMeBot WhatsApp message to the owner and the Cashfree
   dashboard remain the fallback that makes a failed capture recoverable.
4. **S3 or MinIO for media, plus a catalogue admin** — not started. This is the item that would
   retire "catalogue changes ship as code", and ADR-040 and ADR-041 both explicitly decline to
   do so in the meantime.

---

## 9. Strategic thread — two-site consolidation

**What the repository independently confirms.** The round-three audit finding **H1** records
that a search for `"Morchadi Gems" jewellery` returns **morchadijewels.com** and does **not**
return morchadigems.com; that the two sites sell the same catalogue shape; that they publish
different contact details (`support@morchadijewels.com`, `+91 7877866212`, free shipping above
₹1499 versus this site's `admin@morchadigems.com`, `+91 9358358834`, ₹799); and that a GST
registration for **MORCHADI ENTERPRISES** (`08BBYPG5053R1ZO`, Rajasthan) surfaces alongside,
against this site's declared `legalName: "Morchadi Enterprise"`. The audit explicitly says it
**cannot** determine from outside whether these are one business or two.

**What the owner has stated** (not verifiable here, **[VERIFY WITH OWNER]**): both sites are
theirs; morchadijewels.com runs on Odoo, is the established site, currently owns the brand SERP,
and uses Odoo essentially as a storefront rather than as deep ERP. The plan is to build out
fully on morchadigems.com now, then **later consolidate to a single site** by moving this
Next.js build onto morchadijewels.com as the authoritative domain, rebranding "Morchadi Gems"
to "Morchadi Jewels", 301-migrating the old Odoo URLs, completing the catalogue, and winding
Odoo down.

**This is not a current blocker. Build proceeds as Morchadi Gems.**

**Build principle to maintain:** keep everything domain-agnostic and, as far as practical,
brand-name-driven from config, so the eventual move is a configuration change rather than a
find-and-replace.

Honest current state of that principle:

- **Domain: clean.** Nothing hardcodes an origin. `lib/site-url.ts` and
  `lib/cashfree-config.ts` derive every absolute URL from `APP_BASE_URL` /
  `NEXT_PUBLIC_BASE_URL`, and `lib/admin-routing.ts` reads the admin hostname from
  `ADMIN_HOSTNAME`. A domain move is env plus **rebuild** — canonicals, the sitemap, robots and
  schema `@id`s are prerendered.
- **Brand name: mostly, not fully.** `config/business.ts` holds `brandName` and `lib/config.ts`
  derives the site title, description, WhatsApp greeting and OG alt from it. Literal strings
  remain and would each need editing: `components/Wordmark.tsx`, the `description` metadata of
  `/cart`, `/address` and `/order-confirmation`, display copy on the home and about pages,
  `DEFAULT_SUBJECT` in `lib/contact.ts`, and 3 product records whose copy names the brand. Two
  more since the previous edition: `DEFAULT_ADMIN_HOSTNAME` in `lib/admin-routing.ts` and the
  admin layout's `"Morchadi Gems admin"` title template. Cashfree order ids are prefixed `MG_`,
  and existing ids would keep that prefix after any rename.
- **Catalogue completeness** relative to the Odoo site: **[VERIFY WITH OWNER]**.

---

## 10. Catalogue data TODO

`docs/CATALOGUE-DATA-TODO.md` is the open list of real product values the catalogue is still
missing. Nothing on it can be answered from inside the repository, and **none of it may be
invented** — an invented chain length is a returns problem and a consumer-law problem.

Its four priority items: bangle **size variants (2.4 / 2.6 / 2.8)** for **P043** and **P042**;
whether **P034**'s hoop **requires a pierced nose**; and whether **P041** is priced as a **pack
of 4 or 8**.

Beyond those: ring diameters for the "free size" fixed-band rings; chain, drop and anklet
**lengths**; a **pierced-ears-only notice** on the stud listings; watch strap, dial, battery and
**water-resistance** ratings; the four missing descriptions (P001, P022, P032, P042); and a set
of open naming decisions. Read that file rather than summarising from this one.

---

## 11. The content pipeline

The intended shape, of which the skills half exists:

```
product images
  -> Gemini, honesty-constrained, extracts structured product data
  -> .claude/skills/product-skills.md   writes the description
  -> .claude/skills/meta-skills.md      writes title, meta, alt, OG
     (reading a site-wide keyword map, enforcing the no-collision rule)
  -> data/products.json
```

The meta skill runs **after** the description exists and treats the description and specs as
source truth. Both skills read only from `data/products.json` and refuse to claim anything the
specs do not support.

Today this is **manual**: a human runs the skills and the results are committed. Automating it
is v2 work. A standalone site-wide keyword-map file was not found in the repository, so where it
currently lives is **[VERIFY WITH OWNER]**.

> **Resolved, 2026-08-23 (prompt 68).** It lived nowhere, and now it lives at
> **`data/keyword-map.json`** — derived from `data/products.json` by
> `scripts/backfill-keyword-map.mjs` (`npm run backfill:keyword-map`), queried by
> `lib/keyword-collision-check.ts`, and rebuilt-and-compared by `scripts/validate-products.mjs`
> on every gate run so it cannot go stale. An exact match against another published product's
> `primaryKeyword` is a hard block; secondary overlap and near-matches are advisory. **No hard
> collision exists among the 49** — see the
> [ADR-036 addendum](decisions/ADR-036-product-seo-metadata-pass.md#addendum-2026-08-23--the-site-wide-keyword-map-now-exists).
> The skill's per-batch ledger is unchanged and still governs a single writing session; the map
> is what makes the rule answerable *between* sessions.

> **Extended, 2026-08-23 (prompt 69).** The diagram above describes the *fresh-image* path. The
> real pipeline is now two phases and both intake paths converge on the same one
> ([ADR-051](decisions/ADR-051-draft-a-content-pipeline.md),
> [ADR-053](decisions/ADR-053-draft-a-to-product-orchestration.md)):
>
> ```
> raw listing text, or images + owner notes
>   -> .claude/skills/draft-a-skills.md         Phase 1: one Draft A object per product
>   -> scripts/validate-draft-a.mjs             structure and provenance
>   -> OWNER REVIEW                             every attribute confirmed, price and images set
>   -> .claude/skills/draft-a-to-product-skills.md
>        gate  validatePublishReadiness         refuses an unreviewed draft
>        write product-skills.md                name and description
>        write meta-skills.md                   SEO, checked against data/keyword-map.json
>        gate  lib/content-similarity.ts        ADVISORY ONLY, never blocks today
>        map   lib/draft-a-to-product.ts        attributes -> specs, images -> media
>   -> data/products.json, as status: "draft"
>   -> HUMAN READS THE RECORD
>   -> npm run publish:product PNNN             status -> active, map regenerated, draft filed
> ```
>
> **The similarity gate is advisory and blocks nothing.** `SIMILARITY_THRESHOLD` in
> `lib/content-similarity.ts` is `null`; every score is computed and written to
> `content-pipeline/drafts/{id}-similarity.json` on every run, and nothing is refused. The
> blocking path is implemented and tested, so turning it on is one assignment. **Setting a real
> number requires a calibration run against the owner's actual final catalogue, not the 49 test
> products** — that is a future decision and its own ADR. **[VERIFY WITH OWNER]** when the
> migrated catalogue is large enough to calibrate against.
>
> Still true: **no Draft A object has ever been created in this repository.** Everything above is
> a mechanism tested on synthetic fixtures and never run on real product data.
> `data/stone-terms.json` still does not exist.

---

## 12. Working conventions

- **One Claude Code prompt at a time**, in a single Codespace.
- Prompts are handed over as **a single copy-pasteable code block**.
- Output is **pasted back for review** before anything is committed.
- **Full gate every prompt**, before claiming done:
  `npm run typecheck && npm run lint && npm run test:run && npm run validate:products && npm run build`.
- **Commit and push only after green.** Coolify auto-redeploys from `main`
  ([VERIFY WITH OWNER] that auto-deploy is switched on).
- **Every prompt updates `/docs`**, at minimum a row appended to
  `docs/progress/BUILD_LOG.md`, plus an ADR for a decision, an API doc for a route change, a
  design doc for a token, a log for a debugging session, a test doc for tests. `CLAUDE.md` has
  the full table.
- **Act autonomously** inside the repository; pause only for a genuine external blocker.

---

## 13. Known gaps in the code, as of this regeneration

Carried here so a new conversation does not rediscover them. They were raised by the
consolidation audit of 2026-08-21 — the full prioritised report is in row 55 of
[`BUILD_LOG.md`](progress/BUILD_LOG.md) — and **three of the five were closed the same day** by
[ADR-048](decisions/ADR-048-database-health-and-failure-surfaces.md) (row 56), which also closed
the audit's finding 9 and *decided* the fourth rather than leaving it open. Only the `npm audit`
picture is untouched.

**Closed.**

1. ~~Admin API routes have no error boundary.~~ The three order-action handlers share
   `runAdminOrderAction`, which wraps the session read as well as the write and answers
   `503 DATABASE_UNAVAILABLE` or `500 SERVER_ERROR` in the shape their contracts describe.
2. ~~`deleteExpiredAdminSessions()` is awaited with no catch.~~ The login route calls
   `sweepExpiredAdminSessions()`, which cannot fail a login.
3. ~~`/track` and both admin pages read Prisma without a catch.~~ Decided per surface rather
   than uniformly: `/track` degrades to its own not-found copy, and the panel — both pages plus
   the protected layout that renders before them — shows a styled "The order database did not
   answer" state that says orders are still arriving unrecorded.
4. ~~`updateAdminOrderReceipt` can throw an unhandled `P2025`.~~ It is now a status-guarded
   `updateMany` returning `CONCURRENT_CHANGE`, like its two siblings.

**Still open.**

5. **`prisma migrate deploy` against production is entirely manual**, and ADR-048 decided to
   keep it that way: the runtime image has no `prisma` CLI, adding one costs ~115 MB and puts
   Postgres on every container's boot path. What changed is that forgetting it is no longer
   invisible — `/api/health` reports `schema-mismatch` from outside the deployment, and
   [`DEPLOY.md`](../DEPLOY.md) §5a ends with that check.
6. **Nothing watches `/api/health` automatically.** The route exists and returns `503` honestly;
   whether an uptime monitor is pointed at it, and whether Coolify's own health-check path is
   still `/` rather than something that would couple the shop's uptime to Postgres, are both
   dashboard facts this repository cannot read. `DEPLOY.md` §5b is the manual step.
   **[VERIFY WITH OWNER]**
7. **`npm audit` reports 5 high-severity packages.** Three (`prisma`, `@prisma/config`,
   `deepmerge-ts`/`effect`) are the CLI-only set assessed before. The fourth is `next` itself,
   carrying **21 distinct advisories** against 14.2.35 — all in the production tree, and a
   materially different picture from the last assessment. The only offered fix is Next 16, a
   major version.
8. **There is still no backup policy for the orders table.** ADR-048 makes an outage visible; it
   does not make the data recoverable. See item 4 of the list below.

---

## Everything marked [VERIFY WITH OWNER]

1. **Live site status** — whether morchadigems.com is currently up and serving.
2. **Canonical origin in production** — apex or `www`. `DEPLOY.md` says `www`; the round-three
   audit observed `www` 307ing to the apex.
3. **Production Cashfree state** — whether `CASHFREE_ENV` is `production` in Coolify, whether
   live keys are in place, the domain whitelisted, and the business name set on the account. The
   repository can only show that sandbox is the fail-safe default.
4. **Production Postgres** — that it is provisioned in Coolify, what `DATABASE_URL` the runtime
   holds, whether the three committed migrations have been applied to it, whether the operator
   account has been seeded there, and whether any backup policy exists.
5. **Cloudflare SSL/TLS mode** — the proxy is on, per the owner; that the mode is **Full
   (strict)** and not Flexible cannot be read from here, and Flexible breaks the payment flow.
6. **Coolify auto-deploy** — whether a push to `main` actually triggers a redeploy.
7. **Current audit score** — 69/100 is the 2026-08-19 record, not a live reading, and it
   predates the analytics work.
8. **Search Console** — whether the property has since been verified by DNS TXT.
9. **The two-site consolidation** — that both storefronts are the owner's, that Odoo is used as
   a storefront rather than deep ERP, the timing of the domain move and rebrand, the 301 map,
   and how much of the Odoo catalogue is still missing here.

Plus, by construction, **every line of `docs/CATALOGUE-DATA-TODO.md`**.

### Answered since the previous edition

- **Analytics vendor** — GA4, chosen and shipped in ADR-039.
- **VPS firewall and SSH hardening** — reported done by the owner.
- **Cloudflare proxy** — reported on by the owner. The SSL/TLS *mode* remains item 5 above.
