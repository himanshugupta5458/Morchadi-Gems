# ADR-043: The ten-character order id is the order's public name

- **Status:** Accepted
- **Date:** 2026-08-20
- **Prompt:** 49

## Context

[ADR-040](ADR-040-postgres-for-orders.md) gave `orders.id` a deliberate shape: ten characters
over a 31-character alphabet with `0`, `O`, `1`, `I` and `L` removed, because the id is read
aloud over WhatsApp, written on a courier label and typed into a tracking box.
[ADR-042](ADR-042-order-capture-in-postgres.md) started minting one on every checkout.

Neither shipped anywhere that shows it. Since ADR-042 the situation has been:

| Identifier | Shape | Where it appears |
| --- | --- | --- |
| `orders.id` | `W2ACEHACUU` | The database, and nowhere else |
| `orders.cashfree_order_id` | `MG_1787216369300_3u923cgt` | The return URL, `/api/verify-order`, the confirmation page, the WhatsApp notification |

So the id designed to be read by a person existed only where no person could see it, and the
one a shopper was actually asked to quote was a 25-character machine reference with a
millisecond timestamp in the middle of it. The create-order response called that one `orderId`
with nothing beside it, which is why the mistake was invisible: there was no second id in the
contract for it to be confused with.

Three things were about to be built on top of that. The order detail page keys on one of these
ids. The tracking page accepts one in an input box. Every WhatsApp conversation about an order
names one. Choosing late means changing all three plus everything already shipped.

## Decision

**The ten-character `orders.id` is the order's public identity from here on.** It is what the
confirmation page shows as "Your order number", what the admin order list keys every row on,
and what the tracking page will accept. The Cashfree id is demoted to what it always was — the
payment's name, not the order's.

**The create-order response names both, and calls neither of them `orderId`.**

| Old (through prompt 48) | New (prompt 49) |
| --- | --- |
| `orderId: string` — the Cashfree id | `cashfreeOrderId: string` — the same value, under a name that says what it is |
| — | `trackingId: string \| null` — `orders.id`, the customer-facing order number |
| `paymentSessionId: string` | unchanged |
| `mode: "sandbox" \| "production"` | unchanged |

Renaming rather than adding beside `orderId` is the point. A response carrying `orderId` *and*
`trackingId` reads as an id and a secondary reference, and every future consumer would have to
be told which is which. With both names qualified there is nothing left to guess, and every
existing reader had to be found and updated rather than continuing to compile against a key
whose meaning had quietly changed.

`trackingId` is nullable because ADR-042 made the Postgres capture allowed to fail without
failing the checkout. A shopper can reach a confirmed payment with no order row and therefore
no order number; the response says so rather than inventing one.

**The confirmation page learns the order number from the `sessionStorage` checkout bundle.**
`/payment` already stamps that bundle with the Cashfree order id immediately before leaving for
the gateway; it now stamps both ids together. The confirmation page shows the stored order
number only when the stored Cashfree id matches the order it is confirming, so a leftover
bundle from an abandoned checkout cannot label somebody else's payment.

## Why now rather than in the tracking-page prompt

Deferring was the cheaper option in the moment and the more expensive one overall.

The confirmation page had already shipped. Every day it stays up is more shoppers holding a
`MG_…` reference they were told to keep, and a support conversation that quotes an identifier
the admin panel will not accept. The admin order list built in this same prompt has to key its
rows on something, and building it on the Cashfree id would have meant rebuilding it — along
with the detail route the rows link to — one prompt later.

The window in which this is a rename of one response key and one page is now. After the detail
page, the status-change UI and the tracking page it is a rename across four surfaces and a
migration of whatever people have written down.

## Alternatives considered

**Leave the Cashfree id as the customer-facing one and never show `orders.id`.** Cheapest, and
it makes ADR-040's alphabet pointless: a 25-character mixed-case string with underscores cannot
be read over a phone, and `MG_1787216369300_3u923cgt` has three characters ADR-040 specifically
removed. It also welds the shop's public order references to a payment vendor — moving off
Cashfree would orphan every order number ever quoted.

**Put the order number in the return URL.** The cleanest answer, and the one that survives a
refresh, a second device and a browser that refuses `sessionStorage`. It cannot be done without
restructuring `/api/create-order`: the return URL is sent to Cashfree in the same request that
mints the session, and the capture that generates the order number runs after that request
returns. Reordering them means the order is written before there is a payment session to attach
it to, which changes what a capture failure means on the money path. That is its own decision
and it is not this prompt's.

**Have `/api/verify-order` return the order number from Postgres.** Also durable, and a natural
fit — the confirmation page already calls it. Rejected here only because it widens a route on
the money path in a prompt whose brief was explicitly to change nothing in `create-order` or
`verify-order` beyond the response shape above. It is the recommended fix for the limitation
below and should be taken with the tracking page.

**Show both ids with equal weight.** Two identifiers on a receipt means half the support
conversations quote the wrong one. The Cashfree id stays, in fine print, labelled "Payment
reference" — it is the only key a bank dispute or a Cashfree dashboard lookup can use, so
dropping it entirely would cost the owner a real tool.

## Consequences

A shopper is now given an identifier they can read back, and it is the same one the operator
sees in the admin list, so a WhatsApp message names a row rather than requiring a lookup. The
tracking page has an input format that was designed for exactly this.

**The known limitation: the order number is carried in `sessionStorage`, so it does not survive
a refresh of the confirmation page.** The bundle is cleared the moment a payment is confirmed —
by design, so a shopper cannot re-enter a completed checkout — and a refresh after that finds
nothing. The page degrades to "Payment reference `MG_…`", which is what it showed before this
change, so nothing is worse than it was; it is simply not yet as good as it should be. The same
applies to a shopper who opens the confirmation link on a second device or in a browser that
refuses session storage. The fix is the verify-order route above, and it belongs with the
tracking page.

`trackingId` being nullable is a small tax on every consumer, and it is the honest shape: it is
null exactly when ADR-042's off-critical-path write did not land, and a consumer that cannot
handle that is a consumer that would have shown a shopper an order number for an order nobody
recorded.

Anything reading the create-order response by the old key breaks loudly at compile time rather
than quietly at runtime — `CreateOrderSuccess` no longer has an `orderId` field, and
`isCreateOrderSuccess` rejects a body carrying the old shape.
