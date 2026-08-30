# Test result — one source of truth for brand, contact and policy values

- **Date:** 2026-08-30
- **Prompt:** 111
- **Decision:** [ADR-066](../decisions/ADR-066-single-source-site-identity.md)

## What was being proved

Two distinct properties, because centralisation can fail in two distinct ways.

1. **No value is written down twice.** A second copy is a bug even when both copies agree, since
   they agree only until the owner changes one.
2. **The single copy is the one that renders.** A component can import a constant, ignore it, and
   print the number beside it. Every existing test would still pass, because 799 is what the
   constant says today. A grep cannot tell the difference; only changing the value can.

## New tests

### `lib/site-identity.test.ts` — 17 assertions

Walks `app/`, `components/`, `lib/`, `types/`, `config/`, `scripts/` and the three root config
files, collecting every `.ts`, `.tsx`, `.mjs`, `.js` and `.jsx`. Strips comments, then fails on any
occurrence of a contact detail, the brand name or the legal entity name outside
`config/business.ts` and `config/site-facts.mjs`.

The literals it searches for are read from `BUSINESS` rather than typed into the test, so the test
cannot itself become the stale copy. It searches both the display form of the phone number and its
bare digit run, which is how a `tel:` href or a wa.me link would smuggle the same number past a
search for the formatted form.

| Guard | Why it is there |
| --- | --- |
| `scannedSources.length > 150` and two named files present | A scan that silently found nothing would pass every assertion below it |
| `code` contains `export const SITE_CONFIG` but not `ADR-018` | Proves the comment stripper removed comments and only comments |
| Nested paths > 50 | Proves the recursive walk reaches past the top level |

Comments are stripped before matching, deliberately. `middleware.ts` explains the admin rewrite by
naming the host it rewrites, `lib/admin-routing.ts` names it in its module header, and
`app/admin/robots.txt/route.ts` names it when explaining which `robots.txt` a crawler gets. All
three should. Documentation *about* a value is not a copy *of* it.

Exactly one file is exempt beyond the config pair and this file: `lib/admin-routing.test.ts`, which
tests host classification and needs real host strings written out, including
`" Admin.Morchadigems.com "` to prove case and whitespace normalisation. The other three admin test
files that previously held the literal now build their request URLs from `DEFAULT_ADMIN_HOSTNAME`.

### `lib/free-shipping-threshold-propagation.test.tsx` — 9 assertions

Mocks `config/site-facts.mjs` to report a threshold of **1499** instead of 799, then imports each
consumer dynamically — a static import is hoisted above `vi.doMock` and would load the real module
first — and asserts every one of them moved.

| Surface | Asserted |
| --- | --- |
| `FREE_SHIPPING_THRESHOLD` from `lib/config.ts` | `1499` |
| `calculateShipping` | charges the flat rate at 799 and at 1498, free at 1499 |
| `amountToFreeShipping` | reports 700 short at a subtotal of 799 |
| `SITE_CONFIG.description` | contains `1499`, does **not** contain `799` |
| `TrustStrip` | renders `Free Shipping Over ₹1,499`, and no `₹799` badge |
| `HeaderAnnouncement` | renders `Free shipping over ₹1,499 across India`, and no `₹799` one |
| `OrderTotals` | the `Shipping (free over ₹1,499)` label and the `Add ₹700 for free shipping.` nudge move together |

A final block unmocks and asserts the real value is 799 and that a 799 subtotal ships free, so the
file cannot leave a mocked module behind and cannot pass by having broken the real value.

## Test changed rather than added

`lib/product-seo.test.ts` held a sync test asserting that
`scripts/product-record-rules.mjs` contained `const FREE_SHIPPING_THRESHOLD = 799;`. That copy no
longer exists — the gate imports the shared definition — so the assertion inverts: it now proves
the import line is present **and** that no `const FREE_SHIPPING_THRESHOLD =` has crept back in
beside it. The test that policed the duplicate now polices its absence.

## Fixtures changed

`lib/notify.test.ts`, `lib/notify-cod.test.ts` and `lib/checkout-payment-paths.test.ts` set
`CALLMEBOT_PHONE` to the owner's real number. These tests are about environment plumbing — whether
both variables being set switches the feature on — and the number is arbitrary to them, which the
fake API keys beside it (`"123456"`, `"test_apikey"`) already acknowledged. They now use
`910000000000`.

## Gate

| Step | Result |
| --- | --- |
| `npm run typecheck` | Clean |
| `npm run lint` | No ESLint warnings or errors |
| `npm run test:run` | **2143 passed across 106 files**, 0 failed |
| `npm run validate:products` | PASS — all checks green (advisories unchanged) |
| `npm run build` | 449 product pages prerendered, middleware 28 kB |

## Manual verification

A grep for each literal across `app/`, `components/`, `lib/`, `types/`, `config/`, `scripts/`,
`middleware.ts` and `next.config.mjs`, excluding the two config files and the identity test:

| Literal | Occurrences remaining |
| --- | --- |
| `9358358834` | 0 |
| `admin@morchadigems.com` | 0 |
| `orders@updates.morchadijewels.com` | 0 |
| `Morchadi Gems` | 0 |
| `Morchadi Enterprise` | 0 |
| `admin.morchadigems.com` | 18, all in `lib/admin-routing.test.ts`, the one declared exemption |

`799` still appears as a bare number in four test files. None is a second definition: three are
cart or product amounts that happen to equal it (`lib/shop.test.ts` uses it as an MRP), and
`lib/cart.test.ts:505` and `lib/site-identity.test.ts:190` assert the constant's value on purpose,
which is a canary rather than a copy.

## Not verified

**No browser.** The wordmark, the admin sidebar, the login eyebrow and the style-guide type
specimen were changed from literal text to config reads and are covered by
`lib/wordmark.test.tsx`, `lib/admin-sidebar.test.tsx` and the build, but were not looked at.

**The confirmation email's `From:` header was not sent.** `ORDER_CONFIRMATION_FROM_ADDRESS` is now
assembled from two config fields instead of written out; `lib/notify-customer-email.test.ts` asserts
the composed value reaches Resend's payload, but no live send was made.
