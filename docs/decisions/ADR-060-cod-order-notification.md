# ADR-060: A cash-on-delivery order notifies the owner from the route that wrote it, and the write is the warrant

- **Status:** Accepted
- **Date:** 2026-08-28
- **Prompt:** 102

## Context

The owner's WhatsApp notification predates the database. `/order-confirmation` fires
`notifyAdminOfPaidOrder` the moment verification first returns `PAID`, and
[`/api/notify-admin`](../api/notify-admin.md) asks Cashfree whether that order was really paid
before sending anything. That Cashfree lookup is not incidental: the browser sends an order id
and nothing else that decides anything, and without the lookup the route would be an open
endpoint for sending the owner arbitrary WhatsApp messages by naming any order id.

[ADR-059](ADR-059-checkout-payment-paths.md) added a checkout path with no payment. A
cash-on-delivery order never reaches Cashfree, is filed under a `COD_…` reference that
`isMorchadiOrderId` deliberately rejects, and is refused by `/api/verify-order` before any
gateway call. Every one of those guards is working as designed, and together they mean the
existing notification can never fire for a COD order. The result was a real operational gap: a
cash-on-delivery order arrives in Postgres and in the admin panel, and nothing tells the owner
it is there.

The partial path does not have this gap. A `partial_cod` order goes to Cashfree for its floor,
`/api/verify-order` returns `PAID` on that payment, and the confirmation page notifies exactly
as it does for a fully prepaid order. This was confirmed by reading the path rather than assumed;
see the consequences below for the smaller thing that is wrong with its message.

## Decision

### 1. The COD notification is sent by `/api/create-order`, from the branch that captured the order

Immediately after `captureOrder` returns `CAPTURED`, the COD branch calls
`notifyOwnerOfCodOrder` in `lib/notify-cod.ts` with the order number Postgres just assigned, the
`COD_…` reference, the address it validated and the amounts it computed from
`data/products.json`. No browser is involved and no endpoint is added.

### 2. The write is the warrant. There is no second verification

`/api/notify-admin` re-verifies because its caller is a browser. Here the caller is this
server, one statement after the row was committed, holding data it derived itself. There is
nothing to re-verify: the row's existence *is* the verification, and it is a stronger one than
the Cashfree lookup, because it checks against something this server just wrote rather than
against a third party's answer about it.

The alternative considered in detail — a second code path inside `/api/notify-admin` that takes
a `COD_…` reference and looks it up in Postgres — is rejected below.

### 3. The send is not awaited

`void notifyOwnerOfCodOrder(...)`. The shopper is blocked on this response, unlike the paid
case where the browser fires the notification after the confirmation screen is already up.
`CALLMEBOT_TIMEOUT_MS` is five seconds, and five seconds of spinner on an order that is already
in Postgres would be a worse checkout than no notification at all. The function is typed and
written so that its promise cannot reject, so nothing is left unhandled.

### 4. The message never says anything has been paid

`composeCodOrderMessage` is a sibling of `composeAdminOrderMessage`, not a flag on it. It
carries the same sections in the same order — identifiers, campaign, items with their chosen
options, the money breakdown, the delivery address, the closing instruction — and differs in
exactly the places where the paid message would state a falsehood:

| Paid message | Cash-on-delivery message |
| --- | --- |
| `*New Order - Morchadi Gems*` | `*New Cash on Delivery Order - Morchadi Gems*` |
| `*Paid:* ₹746` | `*Payment:* Cash on delivery. Nothing has been paid yet.` |
| — | `*Due on delivery:* ₹746` |
| `*Order:* MG_…` (the Cashfree reference) | `*Order:* K7M2QPX9RJ` and `*Reference:* COD_…` |
| `Check the Cashfree dashboard to confirm the payment.` | `Collect ₹746 in cash at delivery, then mark the cash collected on order K7M2QPX9RJ in the admin panel.` |

