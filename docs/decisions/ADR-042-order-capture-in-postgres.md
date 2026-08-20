# ADR-042: Orders are captured in Postgres at checkout, and the write is not allowed to break checkout

- **Status:** Accepted
- **Date:** 2026-08-20
- **Prompt:** 48

## Context

[ADR-040](ADR-040-postgres-for-orders.md) adopted Postgres for the order and CRM domain and
[its prompt-44 addendum](ADR-040-postgres-for-orders.md#addendum--prompt-44-a-terminal-status-is-stated-once-and-pricingcost-joins-the-catalogue)
created the tables. Nothing wrote to them. Until this prompt the order record was still what
[`docs/api/notify-admin.md`](../api/notify-admin.md) describes — a Cashfree dashboard entry plus
a WhatsApp message — which is a fine record of *what was ordered* and, as ADR-040 put it, a
useless record of *what happened next*.

This is the first prompt where real checkout traffic writes to the database, and that is a
different kind of change from creating a table. `/api/create-order` is the money path. It has
one job, it has had that job since prompt 12, and it works. Adding a second thing it must do
introduces a second thing that can fail while a shopper is mid-purchase.

Two facts shape everything below. **The storefront is prepaid-only and stays that way in this
prompt**: there is no cash-on-delivery choice at checkout, no partial payment, and no
admin-created order flow. And **`data/products.json` remains the sole authority on price**;
what lands in Postgres is a snapshot of what was charged, never a source consulted to decide
what to charge.

## Decision

### 1. The database write is off the critical path, and this is the load-bearing decision

`captureOrder` and `recordVerifiedPaymentStatus` in
[`lib/order-capture.ts`](../../lib/order-capture.ts) **never throw**. Every fault — a database
that is down, out of connections, mid-migration, or refusing a constraint — is caught, logged
server-side against the Cashfree order id, and reduced to a `FAILED` outcome the route ignores.
The response the browser receives is byte-identical to the response it received before this
prompt existed, in both routes.

This is the same principle `lib/notify.ts` is built on and it is applied here for the same
reason. The capture happens *after* Cashfree has minted a payment session, at which point the
shopper is one redirect away from being charged. A shopper who is about to pay must not be told
"something went wrong" because of a table they will never see.

**The cost of this decision is real and is stated rather than hidden.** A capture failure is a
paid order with no row: recoverable only from the Cashfree dashboard, and invisible to every
CRM screen prompts 5 and 6 will build. The alternative — failing the checkout so no order is
ever lost — trades a rare missing row for a lost sale on every database hiccup, and it makes
Postgres a new single point of failure for taking money. The shop can reconstruct a missing
order from Cashfree; it cannot reconstruct a customer who gave up at the payment button.

`lib/checkout-database-failure.test.ts` mocks the client at the module boundary so both real
routes run against a Postgres that rejects everything, and asserts the customer-facing response
is unchanged, carries no trace of the database, and still prices the order identically.

### 2. The payment-type fields exist now, though no customer can choose one

`Order` gains `paymentType` (a `prepaid` / `cod` / `partial_cod` enum), `amountPrepaid`,
`amountDue`, `codAmountCollected`, `codCollectedAt`, `itemReceivedBack` and
`itemReceivedBackAt`. **Every order this checkout captures is `prepaid`, `amountPrepaid = total`,
`amountDue = 0`, and the four COD and return-receipt fields stay at their defaults.** No route
writes anything else, and no UI offers anything else.

They land now for one reason: the invariant `amountPrepaid + amountDue = total` is cheap to
establish while there is one payment type and every existing row satisfies it trivially, and
expensive to retrofit once there are thousands of prepaid rows whose `amount_prepaid` has to be
back-filled under a `NOT NULL` constraint. The columns are added against an **empty `orders`
table**, verified before the migration ran, which is what makes `amount_prepaid DECIMAL NOT NULL`
with no default safe to write here and awkward to write later.

The enum values `cod` and `partial_cod` are therefore a description of a schema that is ready,
not a feature that is half-built. ADR-040 named RTO as the outcome that decides whether a
COD-style flow is survivable; `itemReceivedBack` is where that will be recorded, kept separate
from `status = 'rto'` because the courier turning a parcel around and the parcel being back on
the shelf are different facts on different days, and a refund waits on the second.

### 3. `cashfree_order_id` is unique, not merely indexed

Cashfree mints one payment order per checkout, and that column is the join between their record
and ours — it is the key `/api/verify-order` looks an order up by. Two rows claiming one payment
would mean the verification route silently updating whichever it found first. The constraint was
applied to an empty table; had there been rows, duplicates would have had to be resolved first,
because the migration fails rather than dedupes.

### 4. The customer-facing order id is ten unambiguous characters, drawn from `node:crypto`

[`lib/order-id.ts`](../../lib/order-id.ts). Uppercase alphanumerics **minus `0`, `O`, `1`, `I`
and `L`**, leaving thirty-one characters: `23456789ABCDEFGHJKMNPQRSTUVWXYZ`. Every excluded
character is half of a pair a person cannot distinguish in a sans-serif font, on a courier's
label, or read aloud over a phone call — and a phone call is how this shop is contacted.

- **`crypto.randomInt`, not `Math.random`, and not `randomBytes[i] % 31`.** 256 is not a
  multiple of 31, so a naive modulo would make the first eight characters of the alphabet
  measurably likelier than the rest; `randomInt` rejects and redraws.
- **Uniqueness is checked against the `Order` table, with a retry.** At 31^10 ≈ 8.2 × 10^14 the
  collision probability is negligible for any volume this shop will see, and the loop still
  exists and is tested: `Order.id` is the primary key, so a duplicate would be a failed insert
  in the middle of a paid checkout. Eight attempts, then a throw — the bound is there so a
  *broken* uniqueness check fails finitely rather than spinning inside a request.
- **It is assigned once and never regenerated.** There is deliberately no reissue function: the
  id is printed on a label and quoted in a message, so changing it invalidates every copy of it
  that has left the building.

**Two ids now exist per order, and that is deliberate but incomplete.** `orders.id` is this
10-character code; `orders.cashfree_order_id` is the `MG_{epoch}_{8 base36}` string prompt 12
mints, which Cashfree knows, which the return URL carries, and which `/api/verify-order`
validates with `isMorchadiOrderId`. This prompt changes neither the Cashfree order creation nor
the create-order response, so **the browser and the confirmation page still show the `MG_` id,
and the 10-character code is not yet visible to anyone outside the database.** Surfacing it —
on the confirmation page, in the WhatsApp message, on a tracking box — is a later prompt's work
and a deliberate omission here, not an oversight.

### 5. `cashfree_payment_status` holds this project's vocabulary, not Cashfree's raw string

Cashfree's create-order reply carries `order_status: "ACTIVE"`. `/api/verify-order` has only the
normalised result of `lookupCashfreeOrder`, and changing that helper was out of scope. Writing
the raw string at capture and the normalised one at verification would put two vocabularies in
one column, so both paths run through the single existing mapping in `lib/verify.ts`: a captured
order starts at `PENDING` (what `ACTIVE` means to this project) and verification moves it to
`PAID`, `FAILED` or `NOT_FOUND`. One column, one meaning, one place the mapping is written.

### 6. Verification updates the payment, never the fulfilment

A confirmed payment does **not** advance `status` past `placed`. An order moves to `packed` when
an operator packs it. Money arriving and goods leaving are different facts and ADR-040's
lifecycle keeps them apart; conflating them would make "everything still unshipped" — the query
this CRM exists to answer — unanswerable. `/api/verify-order` writes exactly one column, and
skips the write entirely when the stored status already matches, because the confirmation page
polls a pending payment up to ten times.

### 7. `pricing.cost` reaches capture through a third catalogue accessor

`getOrderCaptureCatalogue()` joins `getOrderPricingCatalogue()` and `getOrderOptionCatalogue()`
in [`lib/products.ts`](../../lib/products.ts), returning `{ id, name, image, cost }`. Cost is not
added to the pricing catalogue, whose whole point is that an amount-deciding function cannot see
anything but `price`; it gets an object of its own so no caller acquires it by accident. The
seal ADR-040's addendum described is unchanged and was re-verified empirically after this
prompt's build: `cost`, `pricing`, `unitCost` and `totalCost` match **zero** files in
`.next/static`, while the controls `mrp`, `price` and `inStock` all match, proving the search is
live rather than broken.

Line items snapshot the product's name and photograph **as the catalogue reads at capture time**,
copied rather than referenced, so renaming or rephotographing a piece later cannot rewrite what
an old order says was bought.

## Alternatives considered

**Failing the checkout when the database write fails.** Rejected above: it makes Postgres a new
single point of failure for taking money, in exchange for never losing an order row. The trade
runs the wrong way while the shop's fallback — the Cashfree dashboard and the WhatsApp
notification — still exists.

**Writing the order *before* calling Cashfree.** Tempting, because then no paid order can lack a
row. Rejected because it inverts the failure: every abandoned checkout, every gateway timeout and
every validation-passing cart that never becomes a payment would leave a row behind, and the
`orders` table would stop meaning "an order" and start meaning "an attempt". It also cannot fill
`cashfree_order_id`, which is the column verification looks up by.

**Firing the capture without awaiting it.** Rejected as a false saving. The write is a handful of
milliseconds against a 15-second Cashfree timeout that already dominates the request, this app
runs as a long-lived Node process rather than a function that can be frozen after the response
(ADR-032), and an un-awaited promise makes the success path untestable and the failure path
unloggable in order.

**One `OrderLineItem` per product rather than per choice.** Rejected: `selected_options` is a
per-row column, and collapsing two engravings into one row would lose which letters were ordered
— the single fact a packer needs and the reason ADR-019's `order_tags` existed at all. Two
identical lines *are* merged into one row of quantity two; two different choices stay two rows.

**Using the Cashfree `MG_` id as the primary key and generating nothing.** Rejected: it is a
gateway's identifier leaking into the domain, it is 25 characters of timestamp and lowercase
base36 that nobody can read aloud, and it would tie the order table's key to a payment provider
this project may one day replace.

**Reusing `MAX_ORDER_ID_ATTEMPTS` as "no retry, the odds are fine".** Rejected on principle: the
odds *are* fine, and a loop that is never entered costs nothing, whereas a primary-key collision
inside a paid checkout costs an order. The retry is tested against a forced collision rather than
assumed unnecessary.

## Consequences

**What this makes easy.** Every Phase 2 screen now has something to read. Order lists, status
workflows, a customer's purchase history, revenue and margin reporting — `total_cost` and
`unit_cost` are snapshotted, so profit is a query rather than an archaeology exercise. Campaign
attribution stops living only in a Cashfree tag: first touch is on the customer and per-order
attribution is on the order, which is the shape ADR-039 wanted and could not have.

**What it makes harder.** Checkout now has a side effect that can silently not happen. A
`FAILED` capture is visible only in the server log, and nothing yet alerts on it or reconciles
Postgres against the Cashfree dashboard — that reconciliation is real work this prompt does not
do. The `orders` table also now holds personal data written by real traffic, which starts the
retention and deletion clock ADR-040 listed under production provisioning.

**Two ids per order is a cost until one of them is surfaced.** Support conversations currently
quote the `MG_` id while the database's own key is something else. Until a later prompt shows
the 10-character code, anyone reading the table has to join through `cashfree_order_id` to match
an order to a customer's email.

**What would force a revisit.** A customer-facing COD or partial-COD choice, which would make
the payment-type fields live and needs its own decision about RTO exposure and about who is
allowed to create an order. An admin-created order flow, which is the other writer these columns
were shaped for. Or capture failures turning out to be frequent rather than theoretical, which
would argue for a durable queue in front of the write rather than a log line behind it.
