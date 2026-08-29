# Test Plan: Checkout payment paths

- **Scope:** the three paths `/api/create-order` can take — full prepayment, part payment and
  cash on delivery — and everything downstream of the choice: the payment-plan arithmetic, the
  `amountPrepaid + amountDue = total` invariant, the payment-step UI in both of its states, the
  order row each path writes, the confirmation screen each produces, and the reference-shape
  guard that keeps a cash-on-delivery order away from Cashfree.

  **Explicitly not covered:** balance collection (there is none — the balance is chased by hand),
  pincode or order-value COD risk controls (none exist, by decision, per
  [ADR-058](../decisions/ADR-058-cod-eligibility-and-min-prepaid-amount.md)), the
  `order_meta.payment_methods` restriction (deferred), and the owner's WhatsApp notification for
  a COD order (a known open gap — see [ADR-059](../decisions/ADR-059-checkout-payment-paths.md)).

- **Prerequisites:** local Postgres from `docker-compose.yml` with migrations applied; the
  Cashfree sandbox credentials in `.env.local` for the end-to-end cases. Cases that need a
  prepayment floor override `getCodEligibilityCatalogue`, the one accessor the route consults,
  rather than editing the catalogue — the override is what makes the case independent of which
  pieces carry a floor on any given day.

  **No case names the piece it buys.** `data/products.json` is data, and a floor may appear on
  any product in any commit — P001 acquired one on 2026-08-28. A cash-on-delivery case that
  named a product would silently become a test of the eligibility refusal the day that product
  was barred, so the automated cases find the first entry reading `minPrepaidAmount: 0` and buy
  that. See [`../logs/2026-08-28-eight-tests-fail-after-one-catalogue-price-edit.md`](../logs/2026-08-28-eight-tests-fail-after-one-catalogue-price-edit.md).

## Cases

### The payment plan and the invariant

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | A cart of eligible pieces owes nothing up front | `summariseCartPrepayment` over lines whose entries all read `0` | `{ isCodEligible: true, minimumPrepayment: 0 }` | Automated |
| TC-02 | The floor is per unit | Three of a piece with a floor of 500 | `minimumPrepayment: 1500` | Automated |
| TC-03 | One barred piece withdraws COD from the whole cart | Mixed cart, one line with a floor | `isCodEligible: false`, floor sums only the barred line | Automated |
| TC-04 | Two lines of one product both count | Same product twice, quantities 1 and 2 | Floor is 3 × the per-unit figure | Automated |
| TC-05 | An unresolvable cart fails safe | A line naming a product the eligibility catalogue does not hold | `null`, and the route allows only full prepayment | Automated |
| TC-06 | An empty cart is not eligible | `summariseCartPrepayment([], …)` | `isCodEligible: false` — never vacuously true | Automated |
| TC-07 | An absent path means full prepayment | `parsePaymentPath(undefined)` and `(null)` | `"full"` | Automated |
| TC-08 | An unrecognised path means full prepayment | `"COD"`, `"free"`, `0`, `{}`, `true`, `"prepaid"` | All `"full"` — the safe reading collects the money | Automated |
| TC-09 | Full prepayment prices as it always did | `resolvePaymentPlan("full", …)` on every cart shape | `prepaid`, total, `0` | Automated |
| TC-10 | COD prices as nothing now, everything at the door | Eligible cart | `cod`, `0`, total | Automated |
| TC-11 | Part payment prices as floor now, remainder at the door | Barred cart, floor 500, total 2000 | `partial_cod`, `500`, `1500` | Automated |
| TC-12 | COD is refused on a barred cart | `resolvePaymentPlan("cod", barred)` | `null` | Automated |
| TC-13 | Part payment is refused with no floor to part-pay | `resolvePaymentPlan("partial", eligible)` | `null` | Automated |
| TC-14 | Part payment is refused when the floor reaches the total | Floor 500, totals 500, 400, 1 | `null` in all three — no `partial_cod` row with nothing owing | Automated |
| TC-15 | Eligibility never reads what the cart is worth | ₹50 barred cart vs ₹90,000 eligible cart | The cheap one refused, the expensive one allowed | Automated |
| TC-16 | **The invariant holds on every path** | Every path × totals 1, 210, 259, 501, 2000, 12499, 99999 | `amountPrepaid + amountDue === total`, both non-negative | Automated |
| TC-17 | `captureOrder` agrees with the plan on every path | `isBalancedOrderPayment` over each resolved plan | `true` for all three | Automated |
| TC-18 | An unbalanced hand-built split is refused | Six wrong splits, including negatives, over and under | `false` for all six | Automated |

