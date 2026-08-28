# Test Result: Checkout payment paths — 2026-08-28

- **Plan:** [PLAN-checkout-payment-paths.md](PLAN-checkout-payment-paths.md)
- **Commit:** `74fea1f` plus the working tree of prompt 100
- **Environment:** local. Node 24, Postgres 16 in `docker-compose.yml`, production build
  (`npm run build` then `npm start`) against Cashfree **sandbox** for the end-to-end cases.
  Automated cases run under Vitest against the same local Postgres.

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | |
| TC-02 | Pass | 3 × 500 = 1500 |
| TC-03 | Pass | Floor sums only the barred line; eligibility is withdrawn from the whole cart |
| TC-04 | Pass | |
| TC-05 | Pass | `null`, and the route falls back to full prepayment only |
| TC-06 | Pass | |
| TC-07 | Pass | |
| TC-08 | Pass | Six values including `"prepaid"`, which is an enum value and not a path |
| TC-09 | Pass | Identical plan for an eligible cart, a barred cart and an unresolvable one |
| TC-10 | Pass | |
| TC-11 | Pass | |
| TC-12 | Pass | |
| TC-13 | Pass | |
| TC-14 | Pass | Totals 500, 400 and 1 against a floor of 500 |
| TC-15 | Pass | |
| TC-16 | Pass | 4 paths × 7 totals; the invariant and non-negativity both hold |
| TC-17 | Pass | |
| TC-18 | Pass | Under by 1, over by 1, double-counted, negative prepaid, negative due |
| TC-19 | **Pass** | The regression case, **written and run green against the unmodified route before any change was made**, then again after |
| TC-20 | Pass | |
| TC-21 | **Pass** | `fetch` spy never called. The 200 carries none of `paymentSessionId`, `mode`, `cashfreeOrderId` |
| TC-22 | Pass | |
| TC-23 | **Pass** | Gateway spy never called; `400 COD_ORDER_NOT_VERIFIABLE` |
| TC-24 | Pass | |
| TC-25 | Pass | |
| TC-26 | Pass | No customer row created either — nothing is written before the refusal |
| TC-27 | Pass | `order_amount` 150 against a total of 309 |
| TC-28 | Pass | |
| TC-29 | Pass | |
| TC-30 | Pass | `"free"` falls to full prepayment and is charged the whole total |
| TC-31 | Pass | Body carried six lying figures; none reached any amount |
| TC-32 | **Pass** | `503 ORDER_NOT_RECORDED`, retryable, no reference handed back, no gateway call |
| TC-33 | Pass | ADR-042's tolerance is intact on the path it was written about |
| TC-34 | Pass | |
| TC-35 | Pass | |
| TC-36 | Pass | |
| TC-37 | Pass | |
| TC-38 | Pass | |
| TC-39 | Pass | |
| TC-40 | Pass | |
| TC-41 | Pass | |
| TC-42 | **Pass** | See the transcript below |
| TC-43 | **Pass** | See the transcript below |
| TC-44 | **Pass** | See the transcript below |
| TC-45 | **Pass** | See the row below |
| TC-46 | **Pass** | |
| TC-47 | **Pass** | |

## The end-to-end run

A production build served by `npm start`, driven by a real headless Chromium. The cart was
built by clicking Add to cart on `/product/P001`, the address form was filled in field by field,
and the payment step was reached by its own Continue button.

### What the payment step actually offered (TC-42)

```
PAYMENT STEP OPTIONS:
  [ ] Cash on delivery | ₹0 | Pay nothing now. Have ₹309 ready in cash when your order arrives.
  [x] Pay in full | ₹309 | Pay the whole amount now by UPI, card, net banking or a wallet.
COD selected: true
BUTTON: Place order and pay ₹309 on delivery
LANDED ON: http://localhost:3000/order-confirmation?order_id=COD_1787933768463_huepbvf6
```

The confirmation screen, read off the rendered page:

```
Your order is placed
Your order is with us and nothing has been charged. You pay the courier in cash when it arrives.

YOUR ORDER NUMBER
NEW9QRV2QJ

DUE ON DELIVERY
₹309
Please have this ready in cash when your order arrives. Nothing has been charged online.

Order reference COD_1787933768463_huepbvf6
```

### No Cashfree traffic (TC-43)

Cashfree's sandbox host resolves to `18.67.195.10`, `.36`, `.98` and `.106`. Sockets to those
addresses, sampled immediately after the order was placed:

```
$ ss -tn state all | grep -E "18\.67\.195\.(10|36|98|106)"
  (none)
```

Every URL the browser requested was checked for the string `cashfree`:

```
cashfree in browser requests: false
```

The whole server log for the run, with the boot lines removed:

```
[create-order] COD_1787933768463_huepbvf6 captured as cash-on-delivery order NEW9QRV2QJ for a new customer
```

One line. No gateway request, no `[create-order] … rejected by Cashfree`, nothing outbound.

### The control (TC-44)

The observation above only means something if the instrument can see a Cashfree call at all, so
the identical cart was placed again on the full-payment path against the same running server:

