# ADR-045: Public order tracking — the order number is the whole credential, and the page is told almost nothing

- **Status:** Accepted
- **Date:** 2026-08-20
- **Prompt:** 52

## Context

Three prompts deferred this page and each one named it.
[ADR-042](ADR-042-order-capture-in-postgres.md) closed by saying that surfacing the order
number "on the confirmation page, in the WhatsApp message, on a tracking box — is a later
prompt's work". [ADR-043](ADR-043-order-id-as-primary-identifier.md) minted the ten-character
id specifically so it could be "read aloud over WhatsApp, written on a courier label and typed
into a tracking box", and shipped with a stated limitation whose recommended fix "belongs with
the tracking page". [ADR-044](ADR-044-admin-order-detail-and-layout-split.md) built the
operator's view of an order, which is the screen this one must not become.

So the tracking page arrives with its identifier already decided and its data already in
Postgres. What was left to decide is narrower and sharper than "build a tracking page", and it
is three questions:

1. **Who is allowed to see an order.** There are no accounts. ADR-001 rejected them outright —
   "accounts mean stored credentials, password resets" — and [ADR-040](ADR-040-postgres-for-orders.md)
   explicitly left that row of ADR-001 standing when it added Postgres for orders. A customer
   who wants to know where their parcel is therefore has no identity to present. Something has
   to stand in for one.
2. **What the page may say about an order it has found.** `orders` and
   `order_status_history` now hold a customer's name, phone, address, the payment type, the
   Cashfree id, the campaign that won them, what each item cost the shop, which operator moved
   the order and what that operator typed about a courier's failure code. Almost none of that
   belongs on a page anyone with an order number can open.
3. **What stops somebody trying order numbers.** The page is public, unauthenticated, and
   answers a database query. That is a shape worth thinking about before shipping rather than
   after.

There is also one piece of debt to clear here, because ADR-043 said it should be cleared here:
the confirmation page loses the order number on a refresh.

## Decision

### The order number alone. No login, no phone or email check, no second factor

This is the owner's explicit decision, made earlier in this project, and it is the right one
for this shop. A customer types the ten-character number from their confirmation into a box and
sees their order. Nothing else is asked of them.

**What the number actually is.** It is not a password and it should not be described as one.
It is a capability: 31^10 ≈ 8.2 × 10^14 values, minted with `randomInt` from `node:crypto`, and
holding one is the whole of the claim to see that order. That is the same category of thing as
an unguessable link in an email receipt, which is how most small shops answer this question,
and it is honest about its own limits — anyone the number is shared with can see the order, and
the customer is the one who controls that.

**Why not a phone number as a second field.** This is the obvious alternative and it is worse
in a way that is easy to miss. Checking a typed phone against `customers.phone` turns the page
into an oracle for exactly the data it is meant to protect: hold one order number, try phone
numbers, and the page tells you when you have guessed right. Today the page cannot be made to
say anything about a customer at all. Adding the field would make it say something about a
customer for every submission, which is a strictly larger surface bought in the name of
shrinking one.

**Why not an OTP.** An SMS one-time code is real authentication, and it would cost a gateway
account, a per-message fee, a delivery-failure path, a rate limiter that has to be honest
because it now guards a credential, and a support burden on the shop's only operator when a
message does not arrive. That is a large amount of machinery to protect a page whose entire
output is "your parcel is with the courier". The value of what is behind the door has to be
weighed against the cost of the lock, and here it does not carry.

**What this consciously accepts.** Somebody who obtains an order number — over the shoulder, in
a forwarded screenshot, from a courier label photograph — can see that order's status and
timeline. They cannot see who placed it, where it is going, what was in it, or what was paid.
That is the reason the next section is drawn as tightly as it is: the field boundary is what
makes the weak credential a defensible choice rather than a shortcut. Loosen one and the other
stops being reasonable.

### What the page shows, and what it is never told

The exposure boundary is the substance of this ADR. It is stated here as two lists, and it is
enforced by **never selecting** the forbidden columns rather than by omitting them at render
time.

**Shown:**

| Fact | Source |
| --- | --- |
| The order number, echoed back | `orders.id` |
| When the order was placed | `orders.created_at` |
| Where the order is now, as a headline and a sentence | `orders.status`, put through the customer vocabulary below |
| A timeline: each status reached, and the date it was reached | `order_status_history.status` and `.changed_at` |
| A refund amount and the date it was made, **when money actually went back** | `orders.refund_amount`, `.refunded_at`, gated on `.is_refunded` |

