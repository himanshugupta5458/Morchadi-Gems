# PROJECT-STATE — context handoff

**Written:** 2026-08-19
**Purpose:** the single briefing a new conversation reads before touching this repository.
**Verified against:** the working tree at commit `921ca5d` on `main` (clean), read file by file.

## How to read this file

Every fact below was taken from a file in this repository and can be re-checked there. The
file cites where each one lives.

Anything that cannot be established from inside the repository — a live-site state, a dashboard
setting, a business decision, an external account — is marked **[VERIFY WITH OWNER]** rather
than asserted. There are eleven such items and they are listed together at the end.

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

The domain is morchadigems.com. **Note a live discrepancy in the repository's own records:**
`DEPLOY.md` §3 uses `https://www.morchadigems.com` as the canonical origin in every example
table, while the round-three audit (`docs/testing/RESULT-2026-08-19-seo-audit-round-three.md`)
records that live `www` returns `HTTP/2 307` to the apex `https://morchadigems.com/` and that
the apex is what was crawled. Which origin is canonical in the deployed Coolify env vars is
**[VERIFY WITH OWNER]**.

Whether the site is currently up, and what its production env values are, cannot be read from
here: **[VERIFY WITH OWNER]**.

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
| Database | **Postgres, for orders/CRM/admins only** (ADR-040, prompt 43). Checkout now writes to it: `/api/create-order` captures the customer, order, line items and first status-history row, and `/api/verify-order` updates the payment status (ADR-042, prompt 48). Both writes are **off the critical path** — a dead database cannot fail a checkout. Local `docker compose` today; **production Postgres is not provisioned yet**. The catalogue is still `data/products.json`, shipped inside the image, and is the sole authority on price |
| Admin panel | **Authentication foundation only** (ADR-041, prompt 45) — a login page, a session and a placeholder dashboard on `admin.morchadigems.com`, served by this same deployment via hostname rewriting in `middleware.ts`. No order-management UI yet. **The subdomain does not resolve: DNS and Coolify are a later prompt.** Catalogue changes still ship as code |
| Accounts | **none for shoppers.** Guest checkout only, no login; each order mints a throwaway `guest_*` id for Cashfree. A `customers` row keyed on phone is a CRM record, not a credential (ADR-042). One operator account exists, created by `npm run seed:admin` |
| Payment types | **prepaid only.** The `payment_type` enum and the COD amount/return-receipt columns exist on `orders` (ADR-042) but **no checkout offers a choice and no route writes anything but `prepaid`** |
| Output | `output: "standalone"`, `poweredByHeader: false` (`next.config.mjs`) |
| Deploy | Coolify on a Hostinger VPS, single image from the root `Dockerfile` (ADR-032, `DEPLOY.md`) |
| DNS / CDN | Cloudflare is documented as a supported front in `DEPLOY.md` §4, with **Full (strict)** required and Flexible called out as breaking the payment flow. Whether the record is currently proxied is **[VERIFY WITH OWNER]** |
| Owner notifications | CallMeBot WhatsApp, optional and best-effort (`lib/notify.ts`) |
| Contact form | Web3Forms, `NEXT_PUBLIC_WEB3FORMS_KEY`; unset means the form validates and honestly says delivery is not connected (ADR-012) |

**Repository layout** matches `CLAUDE.md`: `app/` (25 files: 17 `page.tsx`/`route.ts` route files plus icons, `layout.tsx`, `globals.css`,
`not-found.tsx`, `sitemap.ts`, `robots.ts`), `components/` (75 files), `lib/` (72 files, of which
38 are test files), `config/`, `data/`,
`types/`, `docs/`, `scripts/`, `public/`.

**Cashfree environment.** `lib/cashfree-config.ts` resolves the mode from `CASHFREE_ENV`, and
anything other than the exact string `production` falls back to **sandbox** — "going live is an
explicit act." The local `.env.local` in this workspace has `CASHFREE_ENV=sandbox` and an
`APP_BASE_URL` pointing at a GitHub Codespaces forwarded port, i.e. it is a dev file and says
nothing about production. **What the Coolify runtime has set is [VERIFY WITH OWNER].**