### The online-payment discount on `resolvePaymentPlan` — [ADR-063](../decisions/ADR-063-online-payment-discount.md)

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-48 | Full prepayment is discounted 5% of the subtotal on an eligible cart | `resolvePaymentPlan("full", { subtotal: 2000, shipping: 99, summary: ELIGIBLE })` | `onlineDiscount: 100`, `total: 1999`, `amountPrepaid: 1999` | Automated |
| TC-49 | Shipping is never discounted, only the subtotal | Same cart priced with and without a ₹99 shipping fee | Discount identical in both; `total` differs by exactly ₹99 | Automated |
| TC-50 | Cash on delivery is never discounted | `resolvePaymentPlan("cod", eligible)` | `onlineDiscount: 0`; `amountDue` equals the undiscounted total | Automated |
| TC-51 | **Regression: a barred cart's `"full"` and `"partial"` options are both undiscounted** | `resolvePaymentPlan` for both paths against `BARRED` | `onlineDiscount: 0` on both; `"full"` returns the exact pre-feature `PaymentPlan` shape | Automated |
| TC-52 | Full prepayment is never discounted when eligibility could not be established | `summary: null` | `onlineDiscount: 0`, `amountPrepaid` equals the undiscounted total | Automated |
| TC-53 | Rounding is nearest rupee, via the one function the plan and any preview share | Subtotals `[1, 9, 10, 11, 99, 101, 647, 1649, 12499]`, including several landing exactly on `.5` | `plan.onlineDiscount === calculateOnlinePaymentDiscount(subtotal)` for every one, always an integer | Automated |

### The online-payment discount on the payment step UI

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-54 | The discounted amount and a "Save 5%" badge render on an eligible cart | Render `PaymentCheckout` with `ALL_ELIGIBLE` | Pay-in-full row shows "Save 5%" and "₹950"; pay button reads "Pay ₹950 with Cashfree" | Automated |
| TC-55 | The Order Summary reflects the discount live and drops it on choosing COD | Same render, then click "Cash on delivery" | "Online payment discount (5%)" / "−₹50" shown, then both disappear the instant COD is selected | Automated |
| TC-56 | **Regression: a cart that requires prepayment never shows the discount** | Render with `REQUIRES_PREPAYMENT` | No "Save" badge, no discount row; pay button reads the undiscounted total; clicking pay-in-full charges it unchanged | Automated |

### The route, against the real database

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-19 | **Regression: a body naming no path is unchanged** | `POST` with no `paymentPath`, as every pre-existing browser sends | `order_amount` equals the total; row is `prepaid` / total / `0`; `cashfree_payment_status` `PENDING` | Automated |
| TC-20 | **Regression: nothing is left owing on that path** | Same | `amount_due` `0`, and prepaid + due equals total | Automated |
| TC-21 | **COD makes no request to Cashfree** | `POST paymentPath: "cod"` with `fetch` spied | The spy is **never called**; 200 carries `paymentType: "cod"` and no `paymentSessionId`, `mode` or `cashfreeOrderId` | Automated |
| TC-22 | The COD row is written correctly | Same | `cod` / `0` / total; reference matches `COD_\d{13}_[0-9a-z]{8}`; status `NOT_APPLICABLE`; `placed`; history row by `system` | Automated |
| TC-23 | A COD reference cannot reach Cashfree through verify | `GET /api/verify-order` with the `COD_…` reference, `fetch` spied | Spy never called; `400 COD_ORDER_NOT_VERIFIABLE` | Automated |
| TC-24 | A COD order reads back from its own route | `GET /api/cod-order` with the reference | 200 naming the order number, total and balance | Automated |
| TC-25 | That route refuses a Cashfree reference and an invented one | `MG_…`, then a well-formed unknown `COD_…` | `400 COD_REFERENCE_MALFORMED`, then `404 COD_ORDER_NOT_FOUND` | Automated |
| TC-26 | COD is refused on a barred cart | Override the floor, `POST paymentPath: "cod"` | `400 PAYMENT_PATH_UNAVAILABLE`; no Cashfree call; no customer row created | Automated |
| TC-27 | Part payment sends the floor, not the total | Override floor to 50, quantity 3 | `order_amount` is 150 and **not** the total; row is `partial_cod` / 150 / total − 150, balance positive | Automated |
| TC-28 | Part payment is refused with no floor | Real catalogue, `paymentPath: "partial"` | `400 PAYMENT_PATH_UNAVAILABLE`; no Cashfree call | Automated |
| TC-29 | Part payment is refused when the floor meets the total | Override floor to 100,000 | `400 PAYMENT_PATH_UNAVAILABLE` | Automated |
| TC-30 | A request cannot talk its way onto a barred path | `paymentPath: "cod"` on a barred cart, then `paymentPath: "free"` | Refused, then silently full prepayment charging the whole total | Automated |
| TC-31 | **No field of the body is read as an amount** | Body carrying `price`, `amountPrepaid`, `amountDue`, `minPrepaidAmount`, `total`, all set to lies | `order_amount` is the catalogue total; row is total / `0` | Automated |
| TC-57 | **The online-payment discount, end to end** | `paymentPath: "full"` on a real cash-on-delivery-eligible product, expected figures derived from the catalogue and `calculateShipping`/`calculateOnlinePaymentDiscount` rather than hardcoded | `order_amount` sent to Cashfree is the discounted total; the written row's `subtotal`, `total` and `amount_prepaid` all reflect it, `amount_due` `0` | Automated |
| TC-58 | **A client-sent discount claim cannot inflate the charge** | Body also carries `discount`, `onlineDiscount`, `amountPrepaid: 1`, `total: 1` alongside a real `paymentPath: "full"` cart | `order_amount` sent to Cashfree, and the written row's `total`, are the server's own discounted figure, never `1` | Automated |
| TC-59 | **Regression, at the route: a barred cart's `"full"` option is never discounted** | Override the floor, `POST paymentPath: "full"` | `order_amount` and the written `total` equal the undiscounted subtotal + shipping | Automated |

