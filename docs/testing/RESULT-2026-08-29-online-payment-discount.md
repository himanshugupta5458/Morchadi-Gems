# Test Result: Online-payment discount — 2026-08-29

- **Plan:** [PLAN-checkout-payment-paths.md](PLAN-checkout-payment-paths.md), TC-48–TC-60
- **Commit:** working tree of prompt 107 (uncommitted at the start of this session — the pricing
  logic, UI and unit/component tests were already on disk from an interrupted prior session; this
  result covers verifying that work, adding the missing route-level coverage (TC-57–TC-59), a
  manual end-to-end walkthrough against real Cashfree sandbox (TC-60), and the documentation this
  feature was still missing — [ADR-063](../decisions/ADR-063-online-payment-discount.md),
  the `docs/api/create-order.md` contract update, and this file)
- **Environment:** local. Node, Postgres 16 (`docker-compose.yml`, already running). `npx vitest run`
  for every automated case; `npm run build` for a full production build; `npm run dev` plus a real
  headless Chromium (Playwright, temporary) and Cashfree's own sandbox API for TC-60.

| ID | Result | Notes |
| --- | --- | --- |
| TC-48 | Pass | `subtotal: 2000, shipping: 99` → `onlineDiscount: 100`, `total: 1999` |
| TC-49 | Pass | Discount identical with and without shipping; `total` differs by exactly ₹99 |
| TC-50 | Pass | |
| TC-51 | Pass | The regression case: `"full"` on `BARRED` returns the byte-identical pre-feature `PaymentPlan` |
| TC-52 | Pass | `summary: null` |
| TC-53 | Pass | 9 subtotals including several landing exactly on `.5`; every result an integer |
| TC-54 | Pass | "Save 5%" badge and "₹950" |
| TC-55 | Pass | Discount row present, then gone the instant COD is clicked |
| TC-56 | Pass | The regression case: no badge, no row, pay button unchanged, click-through charges the undiscounted total |
| TC-57 | **Pass** | New this session. Real Postgres, mocked Cashfree `fetch`. Expected figures derived from `getOrderPricingCatalogue()` + `calculateShipping` + `calculateOnlinePaymentDiscount`, never hardcoded, so the case keeps testing real behaviour if a price changes |
| TC-58 | **Pass** | New this session. Body carried `discount: 999999`, `onlineDiscount: 999999`, `amountPrepaid: 1`, `total: 1`, `price: 1` alongside a real cart — `order_amount` sent to Cashfree and the written row both landed on the server's own figure, never `1` |
| TC-59 | **Pass** | New this session. Floor raised to 500 on the fixture product; `"full"` charged the undiscounted subtotal + shipping |
| TC-60 | **Pass** | New this session. Real order, real Cashfree sandbox API cross-check — see below |

## What TC-57–TC-59 close

The report that preceded this session verified the pricing logic at the unit level
(`resolvePaymentPlan` takes no discount/amount parameter at all — TC-48–TC-53) and confirmed by
inspection that `app/api/create-order/route.ts` destructures only `items`, `address`,
`paymentPath` and `utm` from the request body. That is real proof, but it stopped short of
exercising the actual route handler, a real Cashfree request and a real Postgres row together for
this feature — the same thing `lib/checkout-payment-paths.test.ts` already does for every other
payment-path behaviour (TC-19–TC-31). TC-57 is that missing end-to-end case; TC-58 is the
adversarial one — a body that explicitly names a `discount` field and inflated amount figures,
mirroring TC-31's existing "no field of the body is read as an amount" case but for this
feature specifically; TC-59 repeats the structural-exclusion regression (TC-51) at the route
layer rather than only against `resolvePaymentPlan` directly.

## Failures

None.

## Gate

```
npx tsc --noEmit          PASS
npm run lint               ✔ No ESLint warnings or errors
npx vitest run              94 files, 1920 passed (1920)
npm run validate:products  PASS — all checks green
npm run build               Compiled successfully — 475 static pages
```

1917 tests before this session's additions (per the interrupted prior session, already covering
TC-48–TC-56), 1920 after: **3 added — TC-57, TC-58, TC-59 — none edited to pass, none skipped.**
Nothing in `lib/checkout-payment-paths.test.ts`'s existing 24 cases was weakened; the three new
ones were appended in a new `describe` block.

## Summary