**Domain-agnosticism (relevant to §9).** Every absolute URL the site emits — canonicals, the
sitemap, `robots.txt`, every schema `@id`, the Cashfree `return_url` — is derived from
`APP_BASE_URL` (falling back to `NEXT_PUBLIC_BASE_URL`, then localhost) in `lib/site-url.ts`
and `lib/cashfree-config.ts`. There is deliberately **no request-origin fallback**. Moving the
build to another domain is therefore an env change plus a rebuild, not a code change.

---

## 3. Non-negotiable decisions

Each of these is enforced somewhere, not merely written down.

**Server-authoritative pricing.** The client sends product IDs, quantities and option
selections; the server prices them from `data/products.json` at request time. Any price, total
or item amount arriving from the client is untrusted and never used to create a payment order.
`CLAUDE.md`; `app/api/create-order/route.ts` reads `getOrderPricingCatalogue()` /
`getOrderOptionCatalogue()`; ADR-013; tests in `lib/order.test.ts`, `lib/money-path.test.ts`.

**Secrets never reach the client bundle.** `lib/cashfree-config.ts` opens with
`import "server-only"`, so importing it from a `"use client"` file is a build error rather than
a review catch. Only `NEXT_PUBLIC_*` may appear client-side. `CLAUDE.md`, `.env.example`.

**Honesty policy.** No "hallmarked", "certified", "916", "22K/18K solid", "sterling",
"precious", no karat on plated goods, no gemstone names for non-gemstones (colour words attach
to the stone: "ruby-red stones", never "rubies"), no bare "pearls" for imitation, no
skin-friendly claim on German silver or bare brass. ADR-018; both skills in `.claude/skills/`;
`docs/CATALOGUE-DATA-TODO.md` exists precisely because gaps were recorded rather than invented.
Related enforcement: `lib/no-fabricated-reviews.test.tsx` (no review or rating markup anywhere,
UI or schema) and `scripts/validate-products.mjs`.

**British spelling and Indian-English jewellery terms** throughout copy and metadata
("jewellery", "Colour", nath / kada / payal / jhumka). Both skills state it; the option name
`Colour` is baked into the catalogue and its tests.

**No em dashes in shopper-facing copy.** `lib/copy-dashes.test.ts` scans `app`, `components`,
`lib`, `config`, `types` and the product descriptions, with exactly one allowed exception
(`components/OrderTotals.tsx`, where a lone em dash is a numeric placeholder).

**No inline code comments; prose lives in JSDoc and `/docs`.** `CLAUDE.md`.

**CSP is Cashfree-safe and deliberately narrow.** `config/security-headers.mjs` allows only
`'self'` plus five Cashfree origins (`sdk.cashfree.com`, `payments.cashfree.com`,
`payments-test.cashfree.com`, `api.cashfree.com`, `sandbox.cashfree.com`) on `script-src`,
`connect-src`, `frame-src` and `form-action`. `'unsafe-inline'` on script and style is Next's
own bootstrap and critical CSS; `'unsafe-eval'` is development-only. Also shipped: HSTS
`max-age=63072000; includeSubDomains; preload`, `nosniff`, `X-Frame-Options: SAMEORIGIN`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera,
microphone and geolocation. ADR-034; asserted in `lib/security-headers.test.ts`.
**Consequence: any analytics tag added without editing this file will be silently blocked.**

**CallMeBot is off the critical path.** 5-second timeout, no retry, failures logged and
swallowed, credentials optional, and `/api/notify-admin` returns **200 whatever happens** so a
dead hobby API can never surface on a successful checkout screen. `lib/notify.ts`,
`app/api/notify-admin/route.ts`, `docs/api/notify-admin.md`.

**Full gate every prompt.** `npm run typecheck && npm run lint && npm run test:run &&
npm run validate:products && npm run build`, plus a `/docs` update and a `BUILD_LOG.md` row.
`CLAUDE.md` and every BUILD_LOG entry.

---

## 4. The catalogue

`data/products.json` — a flat JSON array, the single source of truth for prices.

- **49 products**, ids `P001`–`P049`, contiguous.
- **Price range ₹49–₹499.** Every product carries both `pricing.price` and `pricing.mrp`.
- **6 out of stock:** P006, P008, P011, P015, P039, P040.
- **8 flagged `featured`** (these are the Best Sellers collection) and **8 flagged `isNew`**
  (New Arrivals).
