# GET /api/cod-order

Reads one cash-on-delivery order back from Postgres, for the confirmation page.

Handler: `app/api/cod-order/route.ts`. Runtime: **Node** (`export const runtime = "nodejs"`).
Rationale: [ADR-059](../decisions/ADR-059-checkout-payment-paths.md).

**This route never talks to Cashfree, and that is not an optimisation.** A cash-on-delivery
order has no payment session, no `payment_session_id` and no gateway record: Cashfree has never
heard of the reference in this URL. There is no "was this paid?" question to ask about it. What
the shopper needs is the two facts only this database holds — the order number they will quote,
and what to have ready at the door.

It is the sibling of [`verify-order.md`](verify-order.md) with the gateway removed. The two are
told apart by the shape of the reference, never by the route the browser came from; see
**Which route answers** below.

## Request

```
GET /api/cod-order?order_id=COD_1787933768463_huepbvf6
```

| Parameter | Required | Notes |
| --- | --- | --- |
| `order_id` | yes | The `COD_…` payment reference minted by `POST /api/create-order`. Trimmed before matching. |

There is no request body and no authentication. The reference is the capability: it carries the
same entropy as the Cashfree `MG_…` id that `/api/verify-order` already answers about
(13-digit timestamp plus 8 characters of base36, from `randomBytes`).

## Server-side validation

1. **Shape.** `isCodOrderReference` (`lib/verify.ts`) matches `/^COD_\d{13}_[0-9a-z]{8}$/`.
   Anything else — including a perfectly valid Cashfree `MG_…` id — is `COD_REFERENCE_MALFORMED`.
   The two patterns are mutually exclusive by construction.
2. **Existence.** `lookupCapturedOrderForPaymentReference` reads `orders` by
   `cashfree_order_id`. No row is `COD_ORDER_NOT_FOUND`; a lookup that threw is
   `COD_LOOKUP_UNAVAILABLE`.

Nothing in this request is trusted for an amount. `total` and `amountDue` are read from the
order row, which was written from the server's own catalogue-priced figures.

**The lookup is keyed on `cashfree_order_id`, deliberately not on `orders.id`.** The
ten-character order number is what `/track` is keyed on, and
[ADR-045](../decisions/ADR-045-public-order-tracking.md) decided that surface may reach no
amount. Keying this route there instead would put order totals behind the number printed on a
courier label.

## Responses

### 200 OK

```ts
interface CodOrderResult {
  codOrderReference: string;   // echoed back, as asked for
  trackingId: string;          // orders.id — never null; see below
  total: number;               // what the cart was worth
  amountDue: number;           // what is owed at the door
}
```

```json
{
  "codOrderReference": "COD_1787933768463_huepbvf6",
  "trackingId": "NEW9QRV2QJ",
  "total": 309,
  "amountDue": 309
}
```

`trackingId` is never null here, where `/api/verify-order` allows it to be. A COD order whose
Postgres write failed was never placed at all — the checkout answered `ORDER_NOT_RECORDED` and
no reference was ever handed to a browser — so a reference that resolves has a row by
construction. See [ADR-059](../decisions/ADR-059-checkout-payment-paths.md) §5.

`amountDue` equals `total` on a freshly placed order and is the current value of
`orders.amount_due` thereafter, so an operator recording a collection is reflected here.

`Cache-Control: no-store` on every response. What is owed changes underneath a fixed URL, and a
cached figure is one quoted at a customer standing in front of a courier.

### 400 `COD_REFERENCE_MALFORMED`

The `order_id` is not a cash-on-delivery reference. Not retryable.

```json
{
  "error": "COD_REFERENCE_MALFORMED",
  "message": "That order reference is not one of ours.",
  "retryable": false
}
```

### 404 `COD_ORDER_NOT_FOUND`

Well-formed, and names no order. Not retryable — asking again cannot conjure a row, and the way
forward is to contact the shop with the reference.

### 502 `COD_LOOKUP_UNAVAILABLE`

Postgres did not answer. **Retryable**, and the message says the order is placed, because it is:
the row exists and could not be read. Answering this case with the 404 would tell somebody their
order does not exist because a database was restarting
([ADR-048](../decisions/ADR-048-database-health-and-failure-surfaces.md)).

```json
{
  "error": "COD_LOOKUP_UNAVAILABLE",
  "message": "We could not look your order up just now. It is placed and nothing is wrong with it, so please try again in a moment.",
  "retryable": true
}
```

Distinguishing the last two is the one thing this route does that its sibling does not. A paid
shopper sees the same screen either way and falls back to the payment reference; a
cash-on-delivery shopper has no gateway to fall back on.

## Which route answers

`/order-confirmation?order_id=` carries a **payment reference** on both checkout paths, and the
page classifies its prefix rather than the route it arrived from — Cashfree builds that same URL
itself for the paths it handles.

| Reference | Page calls | Because |
| --- | --- | --- |
| `MG_…` | `/api/verify-order` | There is a payment, and only Cashfree can say what happened to it |
| `COD_…` | `/api/cod-order` | There is no payment |

A `COD_…` reference sent to `/api/verify-order` is refused with `COD_ORDER_NOT_VERIFIABLE`
**before any Cashfree request is made**. Nothing this project ships does that; the case exists so
the refusal states something true if anything ever does.

## Side effects

None. This route reads one row and writes nothing — not even the payment-status update its
sibling performs, because there is no gateway answer to record.

## Security notes

Reads `DATABASE_URL` through the shared Prisma client and no other secret. It holds no Cashfree
credential and makes no outbound request, so there is nothing here that could reach a browser.

The response carries the order number, the total and the balance, and nothing else — no name,
no phone number, no address, no line item and no cost figure. None of those are selected by the
query, so no future edit to a consumer can put one on the page.