**Never shown, and never selected:**

| Fact | Why not |
| --- | --- |
| `order_status_history.changed_by` | Which operator moved the order is a fact about the shop's staff, not about the parcel |
| `order_status_history.reason` | An internal note written for the shop — a courier's failure code, an address correction — in the shop's words, for the shop's purposes |
| `customers.name`, `.phone`, `.email` | The person is not something the page needs to name in order to say where a parcel is |
| `orders.shipping_address` | Same, and the single most damaging field to put behind a guessable identifier |
| `orders.payment_type`, `.amount_prepaid`, `.amount_due` | How the money was arranged is between the shop and the customer who already knows |
| `orders.cashfree_order_id`, `.cashfree_payment_status` | The payment reference is a key to a gateway dashboard and a bank dispute |
| `orders.utm_source`, `.utm_medium`, `.utm_campaign` | Attribution is the shop's data about its own marketing |
| `order_line_items` in full — name, image, options, `unit_price`, `unit_cost` | What was bought is not needed to say where it is, and `unit_cost` is margin data ([ADR-042](ADR-042-order-capture-in-postgres.md)) |
| `orders.subtotal`, `.total`, `.total_cost` | Same |

**The mechanism matters more than the list.** `PublicOrderStatusEvent` has two fields and
`PublicOrderTracking` has five. The Prisma `select` in `findPublicOrderTracking` names exactly
those columns and no others. A component cannot render a customer's phone number onto `/track`
because the phone number is not in the object the component is handed, and adding it would mean
editing a type, a query and a comment that says in as many words that this is a leak rather than
a feature. Filtering at render time would have made the same page today and a different page
after the first well-meaning edit.

Four smaller consequences of the same boundary:

**One message for every kind of miss.** A malformed number, a well-formed number nobody was
ever given, and a number belonging to an order whose Postgres capture failed all produce
`ORDER_NOT_FOUND_MESSAGE` and nothing else. `isPlausibleOrderId` exists only to spare the
database a query that cannot match; its verdict is never observable, because a page that
distinguished "that is not a valid order number" from "no such order" would tell somebody
probing the box exactly what shape to probe with. Same reasoning as
`ADMIN_LOGIN_FAILURE_MESSAGE` in [ADR-041](ADR-041-admin-subdomain-and-auth.md), at
proportionally lower stakes — an order number is not a credential in the sense a password is,
which is why this takes the cheap half of that precedent and not the `FAILED_LOGIN_FLOOR_MS`
timing floor that goes with it.

**A second vocabulary, not the operator's.** `lib/order-tracking-copy.ts` gives each of the
seven statuses a customer-facing label, headline and sentence, deliberately different from the
words `lib/order-status.ts` gives an operator. "RTO" is precise, is what the courier's dashboard
says, and is what the owner needs on a list of fifty orders; it is also an abbreviation that
means nothing to the person who was waiting for the parcel, so `/track` says "This parcel has
come back to us". No entry mentions an internal process, an operator or a reason.

**Dates, not timestamps.** `formatTrackingDate` renders a day in `Asia/Kolkata` and no clock
time, deliberately coarser than the admin screen's `formatAdminOrderDate`. An operator
reconciling a courier's manifest needs the minute. A customer does not, and a timestamp accurate
to the minute invites "it says 4:12pm, so why has nothing moved by 4:40pm".

**Repeated statuses collapse to the first of a run.** `order_status_history` is an audit table:
an address correction writes a row carrying the order's *unchanged* status purely so the reason
beside it is on the record. Rendered literally that reads "Order placed, Order placed". Keeping
the earliest of a run is also what makes the surviving date the date the status was actually
reached rather than the date somebody edited an address — the correction's existence stays
invisible, which is the same boundary again seen from the timeline's side.

**A refund is announced only when there is money to announce.** `refund_amount` is `0` on an
order where somebody decided nothing goes back, with `is_refunded` false beside it (the
derivation ADR-044 argued for). "A refund of ₹0 has been processed" is a sentence that would
worry a customer rather than inform one, so the block is gated on `is_refunded && amount > 0`.

### The page is public, cheap and not indexable

A `GET` form with one input, no `"use client"`, no state and no fetch. The order number goes in
the URL, which is what makes a lookup survive a refresh, work as a bookmark, and be linkable
from the confirmation page with the number already filled in. It also works with JavaScript off,
which costs nothing here because there is nothing interactive to lose.

`dynamic = "force-dynamic"`: the page reads the database for whatever number is in the URL, so
there is nothing to cache and a cached answer would be a stale one.

