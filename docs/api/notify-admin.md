# POST /api/notify-admin

Sends the shop owner a WhatsApp message describing an order, and emails the customer their own
confirmation — both only after re-confirming with Cashfree that the order was genuinely paid.

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

**Prompt 102 added the owner's cash-on-delivery notification, and changed nothing here.** A
`COD_…` reference is rejected by `isMorchadiOrderId` at step 2 below, exactly as it was before,
and no COD code path calls this route: a cash-on-delivery order is notified from inside
`/api/create-order`, by the branch that captured it, because there is no payment for this route
to ask Cashfree about. The Cashfree lookup below is the whole security argument for this
endpoint and it was deliberately not widened with a second warrant — the reasoning, including
what a Postgres-read warrant here would have cost, is
[ADR-060](../decisions/ADR-060-cod-order-notification.md). The send itself now lives in
`sendOwnerWhatsApp`, shared with that path; the `PAID` guard that decides whether to call it is
unmoved.

**There is no ADR for the WhatsApp half of this route.** The admin-notification work was in
flight when slot 031 was taken by [ADR-031](../decisions/ADR-031-mobile-scale.md), and no
record was ever written for it — see the numbering note on row 32 of the
[build log](../progress/BUILD_LOG.md). This contract is the reference document for that half.

**Prompt 103 added the customer email, reusing this route's warrant rather than building a
second one.** This is the one place a paid or partially-paid order's Cashfree status is
re-verified, so the customer confirmation is dispatched from here too, after the same `PAID`
check that gates the WhatsApp send — see step 4 below and
[ADR-062](../decisions/ADR-062-customer-order-confirmation-email.md). The email additionally
reads `orders.amount_due` (`findCapturedOrderForPaymentReference`, the same function
[`/api/verify-order`](verify-order.md) calls) so a partial-payment order's email can state the
balance still due — a gap the WhatsApp message deliberately still has, recorded in
[ADR-060](../decisions/ADR-060-cod-order-notification.md)'s consequences and left there on
purpose; see ADR-062 for why closing it here and not there was the right call.

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
   nothing — to the owner or to the customer.
5. **CallMeBot credentials must be present**, for the WhatsApp send. Absent is a supported
   state, not an error.
6. **`RESEND_API_KEY` must be present, and the order must carry a customer email**, for the
   email. Both are independent, supported absences: no key skips the send with a logged
   `SKIPPED_NOT_CONFIGURED`, and no email (the `summary`'s address, or no `summary` at all)
   skips it with a logged `SKIPPED_NO_EMAIL`.

### What the server decides, and what the client only describes

| Value | Source | Why |
| --- | --- | --- |
| Whether to send at all | Cashfree `order_status` | The client naming an order is not evidence it was paid. Without this the route would send the owner arbitrary WhatsApp messages on request. |
| The amount printed | Cashfree `order_amount` | The only authoritative amount, as everywhere else in this project. |
| Order id printed | Cashfree, falling back to the requested id | |
| Items, quantities, chosen options, delivery address | The client `summary` | Fulfilment detail the server has no record of. It is display text in a message to the owner: it decides nothing, prices nothing, and is validated for shape by `parseCheckoutValue`. |
| The campaign the order came from | The client `utm` | Marketing detail the server has no record of either. Validated for shape by `parseUtmParams`, printed as a `*Came from*` section, and consulted for nothing. Absent means no section is printed at all. See [ADR-039](../decisions/ADR-039-analytics-and-utm-attribution.md). |
| The customer's own email address | The client `summary.address.email` | The only place this route learns who to email — Cashfree has no idea what this shop calls its customers. A `summary` that fails validation, or is absent, leaves no address to send to, and the email is skipped rather than guessed at. |
| Whether the email states a balance due | `orders.amount_due`, read from Postgres by `findCapturedOrderForPaymentReference` | The one fact in this route that comes from neither Cashfree nor the client. Null (no row, or the database did not answer) is rendered as though nothing is due, mirroring how `/order-confirmation` already treats the same ambiguity. |

A `summary` that fails validation is dropped, not rejected — the WhatsApp message degrades to
the order id and the amount and tells the owner to open the Cashfree dashboard, and the
customer email is skipped outright for want of an address.

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

There is no error body and no error status code. Every WhatsApp outcome above is logged
server-side with the `[notify-admin]` prefix; every email outcome is logged with the
`[notify-customer-email]` prefix by the module that owns it. **The response body's `status`
field reflects the WhatsApp send only** — it existed before the email did, and the browser that
calls this route already discards the reply, so widening it to a second field would inform
nobody. The email's outcome is server-log-only, exactly like the WhatsApp outcome was before
this contract had a test suite to assert on it.

## Side effects

1. `GET` to Cashfree's order endpoint, 15s timeout, to establish the status.
2. `GET https://api.callmebot.com/whatsapp.php?phone=…&text=…&apikey=…`, **5s timeout, no
   retry**, only when step 1 said `PAID`.
3. `GET` (read-only) to Postgres via `findCapturedOrderForPaymentReference`, to learn the order
   number and the balance due for the email — never throws, and a failure here degrades the
   email's honesty about the balance rather than blocking it (see the table above).
4. `POST https://api.resend.com/emails`, **8s timeout, no retry**, only when step 1 said
   `PAID` and the `summary` carried a usable email address.

The short timeouts are deliberate. CallMeBot is a free hobby service with no uptime commitment
and Resend's send is not materially different for this purpose — both requests happen while a
shopper is looking at their confirmation screen, and neither shopper is waiting on the answer.

The Postgres read at step 3 is the only state this route touches that is not Cashfree or a
third-party notification API — it writes nothing; the only checkout routes that write to
Postgres are [`/api/create-order`](create-order.md) and [`/api/verify-order`](verify-order.md).
Duplicate suppression for both notifications lives in the browser, as a `sessionStorage` flag
keyed `morchadi-notified:{orderId}` that gates the one `fetch` to this route — best-effort: a
second tab or a cleared session fires both again. A duplicate WhatsApp or a duplicate email is
harmless; a blocked confirmation is not.

## Security notes

| Secret | Read where | Why it cannot leak |
| --- | --- | --- |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` | `lib/cashfree-config.ts` | Imports `server-only`; importing it from a client component is a build error. |
| `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` | `lib/notify.ts` | Neither carries `NEXT_PUBLIC_`. `lib/notify-boundary.test.ts` asserts the stronger property: no `"use client"` module reaches `lib/notify.ts` at any import depth, and no client module so much as names the variables. |
| `RESEND_API_KEY` | `lib/notify-customer-email.ts` | Does not carry `NEXT_PUBLIC_`. `lib/notify-boundary.test.ts` asserts the same reachability property for it as for `CALLMEBOT_APIKEY`. |
| `DATABASE_URL` | `lib/prisma.ts`, reached via `findCapturedOrderForPaymentReference` | `import "server-only"` at the top of `lib/prisma.ts`; the read never returns a row to the client, only the two derived facts (order number, balance due) the email composer needs. |

The WhatsApp message is percent-encoded with `URLSearchParams`, so a product name or address
containing `&apikey=` cannot inject a query parameter. This is covered by a test. The email is
HTML, and every string placed into it — a name, an address line, a product title — is escaped
before it reaches the template, also covered by a test.

`runtime = "nodejs"` and `dynamic = "force-dynamic"`: the route holds secrets and performs an
action, so it is never prerendered, never cached, and never runs on Edge.