```
BUTTON: Pay ₹309 with Cashfree
LANDED ON: https://sandbox.cashfree.com/checkout/

$ ss -tn state all | grep -E "18\.67\.195\.(10|36|98|106)"
TIME-WAIT  0  0  10.0.13.63:56640  18.67.195.36:443
TIME-WAIT  0  0  10.0.13.63:58090  18.67.195.36:443
```

The browser also fetched `https://sdk.cashfree.com/js/v3/cashfree.js` and
`https://sandbox.cashfree.com/pg/view/sessions/checkout`, and the server logged
`[create-order] MG_1787933794684_7ixehz0c captured as order EUWC83C5YR`.

So the socket check and the request log both register a Cashfree call when one happens, and
neither registered anything on the cash-on-delivery order. **The absence is real, not an
artefact of not looking.**

### The Postgres row (TC-45)

Read directly out of the database, not summarised:

```
$ psql -x -c "SELECT id, created_at, status, payment_type, subtotal, shipping_fee, total,
              total_cost, amount_prepaid, amount_due, cod_amount_collected, cod_collected_at,
              cashfree_order_id, cashfree_payment_status, is_refunded
              FROM orders WHERE cashfree_order_id = 'COD_1787933768463_huepbvf6';"

-[ RECORD 1 ]-----------+---------------------------
id                      | NEW9QRV2QJ
created_at              | 2026-08-28 16:16:08.563
status                  | placed
payment_type            | cod
subtotal                | 210.00
shipping_fee            | 99.00
total                   | 309.00
total_cost              | 126.00
amount_prepaid          | 0.00
amount_due              | 309.00
cod_amount_collected    | f
cod_collected_at        |
cashfree_order_id       | COD_1787933768463_huepbvf6
cashfree_payment_status | NOT_APPLICABLE
is_refunded             | f
```

`amount_prepaid + amount_due` is `0.00 + 309.00 = 309.00 = total`. The invariant holds on the
row an actual shopper produced, not only in the unit tests.

### Refresh survival (TC-46)

The same URL opened in a **brand-new browser context** — no `sessionStorage` bundle, no cart,
nothing the first browser remembered:

```
Your order is placed
NEW9QRV2QJ
₹309
Order reference COD_1787933768463_huepbvf6

cashfree requested: false
our api requested: [ 'http://localhost:3000/api/cod-order?order_id=COD_1787933768463_huepbvf6' ]
```

The order number and the balance came from Postgres through `/api/cod-order`. This is the
property [ADR-045](../decisions/ADR-045-public-order-tracking.md) established for paid orders,
and it is the whole reason that route exists rather than the screen reading its own bundle.

### The verification guard over real HTTP (TC-47)

```
$ curl -i "http://localhost:3000/api/verify-order?order_id=COD_1787933768463_huepbvf6"
HTTP/1.1 400 Bad Request
{"error":"COD_ORDER_NOT_VERIFIABLE","message":"That is a cash-on-delivery order, so there is no
online payment to confirm. Your order is placed and you pay the courier on delivery.","retryable":false}
```

The socket count to Cashfree was unchanged by that call.

## Failures

None.

## Gate

```
npx tsc --noEmit          PASS
npm run lint              ✔ No ESLint warnings or errors
npx vitest run            91 files, 1841 passed (1841)
npm run validate:products PASS — all checks green
npm run build             Compiled successfully — 75 static pages, 5 API routes
```

1797 tests before this prompt, 1841 after: **44 added, none edited to pass and none skipped.**
The assertions that changed were widened shapes, not weakened ones — `amountDue` added to the
`verify-order` body, the create-order 200's key set, `amountDue` in `AdminOrderRow`, and the
`payment.test.ts` fixture gaining the new required fields.

The em-dash sweep (`lib/copy-dashes.test.ts`) caught three new dashes and two were real: the
`ORDER_NOT_RECORDED` message and the COD button label, both rewritten. The third —
`AdminOrderTable`'s blank Due cell — is a typographic placeholder standing in for an absent
number, exactly like the one `OrderTotals` was already exempted for, so the exemption list gained
that file with the reasoning written into it rather than the dash being replaced.

## Summary

**47 passed, 0 failed, 0 skipped. Shippable.**

The three money paths each write the invariant correctly, and the one that never touches the
payment gateway was proved not to at the socket level, with a control to show the measurement
works. The pre-existing full-prepayment path is unchanged in behaviour: its regression case was
written and run green against the untouched route *before* any code was modified, and it still
passes.

Two things this result does **not** cover, both by decision rather than by omission:

1. **The part-payment path has never run against real catalogue data**, because no product has
   `minPrepaidAmount > 0`. Every case that exercises it overrides one accessor. The first product
   given a real floor should be walked through this plan's TC-27 by hand before it ships.
2. **The owner is not notified of a cash-on-delivery order.** `/api/notify-admin` warrants a
   WhatsApp by asking Cashfree whether the order was paid, and there is no such question to ask,
   so no message is sent and no test here asserts one. The order is visible in the admin panel
   and nowhere else. This is the known open gap recorded in
   [ADR-059](../decisions/ADR-059-checkout-payment-paths.md).
