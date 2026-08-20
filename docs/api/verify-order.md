# GET /api/verify-order

Asks Cashfree what happened to one order and reduces the answer to
`{ orderId, status, amount }`.

This is the only source of truth for a completed payment. A shopper arriving on
`/order-confirmation` proves only that a browser reached a URL — a URL anyone can type — so
neither the landing nor anything in `sessionStorage` is ever treated as success. The `PAID`
status returned here, derived from Cashfree's own `order_status`, is the single fact the
confirmation page is allowed to celebrate.

**There is no ADR for this route**, though
[ADR-042](../decisions/ADR-042-order-capture-in-postgres.md) now covers the one thing it writes.
Payment verification and the confirmation page shipped in
prompt 13, which produced no decision record;
[ADR-013](../decisions/ADR-013-order-creation-and-payment.md) closes by naming them as the
next prompt's work, and the [ADR index](../decisions/README.md) leaves slot 014 empty rather
than renumbering an accepted record. This contract is the reference document for the route.

## Request

`GET /api/verify-order?order_id=MG_1755400000000_a1b2c3d4`

| Query parameter | Notes |
| --- | --- |
| `order_id` | Required. Trimmed, then matched against `/^MG_\d{13}_[0-9a-z]{8}$/` — the shape `/api/create-order` mints. |

No request body, no headers beyond the default. The route is `runtime = "nodejs"` because it
reads the Cashfree secret, and `dynamic = "force-dynamic"` because a payment status changes
underneath a fixed URL.

## Server-side validation

1. **Order-id shape.** `isMorchadiOrderId` (`lib/verify.ts`) tests the id against
   `/^MG_\d{13}_[0-9a-z]{8}$/` before it is used. The id becomes a path segment on the
   outbound Cashfree call, so an unvalidated one is a way to point that call elsewhere. A
   failure returns `400 ORDER_ID_MALFORMED` and no gateway call is made.
2. **Credentials present.** `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` are read server-side;
   absent, the route returns `503 PAYMENT_NOT_CONFIGURED` rather than guessing a status.
3. **Status and amount come from Cashfree, not the client.** `status` is normalised from
   Cashfree's `order_status` and `amount` is its `order_amount`. There is no request field
   that can influence either — a tampered total is unrepresentable, not merely rejected. Any
   `order_status` the mapping does not recognise normalises to `FAILED`.

The mapping in `lib/verify.ts` is exhaustive and closed:

| Cashfree `order_status` | This route's `status` |
| --- | --- |
| `PAID` | `PAID` |
| `ACTIVE` | `PENDING` |
| `EXPIRED`, `TERMINATED`, `TERMINATION_REQUESTED` | `FAILED` |
| anything else, or a non-string | `FAILED` |

## Responses

Every response carries `Cache-Control: no-store`. A cached `PENDING` would strand a shopper
on a spinner; a cached `PAID` would be a receipt served to whoever asked next.

### 200 OK

```ts
interface VerifyOrderResult {
  orderId: string;
  status: "PAID" | "PENDING" | "FAILED" | "NOT_FOUND";
  amount: number | null;
}
```

```json
{ "orderId": "MG_1755400000000_a1b2c3d4", "status": "PAID", "amount": 2099 }
```

`NOT_FOUND` is not a Cashfree `order_status` — it is what a 404 from Cashfree becomes, kept
distinct from `FAILED` because the causes differ (an invented order id, versus a payment that
genuinely did not complete). `amount` is null when Cashfree has no such order, or when its
response carried no readable amount.

A `200` is returned for all four statuses: the route succeeded in *asking*. That is a
different thing from the payment having succeeded.

### Error bodies

```ts
interface VerifyOrderErrorBody {
  error: "ORDER_ID_MALFORMED" | "PAYMENT_NOT_CONFIGURED" | "VERIFICATION_UNAVAILABLE";
  message: string;
  retryable: boolean;
}
```