`/track` is `noindex, follow` in its own metadata and is in `NON_INDEXABLE_PATHS`, which is what
disallows it in `robots.txt`. With a number in the query string the page renders the state of
one person's order, and an indexed copy of that is somebody else's order status sitting in a
search result. Without one it is an empty input box, which is nothing to rank either way.

Note that the two exclusions are independent rather than one implying the other: `buildSitemap`
publishes from `CONTENT_ROUTES`, an allowlist, so `/track` is out of the sitemap because nothing
put it in, while `NON_INDEXABLE_PATHS` is what keeps a crawler from fetching it. Both are
asserted against real build output in `lib/track-build-output.test.ts` rather than against the
functions that produce them.

### Rate limiting: an in-process sliding window, eight a minute per client

`lib/tracking-lookup-limit.ts` counts lookups per client key over a 60-second sliding window and
refuses the ninth.

**Why eight.** A person tracking their own parcel needs one, or three with a typo. Eight is far
more than that and nowhere near enough to walk an id space of 31^10 — at eight a minute, a
single client would need on the order of 10^8 years. It is a speed bump, and it is described in
the module as friction rather than as a security control, in the same spirit as
`FAILED_LOGIN_FLOOR_MS`.

**Why a sliding window rather than a fixed one.** A fixed window lets a client spend its whole
allowance in the last second of one minute and again in the first second of the next, which is
sixteen lookups in two seconds through a limit that reads as eight a minute.

**A throttled attempt is not recorded.** Otherwise a client that keeps hammering pushes its own
window forward forever and is locked out until it stops, which punishes a confused customer
mashing a button harder than it punishes a script. A client becomes allowed again one minute
after its eighth *accepted* lookup.

**Why in-process, and not a rate-limiting library or Redis.** This deployment is one Node
container on one VPS ([ADR-032](ADR-032-coolify-docker-deploy.md)) serving a solo-operator
jewellery shop. One process holds the whole count, so a `Map` is not an approximation of the
right answer — it *is* the right answer for this topology. Redis would be a new service to run,
a new failure mode on a public page, a new secret, and a new thing to back up, bought to slow
down an attack the id space already makes pointless. A dependency would add a package,
its transitive tree and a supply-chain surface for roughly forty lines of arithmetic that the
tests can characterise exactly. The store is bounded at `MAX_TRACKED_LOOKUP_CLIENTS` (1,000):
past that it drops clients with nothing recent, and clears outright if they are all recent, so a
spray from many addresses cannot grow the map without bound in a long-lived process.

**What it does not claim.** The client key is the first entry of `x-forwarded-for`, then
`x-real-ip`, then a single shared `unattributed` bucket. Behind Coolify's proxy that first entry
is the client; a request reaching the process directly can forge it, and anyone willing to spoof
a header per request is not slowed down at all. The shared fallback bucket is itself throttled,
so an unattributable flood is still bounded. If the site is ever run as more than one replica
this becomes a per-replica count, which is a weaker bound rather than a broken one.

### The confirmation page reads the order number from the server

ADR-043 shipped a stated limitation: the order number lived in the `sessionStorage` checkout
bundle, that bundle is cleared the moment a payment is confirmed — by design, so a shopper
cannot re-enter a completed checkout — and a refresh after that clear found nothing and degraded
to "Payment reference `MG_…`". ADR-043 named the fix and said it belonged with this page.

`GET /api/verify-order` now returns `trackingId` alongside `orderId`, `status` and `amount`.
`findTrackingIdForCashfreeOrder` reads `orders.id` by `orders.cashfree_order_id` — the unique
column ADR-042 made the join between Cashfree's record and ours, and the same column the route
already writes the verified payment status to. The confirmation page prefers that value and
falls back to the bundle:

```ts
trackingId: verifiedTrackingId ?? readBundleTrackingId(bundle, orderId ?? "")
```

The bundle stays as the fallback because it is available on the very first paint, before the
round trip to Cashfree returns, and it is checked against the order being confirmed before it is
believed. The two cannot disagree about a live order — both are written from the same
create-order response — and when the capture failed there is no order number anywhere, both are
null, and the page names the payment reference instead, exactly as it did before.

Three properties of this read are deliberate:

- **It never throws.** Same rule as everything else on this path ([ADR-042](ADR-042-order-capture-in-postgres.md)):
  a database that is down yields `trackingId: null` and a log line, and the rest of the 200 body
  is byte-identical to a run against a healthy database.