- **Images: 48 products have exactly one; P002 has two.** Files are `/products/P0NN.webp`
  under `public/products/`.

**Record shape** (union of keys across all 49):

```
id, name, category, pricing{price, mrp}, media{images[]}, options[]?,
specs{material, type, size?, closure?, stone?}, description, seo{...},
stock{inStock}, flags{featured, isNew}, collections[]?
```

`seo` keys: `primaryKeyword`, `secondaryKeywords[]`, `metaTitle`, `metaDescription`,
`imageAlt`, `ogTitle`, `ogDescription`, `ogImage`, and `additionalImageAlts` where a product
has more than one image.

**Categories** (10, defined in `types/product.ts`, counts from the data):

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

**Collections** (4 filter slugs, two hand-tagged and two derived): `gifting` and `anti-tarnish`
are tags a product opts into; `best-sellers` derives from `flags.featured` and `new-arrivals`
from `flags.isNew`. In the data today, **8 products carry `anti-tarnish` and none carry
`gifting`** — so `gifting` is excluded from the sitemap by
`getPopulatedCollectionPaths()` rather than publishing an empty result page.

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

**Product copy — 45 of 49.** 45 products carry long-form descriptions (>200 characters).
**Four do not:** P001, P022, P032 and P042 still hold their pre-copy-pass one-liners (15–21
words). This is recorded, not hidden: `docs/CATALOGUE-DATA-TODO.md` lists all four as awaiting
owner copy, and `npm run validate:products` prints them as a standing advisory. ADR-035.

**SEO metadata — 49 of 49.** Every product has a full `seo` object, and it is wired into the
page: `app/product/[id]/page.tsx` `generateMetadata()` reads `product.seo` for title,
description, canonical, OG title/description/image (declared 1200×630) and image alt.
`app/shop/page.tsx` has its own `generateMetadata()` for category and collection facets.
Shared blocks come from `lib/metadata.ts`. Assertions live in `lib/product-seo.test.ts`.
ADR-036, and a per-product collision ledger plus honest-name flags shipped with it.

**Security headers.** Shipped and tested, as described in §3. ADR-034.

**Sitemap, robots, JSON-LD.** `app/sitemap.ts` / `lib/sitemap.ts` emit **70 URLs**: 4 content
routes (`/`, `/shop`, `/about`, `/contact`) + 4 policies + 10 categories + 3 populated
collections + 49 products. `/cart`, `/address`, `/payment`, `/order-confirmation` and
`/style-guide` are `noindex` and excluded. `lib/structured-data.ts` builds Organization,
OnlineStore, WebSite, Product (with Offer, shipping details and return policy),
BreadcrumbList, ItemList and CollectionPage nodes. ADR-029.

**Mobile.** Two dedicated passes: ADR-031 (mobile scale) and ADR-033 (mobile layout round two
— hero image hidden, category carousel, product strips, two-column footer, overflow fixes),
with `lib/responsive-scale.test.ts` and `lib/mobile-layout.test.tsx`.

**Policy disclaimers removed.** The "sample template … not reviewed by a lawyer" notice is gone
from `/terms`, `/privacy`, `/shipping`, `/refund`; the policies now read as in effect.
ADR-037. The round-three audit confirms zero matches live.

**Content skills — both present** in `.claude/skills/`:
`product-skills.md` (`morchadi-product-copy`, v2, 107 lines) and `meta-skills.md`
(`morchadi-product-meta`, v2, 132 lines). They encode the honesty rules, the voice, batch
anti-repetition discipline, the collision rule, and measured character budgets.

**Recent cleanup** (commit `921ca5d`): 96 verified-dead placeholder images deleted from
`public/products/`, 3 dead code items removed, 12 broken doc links fixed, every `/docs` index
completed. No test was edited or skipped to make it pass.

**Gate status, re-run in this session on the clean tree:**

