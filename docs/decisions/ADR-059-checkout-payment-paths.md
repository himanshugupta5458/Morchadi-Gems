# ADR-059: Checkout offers three payment paths, and the server decides what each one costs

- **Status:** Accepted
- **Date:** 2026-08-28
- **Prompt:** 100

## Context

[ADR-058](ADR-058-cod-eligibility-and-min-prepaid-amount.md) put `pricing.minPrepaidAmount` on
every product and `isCartCodEligible` in `lib/cod.ts`, and deliberately stopped there. It closed
by naming what it had left out:

> The checkout UI, the COD order path that bypasses Cashfree, and `captureOrder`'s hardcoded
> `paymentType: "prepaid"` are deliberately **not** in this change — that work touches the money
> path and gets its own isolated review.

This is that change. Before it, `/api/create-order` had exactly one shape: price the cart, send
`order.total` to Cashfree, write `paymentType: "prepaid"`, `amountPrepaid: total`, `amountDue: 0`.
The storefront offered one button and the enum's other two values had never been written by any
code path.

## Decision

### 1. Three paths, named by a word the client sends and priced by the server

The request body gains `paymentPath?: "cod" | "partial" | "full"`. It is a **word**, never an
amount and never a claim about eligibility. `resolvePaymentPlan` in `lib/cod.ts` turns it into
money from two figures the route computed itself — the catalogue-priced total, and the
prepayment floor summed from `getCodEligibilityCatalogue()`:

| Path | Sent to Cashfree | `payment_type` | `amount_prepaid` | `amount_due` |
| --- | --- | --- | --- | --- |
| `full` | `total` | `prepaid` | `total` | `0` |
| `partial` | Σ `minPrepaidAmount × qty` | `partial_cod` | that floor | `total −` floor |
| `cod` | **nothing at all** | `cod` | `0` | `total` |

An absent or unrecognised `paymentPath` reads as `"full"`. That is what every already-deployed
browser sends and what it has always meant, so the existing path is bit-for-bit unchanged: same
Cashfree request, same amount, same row.

A path the cart does not permit is **refused** with `PAYMENT_PATH_UNAVAILABLE`, never silently
downgraded. A shopper who chose cash on delivery and was charged in full instead has been
surprised by their own checkout. Two refusals matter:

- `cod` on a cart holding any piece with a floor above zero — ADR-058's unanimity rule.
- `partial` when the floor is zero (nothing to part-pay) **or** has reached the total. The
  catalogue validator permits a `minPrepaidAmount` above a piece's own price as an advisory, so
  that second guard is what keeps `amount_due` positive on every `partial_cod` row ever written.

### 2. `amountPrepaid + amountDue = total` is checked where it becomes a row

`isBalancedOrderPayment` runs inside `captureOrder` before the insert, and a failure is an
ordinary capture failure. The invariant is what makes "money outstanding" one query rather than
three cases (see the note on those columns in `prisma/schema.prisma`), and `captureOrder` is the
one place all three paths pass through, so it is the one place worth checking it. A row that
broke it would be a quiet, permanent lie about money in a table nothing else audits.

It is checked rather than derived: `resolvePaymentPlan` constructs both figures by subtraction
and cannot produce an unbalanced pair, and a check of a value the same function computed would
prove nothing. The check exists for the caller that builds a plan by hand later.

### 3. The Prisma enum did **not** change, and no migration was written

`PaymentType { prepaid, cod, partial_cod }` was added pre-emptively by
[ADR-042](ADR-042-order-capture-in-postgres.md) against an empty table and is exactly what these
three paths need. A stale planning document proposed renaming it to
`"cod" | "prepaid_partial" | "prepaid_full"`; that is a pure rename with no semantic gain, and
it would be a real migration against a live `orders` table. It was not done, so the live-data
question it raised does not arise. **Nothing in `prisma/` changed in this prompt.**

### 4. A cash-on-delivery order carries a `COD_…` payment reference, not a nullable column

`orders.cashfree_order_id` is `@unique` and `NOT NULL`, and a COD order still needs something in
it. It gets `COD_{epoch ms}_{8 base36}`, minted by `/api/create-order` alongside the `MG_…`
generator, with `cashfree_payment_status = "NOT_APPLICABLE"` — a value
`normaliseCashfreeOrderStatus` cannot produce, so it can never be mistaken for a gateway answer.

