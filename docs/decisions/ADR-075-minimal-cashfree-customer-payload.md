# ADR-075: The Cashfree order payload carries only what Cashfree needs

- **Status:** Accepted
- **Date:** 2026-09-01
- **Prompt:** 120

## Context

Since [ADR-013](ADR-013-order-creation-and-payment.md) the create-order route has sent Cashfree
a `customer_details` object holding four fields — `customer_id`, `customer_name`,
`customer_email` and `customer_phone` — and, since
[ADR-039](ADR-039-analytics-and-utm-attribution.md), an `order_tags` map holding the shopper's
recorded option choices *and* the campaign they first arrived on under `utm_source`,
`utm_medium` and `utm_campaign`.

Two of those four customer fields and all three campaign tags were never load-bearing. They
were sent because the gateway's documentation shows them in its example body, and an example
body is not a requirement. What was missing was an answer to the question that decides whether a
field belongs in an outbound payment request at all: **does the gateway do anything with it?**

Cashfree support answered it in writing on **ticket 8314128, confirmed 2026-09-01**:

- `customer_id` and `customer_phone` are the **only mandatory** members of `customer_details`.
- `customer_email` is **explicitly optional**, and supplying it affects **neither the payment
  methods offered to the shopper nor the gateway's fraud scoring**.

That removes the only two arguments that could have justified sending the shopper's inbox — a
narrower set of payment methods, or a worse risk decision. Neither is real. `customer_name` was
never mandatory and was never claimed to influence anything.

The campaign tags are a separate question with the same answer. Attribution is reported from
Postgres, where `captureOrder` has written `utm_source`, `utm_medium`, `utm_campaign`, `term`
and `content` on every order since [ADR-042](ADR-042-order-capture-in-postgres.md). Nobody reads
a campaign off the Cashfree dashboard, and no report is built from one. The tags were a
duplicate copy of a record the shop already owns, held by a third party who has no use for it.

This shop has no accounts and creates no customer records by choice
([ADR-001](ADR-001-tech-stack.md)). Sending a payment processor a shopper's name, inbox and
marketing attribution — while sending it nothing that makes the payment work better — sits
badly beside that.

## Decision

**The body sent to `POST {base}/pg/orders` is cut to the minimum the gateway requires, plus the
one field the shop's own fulfilment depends on.**

`customer_details` is now exactly:

```json
{ "customer_id": "guest_a7f2k9m3x1qd", "customer_phone": "+919876543210" }
```

`customer_name` and `customer_email` are gone. `order_tags` keeps the option summary —
`{"options": "P001:Letter=A"}` — and loses `utm_source`, `utm_medium` and `utm_campaign`.
`buildOrderTags` no longer takes a `utm` argument and cannot reach one.

The option tags stay, and the distinction is the whole decision in miniature: a packer reads
the engraving choice off the payment record, so that tag does operational work at Cashfree. A
campaign tag does none. **A field that does no work at the gateway does not travel to the
gateway.**

**Nothing about the order record changes.** `captureOrder` receives and writes the same
`address` — name, email, phone, both lines, city, state, pincode — the same `utm`, the same
gift message and the same lines it always did. The database capture path is untouched by this
ADR, and `lib/cashfree-order-payload.test.ts` asserts both halves of the same checkout: the
narrowed body handed to `fetch`, and the unnarrowed input handed to `captureOrder`.

The reasoning is written into `app/api/create-order/route.ts` as a doc comment on the payload,
naming the ticket and the date, because a payload that is short by four fields a reader expects
is otherwise indistinguishable from one where four fields were forgotten.

## Alternatives considered

**Leave the payload as it was.** The status quo costs nothing operationally, which is exactly
why it survived this long. Rejected because "it has always been sent" is not a reason to keep
sending a shopper's inbox to a party that has confirmed in writing it does nothing with it. The
support ticket converted an assumption into a fact, and the fact points one way.

**Drop `customer_email` but keep `customer_name`.** A half-measure with no principle behind it.
The name is no more mandatory than the email and no more useful to the gateway; keeping it would
leave the payload arbitrary rather than minimal, and the next reader would have to re-derive why
one stayed and one went.

**Keep the UTM tags, drop only the customer fields.** Rejected for the same reason. The tags
are a second copy of a record Postgres already holds authoritatively, and a second copy in a
system nobody queries is a liability with no reader.

**Send a hashed or truncated email instead.** More code, a new thing to get wrong, and it buys
nothing the gateway has said it wants. There is no scoring benefit to preserve, so there is
nothing for a hash to preserve it with.

**Stop capturing the name, email and campaign entirely.** Out of scope and wrong. The shop
needs the name to address a parcel, the email to send the confirmation
([ADR-062](ADR-062-customer-order-confirmation-email.md)), and the campaign to know which
spend worked. What changed is who else holds a copy, not whether the shop does.

## Consequences

**Easier.** The order request now says exactly what a payment needs: an amount, a currency, a
reference, a phone number to reach the payer, a return URL, and the fulfilment detail a packer
reads. Every field in it is answerable to "why is this here". A future reader who wonders
whether more of the shopper belongs in the payload has a ticket number and a date to check
against rather than a guess to make.

**Harder.** The Cashfree dashboard now shows a phone number rather than a name against a
payment, and a campaign is no longer visible there at all. Anyone who was reconciling by name in
that dashboard reconciles by `order_id` instead — which is the reference
[`/api/verify-order`](../api/verify-order.md), `orders.cashfree_order_id` and every refund
already key on, so the join was always there. Attribution questions go to Postgres and to the
admin panel, which is where they were already answered.

**Cashfree-side prefill is gone.** If the hosted checkout page ever pre-filled a name or email
from `customer_details`, it no longer can. The shopper still types nothing extra — the phone
number is the field those pages actually key on — but a future change to their hosted page could
make this visible. Should that happen, restore the field with a note, not silently.

**What would force a revisit.** Cashfree making `customer_email` mandatory, or reversing ticket
8314128 and stating that email materially affects payment-method availability or fraud scoring.
Either is a new ADR, not an edit to this one. A shopper-facing complaint that hosted checkout
now asks for something it used to know would be the practical early warning.

**What this does not license.** This is not a precedent for trimming what the shop records.
Postgres is the shop's own system and the order row is its memory; ADR-042's capture is
deliberately wide and stays that way. The rule this ADR sets applies only to what crosses the
boundary to a third party.