| Command | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | no ESLint warnings or errors |
| `npm run test:run` | **762 passed, 38 files** |
| `npm run validate:products` | **PASS**, with 3 standing advisory blocks: 9 discounts above the 60% house style (real owner prices), 4 descriptions outside the word range (the four above), 9 products quoting an amount in search or social copy |
| `npm run build` | **not re-run in this session.** Last recorded green build is in the commit history |

**Documentation state:** 37 ADRs (`ADR-001`–`ADR-038`; **there is no ADR-014**),
`BUILD_LOG.md` at 40 prompt rows, 3 API contracts, 11 test plans and 23 test results.
Git: 21 commits on `main`, remote `github.com/himanshugupta5458/Morchadi-Gems`, tree clean.

---

## 6. Pending, to close Phase 1

**Analytics is not installed and Search Console is not verified.** Confirmed from the source:
there is no `gtag`, no GTM, no Plausible, Umami, Clarity or Meta pixel anywhere in `app/`,
`components/` or `lib/`, and no verification meta tag. The round-three audit ranks this
**Critical (C1)** — not because it changes rankings but because it makes every other
recommendation unfalsifiable.

Two things must land in the **same commit** when it is done:

1. the tag itself, and
2. the vendor's origins added to `script-src` **and** `connect-src` in
   `config/security-headers.mjs`, plus the matching update to `lib/security-headers.test.ts`.

Without step 2 the tag will look installed in the page source and report nothing, because the
browser will block it.

**GA4 vs Plausible is undecided — [VERIFY WITH OWNER].** Nothing in the repository chooses one.

**Latest audit score: 69/100**, recorded in `docs/testing/RESULT-2026-08-19-seo-audit-round-three.md`
(technical 88, content 52, on-page 68, schema 90, performance 82, AI search 42, images 55; up
from 66). That is a repository record of a crawl run on 2026-08-19, not a live reading — it was
current at the moment it was written. **Whether it still holds is [VERIFY WITH OWNER]** (and a
re-audit is the way to answer it).

Other open findings from that audit, all documented there: 15 meta descriptions on the homepage
and collection pages are 179–193 characters against a ~155–160 display limit (H3); collection
titles waste the character budget (H4); 48 of 49 products have a single photograph (H5, a
photography commission, no code needed); there are no informational pages that can rank for a
question (H6); the related-products fallback dead-ends on P006 (M1); and the WhatsApp share
preview has not been eyeballed (M4).

---

## 7. Phase 1.5 — final go-live, deliberately last

This ordering is the owner's; the repository holds the procedure for parts of it in `DEPLOY.md`
but does not record the sequencing decision, so treat the sequence itself as
**[VERIFY WITH OWNER]**.

1. **Cloudflare CDN flip** — grey cloud to orange, SSL/TLS mode **Full (strict)**, Always Use
   HTTPS on, no Rocket Loader or script minification. `DEPLOY.md` §4 spells out why Flexible
   breaks a redirect-based payment flow. **Then re-test checkout end to end**, because that is
   exactly what the flip can break.
2. **Firewall and SSH hardening** on the VPS. Not covered anywhere in this repository.
3. **Production Cashfree swap** — real keys from the production tab, whitelist the domain, set
   the business name on the account, rotate the secret, and run a real-money smoke test. Set
   `CASHFREE_ENV=production` in Coolify's **runtime** column; `APP_BASE_URL` must be set in
   **both** the build and runtime columns to the same value (`DEPLOY.md` §3).
4. **Marketing** last.

None of the four can be verified from inside the repository. All are **[VERIFY WITH OWNER]**.

---

## 8. v2 — deferred

**There is no v2 plan document in this repository.** `docs/` contains no roadmap file, and the
ADRs record only decisions already taken. The sequence below is the owner's stated plan,
carried here so a new conversation knows the intended direction — every item is
**[VERIFY WITH OWNER]** and none of it is designed yet.

1. **Database first** — Postgres running in Coolify. **Partly done:** ADR-040 (prompt 43) took
   the decision and narrowed ADR-001's no-database row; the schema landed in prompt 44 and admin
   sessions in prompt 45. What remains is the production half — provisioning Postgres in Coolify,
   a real `DATABASE_URL`, `prisma migrate deploy` in the image, and a backup policy.