### Database failure

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-32 | **A failed COD capture fails the checkout** | Prisma mocked to reject, `paymentPath: "cod"` | `503 ORDER_NOT_RECORDED`, retryable; no `trackingId`, no reference; no Cashfree call; message names no database | Automated |
| TC-33 | A failed prepaid capture still does not | Same mock, `paymentPath: "full"` | `200` with `trackingId: null` and a live `paymentSessionId` — ADR-042 unchanged | Automated |

### The payment step

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-34 | An eligible cart is offered COD or full payment | Render with an all-eligible catalogue | Both options present, no "Pay minimum"; full prepayment pre-selected | Automated |
| TC-35 | Choosing COD renames the button honestly | Click the COD option | "Place order and pay ₹1,000 on delivery" | Automated |
| TC-36 | COD skips the SDK and goes to confirmation | Click through with a stubbed 200 | Request carries `paymentPath: "cod"`; router pushes `/order-confirmation?order_id=COD_…`; bundle stamped with reference, order number and balance | Automated |
| TC-37 | A barred cart is offered the minimum or full payment | Render with a floor of 300 | "Pay minimum now" and "Pay in full"; **no** COD option | Automated |
| TC-38 | The minimum quotes the floor and explains the balance | Same | "₹300", and "The remaining ₹700 is due before delivery and is collected separately" | Automated |
| TC-39 | The floor multiplies by quantity in the UI too | Quantity 3, floor 300 | Button reads "Pay ₹900 with Cashfree" | Automated |
| TC-40 | A part payment still goes to Cashfree | Click through with a stubbed `partial_cod` 200 | Request carries `paymentPath: "partial"`; router **not** pushed; bundle stamped 300 / 700 | Automated |
| TC-41 | A floor at the total withdraws the choice | Floor 5000 on a ₹1,000 cart | No radios at all; button reads exactly as it did before choices existed | Automated |

### End to end, in the running application

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-42 | **A real COD order, placed through the UI** | Production build, real browser: product page → add to cart → address → payment → choose COD → place | Lands on the confirmation screen showing the order number and the balance | Manual |
| TC-43 | **No Cashfree traffic on that order** | Observe TCP sockets to the resolved Cashfree addresses, and every URL the browser requests | Zero sockets, zero browser requests to any Cashfree host, no gateway line in the server log | Manual |
| TC-44 | **The instrument is not vacuous** | Repeat with full prepayment as a control | Sockets to Cashfree **do** appear and the browser lands on the hosted checkout | Manual |
| TC-45 | The resulting Postgres row is correct | Query the row directly | `cod` / `0.00` / total; `NOT_APPLICABLE`; `placed`; `cod_amount_collected` false | Manual |
| TC-46 | The confirmation survives a cold browser | Open the confirmation URL in a fresh context with no session storage | Order number and balance still shown, from `/api/cod-order`; no Cashfree request | Manual |
| TC-47 | Verify refuses the reference over real HTTP | `curl /api/verify-order?order_id=COD_…` against the running server | `400 COD_ORDER_NOT_VERIFIABLE`; socket count to Cashfree unchanged | Manual |
| TC-60 | **A real online-full order, at the discounted amount, verified against Cashfree's own record** — [ADR-063](../decisions/ADR-063-online-payment-discount.md) | Real dev server, real headless browser: add a `minPrepaidAmount: 0` product to cart, address, payment step, choose full payment, pay | UI shows the discounted total and "Save 5%"; the browser's own request names no discount; `GET /pg/orders/{id}` against Cashfree's sandbox API independently confirms `order_amount` is the discounted figure; the Postgres row agrees | Manual |