**The distinct prefix is the entire point.** `isMorchadiOrderId` is `/^MG_\d{13}_[0-9a-z]{8}$/`.
A reference minted in Cashfree's own shape would pass that guard, `/api/verify-order` would ask
Cashfree about a payment that never existed, Cashfree would answer 404, and the confirmation page
would tell a shopper *"nothing has been charged"* about an order that is real. A `COD_…`
reference is rejected by the same guard before any request is made, so the safety comes from a
check that already existed rather than from a new one to remember. `/api/verify-order` names the
case explicitly all the same, with `COD_ORDER_NOT_VERIFIABLE`, so that the refusal says
something true rather than "that reference is not one of ours" about a real order number.

### 5. A failed capture is fatal for cash on delivery, and only for it

ADR-042 let the Postgres write fail without failing checkout. That rule rests entirely on the
money being at Cashfree and the order being recoverable from their dashboard. A COD order has no
second copy: an unwritten one exists in no system at all, and a confirmation screen over it would
be a promise nothing in this shop could keep. So the COD path answers `503 ORDER_NOT_RECORDED`,
retryable, and places nothing. ADR-042's rule is untouched for the two paths it was written about.

This is why `CreateOrderCodSuccess.trackingId` is **not** nullable where
`CreateOrderOnlineSuccess.trackingId` is. The 200 body is never produced without a row behind it,
and `isCreateOrderCodSuccess` in the browser holds the server to that.

### 6. The 200 body is a discriminated union, not one shape with fields left out

```ts
type CreateOrderSuccess = CreateOrderOnlineSuccess | CreateOrderCodSuccess;
```

discriminated on `paymentType`. The COD body has no `paymentSessionId` and no `mode`, because no
session was minted and no SDK will be loaded — rather than carrying them as `null`. Requiring an
explicit tag rather than inferring "online" from the presence of a session id is what makes the
two genuinely different shapes.

### 7. A cash-on-delivery order gets its own read route, and both confirmations share a URL

`/order-confirmation?order_id=` carries the **payment reference** on both paths, and the page
classifies the prefix. Cashfree builds that URL itself for the paths it handles, so the two
arrivals are indistinguishable and one classifier is better than two pages.

`GET /api/cod-order` is the sibling of `/api/verify-order` with the gateway removed: it reads
`orders` by the `COD_…` reference and answers with the order number, the total and the balance.
It exists so the confirmation survives a refresh, a second device, and a browser that refuses
`sessionStorage` — the property [ADR-045](ADR-045-public-order-tracking.md) established for paid
orders and which a COD screen reading its own `sessionStorage` bundle would not have.

It is keyed on `cashfree_order_id` and deliberately **not** on `orders.id`. The ten-character
order number is what `/track` is keyed on, and ADR-045 decided that surface may reach no amount.

It distinguishes a missing order (404) from a database that did not answer (502), which
`/api/verify-order` does not need to: a paid shopper sees the same screen either way, and a COD
shopper told their order does not exist because Postgres was restarting has been told something
false ([ADR-048](ADR-048-database-health-and-failure-surfaces.md)).

### 8. The payment step gets the COD catalogue as a prop, not a wider `CatalogueEntry`

`app/(storefront)/payment/page.tsx` passes `getCodEligibilityCatalogue()` down to
`PaymentCheckout`. The alternative — adding `minPrepaidAmount` to `CatalogueEntry`, which the
cart already ships to the browser — would put the field in the same object as `price` in every
cart line, which is precisely the seal ADR-058 §4 argued for.

**Measured cost: 15,714 bytes raw, 1,444 bytes gzipped** on the `/payment` RSC payload (111,614
raw / 18,113 gzipped with it, 95,900 / 16,669 without). On one non-indexed checkout page that
buys the client and the server reading the same accessor and calling the same
`summariseCartPrepayment`, so the two cannot drift about which carts qualify.

What the browser computes is only what it *renders*. `/api/create-order` recomputes eligibility
and the floor from its own catalogue read, and only that decision is binding.

### 9. `amountDue` is shown identically wherever it is positive