2. **CRM** — orders, enquiries, customers, analytics. **Started:** the tables exist, real
   checkout traffic fills them (ADR-042, prompt 48) and the admin panel can be signed into
   (ADR-041); **no screen reads an order yet** — the order list and the status-change screen
   are the next prompts.
3. **Transactional emails and order tracking.** The order record is now the `orders` table,
   with the CallMeBot WhatsApp message and the Cashfree dashboard behind it as the fallback
   that makes a failed capture recoverable — which is why `docs/api/notify-admin.md` still
   insists that message carry everything needed to pack the parcel. **Two ids per order:**
   `orders.id` is a 10-character unambiguous code and `orders.cashfree_order_id` is the `MG_`
   string; only the `MG_` one is shown to a shopper today, and surfacing the other is unbuilt.
4. **S3 or MinIO for media, plus a catalogue admin** — which retires "catalogue changes ship as
   code."

---

## 9. Strategic thread — two-site consolidation

**What the repository independently confirms.** The round-three audit finding **H1** records
that a search for `"Morchadi Gems" jewellery` returns **morchadijewels.com** ("Morchadi Jewels
| Artificial Jewelry for Indian Women") and does **not** return morchadigems.com; that the two
sites sell the same catalogue shape; that they publish different contact details
(`support@morchadijewels.com`, `+91 7877866212`, free shipping above ₹1499 versus this site's
`admin@morchadigems.com`, `+91 9358358834`, ₹799); and that a GST registration for **MORCHADI
ENTERPRISES** (`08BBYPG5053R1ZO`, Rajasthan) surfaces alongside, against this site's declared
`legalName: "Morchadi Enterprise"`. The audit explicitly says it **cannot** determine from
outside whether these are one business or two, and calls the answer a business decision.

**What the owner has stated** (not verifiable here, all **[VERIFY WITH OWNER]**): both sites
are theirs; morchadijewels.com runs on Odoo, is the established site, currently owns the brand
SERP, and uses Odoo essentially as a storefront rather than as deep ERP. The plan is to build
out fully on morchadigems.com now, then **later consolidate to a single site** by moving this
Next.js build onto morchadijewels.com as the authoritative domain, rebranding "Morchadi Gems"
to "Morchadi Jewels", 301-migrating the old Odoo URLs, completing the catalogue (this site is
currently a subset of the Odoo one), and winding Odoo down. Timing and details are
**[VERIFY WITH OWNER]**.

**This is not a current blocker. Build proceeds as Morchadi Gems.**

**Build principle to maintain:** keep everything domain-agnostic and, as far as practical,
brand-name-driven from config, so the eventual move is a configuration change rather than a
find-and-replace.

Honest current state of that principle:

- **Domain: already clean.** Nothing hardcodes an origin. `lib/site-url.ts` and
  `lib/cashfree-config.ts` derive every absolute URL from `APP_BASE_URL` /
  `NEXT_PUBLIC_BASE_URL`. A domain move is env plus rebuild. (Canonicals, the sitemap, robots
  and schema `@id`s are prerendered, so it is genuinely a **rebuild**, not a restart —
  `DEPLOY.md` §3.)
- **Brand name: mostly, not fully.** `config/business.ts` holds `brandName`, `lib/config.ts`
  derives the site title, description, WhatsApp greeting and OG alt from it, and pages read it
  from there. But literal strings remain and would each need editing: `components/Wordmark.tsx`
  (`aria-label`, `alt`, and the rendered word), the `description` in the metadata of
  `app/cart`, `app/address` and `app/order-confirmation`, display copy in `app/page.tsx` and
  `app/about/page.tsx`, `DEFAULT_SUBJECT` in `lib/contact.ts`, and 3 product records in
  `data/products.json` whose copy names the brand. Order ids are also prefixed `MG_`
  (`app/api/create-order/route.ts`), and existing ids would keep that prefix after any rename.
- **Catalogue completeness** relative to the Odoo site cannot be assessed from here:
  **[VERIFY WITH OWNER]**.

---

## 10. Catalogue data TODO

`docs/CATALOGUE-DATA-TODO.md` is the open list of real product values the catalogue is still
missing. Nothing on it can be answered from inside the repository, and **none of it may be
invented** — an invented chain length is a returns problem and a consumer-law problem.

Its four priority items: bangle **size variants (2.4 / 2.6 / 2.8)** for **P043** and **P042**
(glass bangles cannot be resized, the biggest returns exposure in the catalogue); whether
**P034**'s hoop **requires a pierced nose**; and whether **P041** is priced as a **pack of 4 or
8**.

Beyond those: ring diameters for nine to eleven "free size" fixed-band rings; chain, drop and
anklet **lengths**; a **pierced-ears-only notice** on all seven stud listings, needing the
owner's sign-off once; watch strap, dial, battery and **water-resistance** ratings; the four
missing descriptions (§5); and a set of open naming decisions — the bare "Gold" titles on P020,
P022, P032, P033, P034 and P046 that are all gold-**plated**; the watch-that-is-not-a-watch
titles on P009 and P010; the faux-pearl drop named "Pearl" on P032; and the unnamed cat's-eye
material on P030.

Every line of it is **[VERIFY WITH OWNER]** by construction. Read that file rather than
summarising from this one.

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
is v2 work. The keyword map is referenced by the collision rule in the meta skill; a standalone
site-wide keyword-map file was not found in the repository, so where it currently lives is
**[VERIFY WITH OWNER]**.

The skills are written as reusable, brand-parameterised assets rather than one-off prompts,
which is deliberate — reuse beyond this project is an owner ambition and is
**[VERIFY WITH OWNER]** for scope.

---

## 12. Working conventions

- **One Claude Code prompt at a time**, in a single Codespace.
- Prompts are handed over as **a single copy-pasteable code block**.
- Output is **pasted back for review** before anything is committed.
- **Full gate every prompt**, before claiming done:
  `npm run typecheck && npm run lint && npm run test:run && npm run validate:products && npm run build`.
- **Commit and push only after green.** Coolify auto-redeploys from `main`
  ([VERIFY WITH OWNER] that auto-deploy is switched on in Coolify).
- **Every prompt updates `/docs`**, at minimum a row appended to
  `docs/progress/BUILD_LOG.md`, plus an ADR for a decision, an API doc for a route change, a
  design doc for a token, a log for a debugging session, a test doc for tests. `CLAUDE.md` has
  the full table.
- **Act autonomously** inside the repository; pause only for a genuine external blocker —
  secrets, brand assets, legal copy, a domain, a pricing or business call. State the blocker,
  deliver everything that does not depend on it, then wait.

---

## Everything marked [VERIFY WITH OWNER]

1. **Live site status** — whether morchadigems.com is currently up and serving.
2. **Canonical origin in production** — apex or `www`. `DEPLOY.md` says `www`; the round-three
   audit observed `www` 307ing to the apex.
3. **Production Cashfree state** — whether `CASHFREE_ENV` is `production` in Coolify, whether
   live keys are in place, the domain whitelisted, and the business name set on the account.
   The repository can only show that sandbox is the fail-safe default.
4. **Cloudflare state** — whether the domain is proxied today, and the current SSL/TLS mode.
5. **Coolify auto-deploy** — whether a push to `main` actually triggers a redeploy.
6. **Analytics vendor** — GA4 or Plausible. Undecided; nothing in the repository chooses.
7. **Current audit score** — 69/100 is the 2026-08-19 record, not a live reading.
8. **Search Console** — whether the property has since been verified by DNS TXT, which cannot
   be seen from the HTML.
9. **Phase 1.5 sequencing and execution** — the CDN flip, firewall and SSH hardening,
   production Cashfree swap and real-money smoke test, then marketing. None of it is recorded
   in the repository.
10. **The v2 plan** — Postgres, CRM, transactional email and order tracking, S3/MinIO plus a
    catalogue admin. No plan document exists here; the sequence is the owner's.
11. **The two-site consolidation** — that both storefronts are the owner's, that Odoo is used
    as a storefront rather than deep ERP, the timing of the domain move and rebrand, the 301
    map, and how much of the Odoo catalogue is still missing here. The audit records the
    external symptom; only the owner can confirm the intent.

Plus, by construction, **every line of `docs/CATALOGUE-DATA-TODO.md`** — real measurements,
size options, stock facts and naming decisions that must come from the owner and must never be
invented.
