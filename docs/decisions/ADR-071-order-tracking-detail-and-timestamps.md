# ADR-071: `/track` shows the order's contents and the clock, and still shows no address

- **Status:** Accepted
- **Date:** 2026-08-31
- **Prompt:** 115
- **Narrows:** [ADR-045](ADR-045-public-order-tracking.md), which otherwise stands

## Context

`/track` answers one lookup for anyone holding a ten-character order number. It asks for nothing
else: no login, no email confirmation, no one-time code.
[ADR-045](ADR-045-public-order-tracking.md) therefore drew the projection deliberately narrow —
`PublicOrderTracking` carried an id, a placed-at date, a status, a collapsed history and a
refund, and `lib/order-tracking-page.test.tsx` asserted that twenty specific values from the
order row reached neither the rendered HTML nor the page's props.

Three things were asked of the page in this prompt.

The **timeline should read horizontally**, in the shape of the order-journey graphic already
built for the confirmation email — while keeping `collapseRepeatedStatuses`, the
`changedBy`/`reason` exclusion, and the empty-history fallback exactly as they behave.

The **timestamps should show the time**, reversing `formatTrackingDate`'s deliberate day-only
behaviour.

And the page should show **the order's items, its delivery address and its payment summary**,
described in the brief as "reusing existing data already available to this page". That premise
was wrong in a way worth recording: none of it was on the page, none of it was in the props, and
a committed 300-line suite existed specifically to keep it that way.

## Decision

### Items and a payment summary: yes

`PublicOrderTracking` gains `items` — product name, snapshot photograph, quantity and recorded
options — and `payment`, which is `total`, `paid` and `due`.

No per-line price. `unit_price` stays unselected, because what the order is worth is stated once
and a second money field on an unauthenticated page buys nothing; `unit_cost` is margin data and
was never a candidate. `subtotal`, `shipping_fee`, `total_cost` and `payment_type` stay
unselected for the same reason: the question this page answers about money is "is there anything
left to pay when the courier arrives", and `due` answers it.

### The delivery address: no

Refused, on the owner's explicit instruction and on ADR-045's original reasoning, which has not
weakened. An order number travels — it is read aloud over WhatsApp, forwarded in an email,
screenshotted, pasted into a chat — and every place it lands would otherwise be a place someone's
home address lands with it. Items and a payment summary tell the person who placed the order what
they need; the address tells a stranger where they live.

The customer's name, phone number and email are likewise still absent, as are `changedBy`,
`reason`, `cashfree_order_id` and the UTM fields. Every one of them is *unselected*, not filtered
at render time, so no future edit to a component can put one on the page.

### Timestamps: date and time

`formatTrackingDateTime` is new; `formatTrackingDate` is unchanged and still read by the
confirmation email's "Placed on" line and by the refund sentence.

Day-only was chosen so a timestamp accurate to the minute would not invite *"it says 4:12pm, so
why has nothing moved by 4:40pm"*. What it produced instead was a timeline of three rows reading
"1 May 2026, 1 May 2026, 1 May 2026" — an order placed, packed and collected inside a working day
looked like three events that had not happened, which is a worse version of the same worry and
one the customer cannot resolve by reading harder. Showing the time answers it directly: two
events on one day are visibly hours apart. The original concern is real, and it belongs to the
copy — `describeOrderStatusForCustomer` says what happens next in words — rather than to the
precision of a fact.

Short month rather than long, because the horizontal layout puts these under narrow columns and
"September" wraps where "Sep" does not.

### Non-linear statuses: the admin panel's own treatment, reused

The admin order detail page has **no special case** for `cancelled`, `rto` and `returned`. It
badges every status with `orderStatusBadgeClasses` — one hue each from the `status-*` tokens, at
a 10% wash, a 35% border and full-strength text, with the label always written out beside it so
colour is never the only signal.

The customer timeline calls **the same function**, so a state cannot look one way to the operator
and another way to the customer. What differs is only the vocabulary:
`getCustomerOrderStatusLabel` says "Came back to us" where `getOrderStatusLabel` says "RTO".
`orderStatusMarkerClasses` is added alongside it for the timeline's filled dot, which has no room
for a label inside it — hence the label directly under every dot.

The vertical component's own philosophy — mark the last row as current rather than styling by
status — is kept as well, and the two are complementary rather than alternatives: the hue says
*what* happened, the current-state marker says *where the order is now*, and a timeline reads the
same way on a happy order and an unhappy one.

## Alternatives considered

**Show the address, as originally briefed.** Put to the owner with the conflict stated. Declined:
"do NOT add the delivery address to this page under any circumstances — the page has no
authentication and a tracking link can end up somewhere unintended."

**Gate the whole page behind order number + phone or email.** Would allow the address, and would
break the one property `/track` was built for — a customer coming back days later with nothing
but the number, and the confirmation page's one-click link with the number already in it. A
larger change than this prompt, and not obviously worth it for a field nobody asked to see.

**Mask the address — city and state only.** Rejected as the worst of both: still a location, and
now one the customer cannot use to check that the parcel is going to the right place, which was
the only reason to show it.

**Change `formatTrackingDate` in place.** Would have moved the confirmation email's "Placed on"
line to a clock time it has no use for. A single date stated once in prose has none of the
problem the timeline had — there is no second date beside it to look identical to.

**Invent a customer-facing palette for the three unhappy statuses.** Rejected: it would be a
second answer to a question the admin panel has already answered, and the two would drift.

## Consequences

The privacy suite is rewritten rather than relaxed. `WITHHELD_VALUES` holds the fifteen tokens
still forbidden; `SHOWN_VALUES` holds the five now asserted **present**, because a
`not.toContain` left behind on a value the page renders is a test that passes by accident. The
address gets an assertion of its own, outside the loop, so a future change that widens the query
cannot bury it in a list somebody edited. `PublicOrderItem`'s key set is asserted exactly, so a
column added to the `select` fails here rather than arriving unnoticed.

The `status-*` colour group is no longer admin-only. `tailwind.config.ts`'s comment said "nothing
a shopper sees uses these" and has been corrected; the hues themselves are unchanged.

`/track` now issues one query returning line items as well as the order row. It is
`force-dynamic` already and reads no more tables than the admin detail page does.

Revisit this if `/track` ever grows a second factor, at which point the address becomes a
reasonable thing to show; and revisit the timestamp if customers start reading the minute as a
promise rather than as a record.