One `AmountDueNotice`, one visual treatment, for a COD order owing its whole total and a
part-paid one owing its remainder. To the person who needs cash ready when the courier knocks
these are the same fact, and rendering them differently would suggest a difference that does not
matter to them. Only the sentence changes, to say whether anything was already paid. It is
rendered only when the figure is positive: "₹0 due on delivery" makes a prepaid shopper look
twice at a settled order.

`VerifyOrderResult` gains `amountDue: number | null`, read from the same row `trackingId` already
comes from. It is null rather than zero when the row could not be read — "nothing is owed" and
"we could not find out" are different sentences to put in front of somebody who may be about to
hand cash to a courier.

### 10. One renamed function, and why two accepted ADRs still name the old one

`findTrackingIdForCashfreeOrder` became `findCapturedOrderForPaymentReference`: it now reads
`amount_due` and `total` beside the order number, from the same row in the same query, and the
old name described only a third of what it returns.

[ADR-045](ADR-045-public-order-tracking.md) and
[ADR-048](ADR-048-database-health-and-failure-surfaces.md) both name the old identifier in
prose. **Their bodies are not edited** — an accepted ADR is immutable, and this note is where a
reader who follows one of those references finds out where the function went. Everything they
say about it remains true of its replacement: it never throws, and a database that did not
answer degrades to a null rather than to an error a customer sees.

## Alternatives considered

**Rename the enum to `prepaid_full` / `prepaid_partial`.** Rejected: no semantic gain, and a real
migration on a live table. See §3.

**Make `cashfree_order_id` and `cashfree_payment_status` nullable.** Rejected. It is an additive
migration and genuinely low-risk, but Postgres lets every COD row share `NULL`, so the unique
constraint stops discriminating, and every consumer — `AdminOrderDetail.cashfreeOrderId`, the
detail page, the join helpers — grows a null branch for a case that has a perfectly good non-null
answer. A minted reference needed no migration at all.

**Mint the COD reference in Cashfree's `MG_…` shape** so downstream pattern matching keeps
working. Rejected for the reason in §4: the pattern matching *working* is the failure.

**A slider or a free-amount box for the part payment.** Rejected. There are exactly two amounts
on offer and the server decided both. A box would be a control whose value the server refuses
most of the time; a slider would imply the shop takes any figure between. The choice is which of
two named amounts to pay, so it is a radio group — the same control in both states, because a
barred cart is the same question asked of different stock and giving it its own pattern would
make the rarer path look like the stranger one.

**Let the COD confirmation read its balance from the `sessionStorage` bundle.** Rejected: it does
not survive a refresh, which is the regression ADR-045 exists to have closed.

## Consequences

- **The shop can now take an order it collects no money for.** ADR-058 recorded the owner's
  acceptance of that risk with no fraud or eligibility screening of any kind; this is the change
  that makes the risk real rather than hypothetical. Every lever named there — the field, a
  pincode allowlist the shop would have to build, or withdrawing COD — is still the whole set.
- **Every product reads `minPrepaidAmount: 0` today**, so every cart is COD-eligible and the
  `partial` path is unreachable in production until somebody raises a figure in a commit. It is
  exercised in tests by overriding the one accessor rather than by editing the catalogue.
- **The owner is not told about a cash-on-delivery order.** `/api/notify-admin` establishes that
  a WhatsApp is warranted by asking Cashfree whether the order was paid, and there is no such
  question to ask about a COD order, so no message is sent. The order appears in the admin panel
  and nowhere else. This is a known gap left deliberately outside this change: closing it means
  giving that route a second verification model (a Postgres read by `COD_…` reference, which is
  exactly as strong), and that is its own decision.
- **There is still no way to collect a balance.** `amount_due` is now written and visible on the
  admin list and detail, and chasing it is a phone call. The `codAmountCollected` toggle ADR-044
  built is what records the outcome. A collection flow is deferred.
- **The admin list grew a `Due` column**, blank rather than `₹0` on a prepaid order, because a
  column of zeroes is one an operator learns to skip. On a `cod` order the detail page labels the
  reference "Payment reference" and omits the gateway status, since "Cashfree" would send an
  operator to a dashboard that has never heard of the order.
- **Revisit if** RTO losses on COD orders turn out to be material, or if a real part-payment
  product ships and the "collected separately" promise needs machinery behind it.
