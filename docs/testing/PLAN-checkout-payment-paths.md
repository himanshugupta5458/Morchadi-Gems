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
  Cashfree sandbox credentials in `.env.local` for the end-to-end cases. No product in
  `data/products.json` has `minPrepaidAmount > 0`, so **the part-payment path is unreachable
  from the real catalogue** — cases that need it override `getCodEligibilityCatalogue`, the one
  accessor the route consults, rather than editing the catalogue.

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