There is no `Paid:` line to misread and no Cashfree dashboard to point at. The order number is
printed first because it is what the admin panel is searched by; the `COD_…` reference is
printed beside it because it is what the server log names and what
[`/api/cod-order`](../api/cod-order.md) is keyed on.

### 5. The amounts are the server's own, so there is no untrusted summary to caveat

The paid message is built from a client `summary` and says so — its subtotal and shipping are
labelled as the shopper's own figures, and it degrades to the order id and the amount when that
summary fails validation. The COD message has no such input and needs no such fallback: every
line of it comes from the order this route priced and wrote. A COD message that exists at all is
a message about a real row.

### 6. The failure discipline is the one `lib/notify.ts` already had

`sendOwnerWhatsApp` is the send, extracted from `dispatchAdminNotification` and knowing nothing
about why it was called. Both callers get the same five-second timeout, the same absence of
retry, and the same treatment of every fault as a logged outcome rather than an exception. A
missing `CALLMEBOT_PHONE` or `CALLMEBOT_APIKEY` switches the feature off rather than breaking
anything, exactly as it always did.

`dispatchAdminNotification` keeps its `PAID` guard, first and unchanged. Extracting the send did
not move it, and no COD code path reaches it.

## Alternatives considered

**A second code path inside `/api/notify-admin`, warranted by a Postgres read.** Given a
`COD_…` reference, look the order up by `cashfree_order_id` and send only when the row reads
`payment_type = 'cod'` and `cashfree_payment_status = 'NOT_APPLICABLE'`. This was the design
proposed when the gap was first flagged, and it would work. It was rejected for three reasons.

First, it builds a verification mechanism to re-establish something the calling code already
knows for certain. The route that wrote the row does not need to ask the database whether the
row is there.

Second, it widens an endpoint whose entire safety argument is that it is narrow. Today
`/api/notify-admin` has one shape: one id pattern, one lookup, one guard. A second accepted id
pattern and a second warrant doubles the surface that has to stay correct, and every future
change to the route has to be checked against both. The endpoint would also become replayable
for COD: anyone holding their own `COD_…` reference could re-POST it to message the owner
repeatedly, where the current design gives an outsider no way to trigger a COD message at all.

Third, it puts the notification behind the browser again, and the browser is where the COD
confirmation screen is *least* certain: `/api/verify-order` refuses COD references by design, so
the page has no verified payment result to hang the call on.

**Awaiting the send inside the checkout response.** Simpler to reason about and simpler to test,
and it makes a hobby service's bad day into a five-second checkout. Rejected for the shopper.

**A flag on `composeAdminOrderMessage`.** One message with `isCod` branches. Rejected: the two
messages differ in what they may truthfully assert, and a boolean is a poor place to keep that
distinction. Every shared piece — the address block, the item lines with their chosen options,
the campaign section, the rupee formatting — is shared as a function instead, and the item
formatter now takes the narrowest shape that describes a line, so a `CartItem` from a client
bundle and an `OrderCaptureLine` the server wrote both satisfy it.

## Consequences

- A cash-on-delivery order reaches the owner as a WhatsApp message, and a fully prepaid order's
  notification is byte-identical to what it was. Two route tests pin that `/api/create-order`
  sends nothing to CallMeBot on either gateway path even with the keys configured.
- A COD notification that fails is lost. There is no retry, no queue and no record of the
  attempt beyond the server log — the same trade `lib/notify.ts` has always made, and it costs
  less now than it did before ADR-042, because the order is in Postgres and on the admin list
  whether the message arrives or not.
- The send is not awaited, so a process killed in the moment after a COD checkout responds can
  drop the message. Accepted, for the same reason.
- **The `partial_cod` message is thinner than it should be.** It goes out, correctly and through
  the unchanged Cashfree-verified path, but it is composed by `composeAdminOrderMessage`, which
  prints `*Paid:*` for the floor Cashfree charged and the bundle's own total, and says nothing
  about the balance owed at the door. Nothing it prints is false. It is incomplete, and closing
  that is a separate change to the paid message rather than to this one, deliberately out of
  scope here.
