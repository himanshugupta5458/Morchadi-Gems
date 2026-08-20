# POST /api/notify-admin

Sends the shop owner a WhatsApp message describing an order, but only after re-confirming
with Cashfree that the order was genuinely paid.

This route was written when there was no database
([ADR-001](../decisions/ADR-001-tech-stack.md)), and the message it sends, together with the
Cashfree dashboard, **was** the order record: Cashfree knows the amount and the payer, and this
message carries what Cashfree does not — which pieces, how many, and which letter or colour was
chosen on each.

**As of [ADR-042](../decisions/ADR-042-order-capture-in-postgres.md) that is no longer the only
record** — `/api/create-order` writes the order to Postgres, and this message is now a
notification rather than the archive. **Nothing about this route changed.** It still reads no
table, writes no table, and derives every fact it prints from Cashfree and from the client
summary exactly as described below. It also becomes the fallback that makes the capture write
safe to fail: an order whose Postgres write failed still reaches the owner as a WhatsApp
message.

**There is no ADR for this route.** The admin-notification work was in flight when slot 031
was taken by [ADR-031](../decisions/ADR-031-mobile-scale.md), and no record was ever written
for it — see the numbering note on row 32 of the
[build log](../progress/BUILD_LOG.md). This contract is the reference document for the route.

## Request

`Content-Type: application/json`

```ts
interface NotifyAdminRequest {
  /** Must match /^MG_\d{13}_[0-9a-z]{8}$/. The only field that decides anything. */
  orderId: string;
  /**
   * The shopper's own summary of the basket, for the message body. Optional, untrusted, and
   * validated for shape only. Same object as the `sessionStorage` checkout bundle.
   */
  summary?: CheckoutData;
  /**
   * The campaign the browser recorded as its first touch, when it has one. Optional,
   * untrusted, validated for shape only, and present on a minority of orders.
   */
  utm?: UtmParams;
}
```

The browser sends this once, from `/order-confirmation`, at the moment verification first
returns `PAID`. It does not read the response.

## Server-side validation

In order:

1. **Body is JSON and an object.** Anything else is treated as an absent body.
2. **`orderId` matches the minted order-id pattern**, via `isMorchadiOrderId`. This runs before
   any network call, so a malformed id costs nothing. Rejected as
   `SKIPPED_INVALID_REQUEST`.
3. **Cashfree is asked about that order**, through `lookupCashfreeOrder` — the same helper
   `/api/verify-order` uses, so the two routes cannot reach different conclusions about the
   same order. Anything other than a clean answer is `SKIPPED_NOT_PAID`.
4. **`order_status` must normalise to `PAID`.** `PENDING`, `FAILED` and `NOT_FOUND` all send
   nothing.
5. **CallMeBot credentials must be present.** Absent is a supported state, not an error.

### What the server decides, and what the client only describes

| Value | Source | Why |
| --- | --- | --- |
| Whether to send at all | Cashfree `order_status` | The client naming an order is not evidence it was paid. Without this the route would send the owner arbitrary WhatsApp messages on request. |
| The amount printed | Cashfree `order_amount` | The only authoritative amount, as everywhere else in this project. |
| Order id printed | Cashfree, falling back to the requested id | |
| Items, quantities, chosen options, delivery address | The client `summary` | Fulfilment detail the server has no record of. It is display text in a message to the owner: it decides nothing, prices nothing, and is validated for shape by `parseCheckoutValue`. |
| The campaign the order came from | The client `utm` | Marketing detail the server has no record of either. Validated for shape by `parseUtmParams`, printed as a `*Came from*` section, and consulted for nothing. Absent means no section is printed at all. See [ADR-039](../decisions/ADR-039-analytics-and-utm-attribution.md). |

A `summary` that fails validation is dropped, not rejected — the message degrades to the order
id and the amount, and tells the owner to open the Cashfree dashboard.

## Responses

**Always `200`, always `Cache-Control: no-store`.** The caller is a browser mid-confirmation
that discards the reply. A non-2xx here would put an error in the console of a successful
checkout, and would invite some future caller to surface it to a customer. The outcome travels
in the body instead.

```ts
interface NotifyAdminResponse {
  status:
    | "SENT"                     // CallMeBot accepted the message
    | "SKIPPED_INVALID_REQUEST"  // no readable order id
    | "SKIPPED_NOT_PAID"         // Cashfree did not say PAID, or could not be reached
    | "SKIPPED_NOT_CONFIGURED"   // CALLMEBOT_PHONE or CALLMEBOT_APIKEY unset
    | "FAILED";                  // CallMeBot timed out, refused, or returned non-2xx
}
```

There is no error body and no error status code. Every outcome above is logged server-side
with the `[notify-admin]` prefix.

## Side effects

1. `GET` to Cashfree's order endpoint, 15s timeout, to establish the status.
2. `GET https://api.callmebot.com/whatsapp.php?phone=…&text=…&apikey=…`, **5s timeout, no
   retry**, only when step 1 said `PAID`.

The short timeout is deliberate. CallMeBot is a free hobby service with no uptime commitment,
and this request happens while a shopper is looking at their confirmation screen.

Nothing here writes any state — not even now that there is a database to write to; the only
checkout routes that touch Postgres are [`/api/create-order`](create-order.md) and
[`/api/verify-order`](verify-order.md). Duplicate suppression lives in the browser, as a
`sessionStorage` flag keyed `morchadi-notified:{orderId}`, and is best-effort: a second tab or
a cleared session will notify twice. A duplicate WhatsApp is harmless; a blocked confirmation
is not.

## Security notes

| Secret | Read where | Why it cannot leak |
| --- | --- | --- |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` | `lib/cashfree-config.ts` | Imports `server-only`; importing it from a client component is a build error. |
| `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` | `lib/notify.ts` | Neither carries `NEXT_PUBLIC_`. `lib/notify-boundary.test.ts` asserts the stronger property: no `"use client"` module reaches `lib/notify.ts` at any import depth, and no client module so much as names the variables. |

The message is percent-encoded with `URLSearchParams`, so a product name or address containing
`&apikey=` cannot inject a query parameter. This is covered by a test.

`runtime = "nodejs"` and `dynamic = "force-dynamic"`: the route holds secrets and performs an
action, so it is never prerendered, never cached, and never runs on Edge.