**12 automated cases newly verified in this session (TC-48–TC-59), 3 of them newly written
(TC-57–TC-59), plus one manual end-to-end walkthrough (TC-60) against a real dev server, a real
headless browser and Cashfree's own sandbox API; 0 failed, 0 skipped. Shippable**, with the
documentation gap the prior session left open now closed: [ADR-063](../decisions/ADR-063-online-payment-discount.md)
records the decision, `docs/api/create-order.md` describes the current `"full"` behaviour
instead of the stale pre-discount one, and `docs/progress/BUILD_LOG.md` carries this prompt's
row.

## The manual walkthrough (TC-60)

Run after the automated gate above, against `npm run dev` (Node dev server, not a production
build — TC-42–TC-47 for the payment-path feature itself used a production build; this repeated
the walkthrough closer to how it will actually be exercised locally) and a real headless
Chromium (Playwright, installed temporarily with `--no-save` for this run and removed
afterward — `package.json`/`package-lock.json` are unmodified). Cart: **1 × Teardrop Glass
Locket Necklace (P002)**, price ₹450, `minPrepaidAmount: 0`, no options — chosen for being real,
in-stock catalogue data with no options selector to complicate the walkthrough.

**Hand calculation**, by the same arithmetic [ADR-063](../decisions/ADR-063-online-payment-discount.md)
specifies: subtotal `450`; shipping `450 < 799` → `99`; discount `Math.round(450 × 0.05) =
Math.round(22.5) = 23`; total `450 + 99 − 23 = 526`.

**What the UI rendered**, before anything was clicked, read off the actual DOM:

```
Pay in full   SAVE 5%   ₹526
Pay online and save ₹23 (5%) by UPI, card, net banking or a wallet, instead of cash on delivery.
...
Subtotal                        ₹450
Shipping (free over ₹799)       ₹99
Online payment discount (5%)    −₹23
TOTAL                           ₹526
```

Pay button: `PAY ₹526 WITH CASHFREE`. All four figures match the hand calculation exactly.

**The `POST /api/create-order` request**, captured from the real browser network traffic — the
body the client actually sent, proving no discount claim was sent at all:

```json
{ "items": [{ "productId": "P002", "qty": 1 }], "address": { … }, "paymentPath": "full" }
```

**The response**: `paymentType: "prepaid"`, `amountPrepaid: 526`, `amountDue: 0`, `mode:
"sandbox"`, `cashfreeOrderId: "MG_1788004629215_woch4inx"`, `trackingId: "J9NRZV2JVS"`, a live
`paymentSessionId`. The browser then navigated to `https://sandbox.cashfree.com/checkout/` — a
real hosted-checkout session, not a stub.

**Cashfree's own record**, fetched directly from their API (`GET
/pg/orders/MG_1788004629215_woch4inx`) rather than trusted from this app's own response — the
strongest available proof of what was actually sent, since it comes from Cashfree's servers, not
ours:

```json
{ "order_id": "MG_1788004629215_woch4inx", "order_amount": 526.0, "order_status": "ACTIVE", … }
```

**The Postgres row**, queried directly:

```
id              | J9NRZV2JVS
payment_type    | prepaid
subtotal        | 427.00     -- 450 subtotal − 23 discount
shipping_fee    | 99.00
total           | 526.00
amount_prepaid  | 526.00
amount_due      | 0.00
```

`amount_prepaid + amount_due = 526.00 = total`, and `subtotal + shipping_fee = 427.00 + 99.00 =
526.00 = total` too — the invariant holds on a row an actual browser session produced, not only
in the unit tests. Every one of the five independent readings — hand calculation, rendered UI,
the browser's own request, Cashfree's server-side record, and the Postgres row — agree on ₹526,
₹23 and ₹427/₹99 exactly.

**Server log**, confirming the write: `[create-order] MG_1788004629215_woch4inx captured as
order J9NRZV2JVS for a new customer`.

The test order and its customer row were deleted from the dev database immediately after
verification; nothing from this walkthrough was left in Postgres.

## Not covered, by decision rather than omission

1. **The partial-payment path has still never run against real catalogue data**, for the same
   reason [RESULT-2026-08-28-checkout-payment-paths.md](RESULT-2026-08-28-checkout-payment-paths.md)
   recorded it: no product carries `minPrepaidAmount > 0` today. TC-59 exercises the barred-cart
   exclusion by overriding the eligibility catalogue accessor, not by editing `data/products.json`,
   and TC-60 above did not repeat the walkthrough on a barred cart.
2. **The Cashfree hosted-checkout page itself was not completed** — TC-60 confirms the session
   Cashfree created is for ₹526 and that the browser reached it, not what that page renders or
   what happens after a card/UPI payment is actually submitted on it. That is unchanged,
   pre-existing behaviour this feature does not touch.