Every non-200 describes a failure to *ask* about the payment. The confirmation page renders
them as "we could not confirm this yet", never as "your payment failed".

| Status | `error` | When it fires | `retryable` |
| --- | --- | --- | --- |
| 400 | `ORDER_ID_MALFORMED` | `order_id` is missing, or does not match the minted shape | `false` |
| 503 | `PAYMENT_NOT_CONFIGURED` | `CASHFREE_APP_ID` or `CASHFREE_SECRET_KEY` is unset | `false` |
| 502 | `VERIFICATION_UNAVAILABLE` | Cashfree was unreachable, timed out at 15 s, answered with a non-404 error status, or returned an unparseable body | `true` |

## Side effects

One outbound `GET` to the Cashfree order endpoint, through `lookupCashfreeOrder`
(`lib/cashfree-order.ts`), with a 15-second `AbortSignal.timeout` and `cache: "no-store"`.

That helper is shared with [`/api/notify-admin`](notify-admin.md) deliberately: the
notification route has to answer the same question the confirmation page asks — "was this
genuinely paid?" — and a second implementation is a second thing that can drift into
answering it more loosely. Both callers get the same normalisation, the same timeout, and the
same treatment of a malformed body. Failures are logged under `[verify-order]`, which
attributes them to the calling route; `PENDING` is not logged, because the confirmation page
polls and a shopper on a slow bank page would otherwise write ten lines per checkout.

### The Postgres write

After Cashfree answers — and only when it answers cleanly — the order's
`orders.cashfree_payment_status` is brought into line with that answer, by
`recordVerifiedPaymentStatus` in `lib/order-capture.ts`.

| | |
| --- | --- |
| Looked up by | `orders.cashfree_order_id`, which is unique as of [ADR-042](../decisions/ADR-042-order-capture-in-postgres.md) |
| Written | `cashfree_payment_status` only — `PAID`, `PENDING`, `FAILED` or `NOT_FOUND`, the same four states this response carries |
| Not written | **`orders.status`.** A confirmed payment leaves the order at `placed`; fulfilment moves when an operator packs it, not when money arrives |
| Skipped when | The stored status already matches, so a page polling a pending payment ten times performs at most one write |
| No such order | A silent no-op. An order placed before capture existed, or one whose capture failed, matches nothing and is not an error |

**This write cannot affect the response.** `recordVerifiedPaymentStatus` never throws: a
database that is down, slow or refusing produces a log line prefixed `[order-capture]`, and the
200 body above, its `Cache-Control` header and the confirmation page are all identical to a run
against a healthy database. Same principle as the capture in
[`/api/create-order`](create-order.md), argued in
[ADR-042](../decisions/ADR-042-order-capture-in-postgres.md), and asserted by
`lib/checkout-database-failure.test.ts`.

## Polling

The confirmation page re-asks while an order is `PENDING`, every
`PENDING_POLL_INTERVAL_MS` (3,000 ms) for at most `MAX_VERIFY_ATTEMPTS` (10) — a
thirty-second window, long enough for a UPI collect request or a bank redirect to settle,
short enough that a shopper is not watching a spinner indefinitely. After the cap the page
hands over to a manual "check again"; an unbounded poll is a tab that hammers this route
forever on a payment nobody completed. Both constants live in `lib/verify.ts`.

## Security notes

`CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` are read only inside `lib/cashfree-order.ts`,
which carries `import "server-only"`. Neither appears in a `"use client"` file, neither is a
`NEXT_PUBLIC_*` variable, and the browser never calls Cashfree directly.

The route is unauthenticated, which is deliberate and safe: there are no accounts
([ADR-001](../decisions/ADR-001-tech-stack.md)), and the only thing a caller can learn is the
status and amount of an order whose full id they already hold. The id embeds 8 random base36
characters, so it is not enumerable from the timestamp alone, and no address, contact detail,
or line item is ever returned.