- **It is a separate read, not a value returned by the status write.** The two answer different
  questions and only one of them writes — an order whose stored status already matches performs
  no update at all, and it still has an order number.
- **`VerifyOrderResult` split into two types.** `CashfreePaymentSummary` is what the gateway can
  say; `VerifyOrderResult extends` it with `trackingId`. `lib/cashfree-order.ts` and the admin
  notification take the narrower type, so a layer that only ever talks to Cashfree has no
  `trackingId` field to leave structurally null.

The confirmation page also now links to `/track` with the number already in the URL, so a
shopper's first lookup costs a click rather than a transcription.

## Alternatives considered

**A phone number or email as a second field.** Rejected above: it makes the page an oracle for
the customer data it is supposed to protect, and it is the customer-hostile option too — the
phone typed at checkout is not always the phone in hand three days later.

**An OTP to the phone on the order.** Real authentication, and genuinely more secure. Rejected
on proportion: an SMS gateway, a per-message cost, a delivery-failure path and a support burden
on a solo operator, to protect a status line and a date. Revisit if the page ever shows the
address or the line items — but the correct answer there is not to show them.

**A signed tracking link instead of a typed number.** A token in a URL emailed with the receipt
would be unguessable and revocable. Rejected because the shop's primary channel is WhatsApp and
a ten-character number is what gets read aloud on it; a 60-character token is not, and ADR-043
already chose the short unambiguous alphabet for exactly this. It would also mean two
identifiers for one order, which ADR-043 rejected on its own terms.

**Filtering the forbidden fields at render time.** Rejected: it produces the same page today and
a different page after the first edit by somebody who has not read this file. Not selecting a
column is a property of the query; not rendering it is a property of a component, and components
change more often.

**Reusing `AdminOrderTimeline` with a `hideInternal` flag.** Rejected for the same reason, plus
one more: a flag means the operator's component is one boolean away from being the customer's,
and the boolean would be evaluated in a component tree rather than in a query. The customer
timeline is thirty lines and shares no code with the admin one deliberately. This is the one
place in the project where the duplication is the point.

**Redis, or a rate-limiting package.** Rejected above. Revisit at more than one replica.

**No rate limit at all.** Defensible on the arithmetic — the id space alone makes enumeration
hopeless — and rejected anyway, because forty lines with no runtime dependency is cheap enough
that "we thought about it and decided not to" is a worse position than just having it.

**Putting the order number in the Cashfree return URL.** ADR-043 considered this and rejected it
as its own decision: the return URL is sent to Cashfree in the same request that mints the
session, and the capture that generates the order number runs after that request returns.
Nothing here changes that analysis; the verify-order read is the cheaper fix and it is the one
ADR-043 recommended.

## Consequences

**What this makes easy.** A customer answers "where is my order" without messaging anyone,
which is the support-load reduction the page exists for. The operator has a URL to paste into
WhatsApp. Adding a fact to the page is a deliberate act with an obvious cost: a column has to be
added to the `select`, a field to a type whose docstring explains why it does not have one, and
a row to the table above.

**What this makes harder.** Anyone with an order number can see that order's status, and that is
accepted rather than mitigated. Enriching the page — "your parcel is with BlueDart, tracking
number X" is the obvious next request — means revisiting the boundary above, because a courier
tracking number is a fact about the parcel that leads to an address. The customer vocabulary in
`lib/order-tracking-copy.ts` is a second set of strings that must be updated whenever a status is
added, and nothing but a test will notice if it is not.

**What would force a revisit.** More than one replica, which makes the in-process count
per-replica. Any decision to show the address, the line items or a courier reference on this
page, which would change what the weak credential is protecting and would make an OTP worth its
cost. A volume of traffic where eight a minute per IP starts refusing real customers behind a
shared NAT — the number is one constant in one file, and the tests read it from there rather
than repeating it.

## Verification

The four properties this ADR turns on are tested empirically rather than by inspection, in
[PLAN-public-order-tracking.md](../testing/PLAN-public-order-tracking.md) and
[RESULT-2026-08-20-public-order-tracking.md](../testing/RESULT-2026-08-20-public-order-tracking.md):
a committed order fixture carrying twenty forbidden values, none of which appear in the rendered
HTML or in the data the page hands its components; case-insensitive lookup; the limiter driven
with an injected clock at both window edges; and `/track`'s absence from the emitted
`sitemap.xml` and its presence in the emitted `robots.txt`, read out of a real build. Each
assertion was watched to fail against a deliberate regression before being trusted.
