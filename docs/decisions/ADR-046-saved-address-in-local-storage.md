# ADR-046: The browser remembers the delivery address; the shop still does not remember the shopper

- **Status:** Accepted
- **Date:** 2026-08-20
- **Prompt:** 53

## Context

A repeat customer retypes eight fields. That is the single largest piece of friction left in
this checkout, and every conventional answer to it is an account — which
[ADR-001](ADR-001-tech-stack.md) rejected outright ("accounts mean stored credentials, password
resets"), which [ADR-040](ADR-040-postgres-for-orders.md) deliberately left rejected when it
added Postgres for orders, and which [ADR-045](ADR-045-public-order-tracking.md) declined again
when it built order tracking around a number rather than a login.

The friction is real all the same, and the shop already has everything needed to remove it
without touching that position: the address was typed into this browser, by this browser's
owner, and nothing about remembering it requires the *server* to know anything new.

There is a related fact worth stating, because it is the thing that makes this safe rather than
merely convenient. `customers` already holds a name, a phone, an email and — through
`orders.shipping_address` — a full delivery address. Nothing here adds a category of data the
project was not already storing. What it changes is *where a copy lives* and *who can read it*,
and that is what needed deciding.

## Decision

### The address is saved to `localStorage`, after a confirmed payment, by the browser alone

`lib/saved-address.ts` writes the eight fields `AddressForm` collects under
`morchadi-address-v1`. On a later visit to `/address` the form is pre-filled from it, and the
shopper edits, ignores or discards it.

**No server endpoint, and none was needed.** The address is already in the browser at the moment
it becomes worth keeping — the confirmation page holds the checkout bundle it is about to clear
— so the whole feature is one `setItem` and one `getItem`. Nothing is sent anywhere. A saved
address becomes a request only when the shopper submits the form it filled in, along exactly the
path a typed address takes, through the same `validateAddressForm` and the same
`/api/create-order`. The server cannot tell a pre-filled submission from a typed one, and that
is the correct amount for it to know.

**`localStorage`, not `sessionStorage`, and it is the only thing in this project that uses it
for the funnel.** The distinction is the point. The checkout bundle
([`CHECKOUT_STORAGE_KEY`](../../lib/checkout.ts)) is `sessionStorage` because it exists to
survive one redirect to Cashfree and must not outlive the tab. This exists to survive a
fortnight and a closed browser, because a *second order* is the entire thing it is for.

### It is saved on a confirmed payment and at no other moment

The write sits in the `paidResult` effect in `components/OrderConfirmation.tsx`, beside the two
lines that clear the cart and the bundle.

This placement is a decision, not an implementation detail. Saving at `/address` — the moment
the address is submitted — would remember details from a checkout abandoned at the payment page,
which is a worse address to offer next time than none: it was, by the shopper's own action, not
good enough to complete an order with. A confirmed payment is what makes an address worth
keeping, and it is also the last moment the address exists in the browser, since
`clearCheckoutData` removes the bundle on the next line.

The two storage lifetimes now diverge deliberately: the bundle is cleared so a completed
checkout cannot be re-entered, and the address is kept so the next one is shorter.

### Pre-filling is offered, announced, and reversible — never submitted

Three properties, and each is enforced somewhere rather than merely intended:

- **Never auto-submitted.** `AddressForm` receives `initialValues` and does nothing else with
  them. There is no effect that submits, and a test asserts that a pre-filled render calls the
  router zero times and writes no checkout bundle.
- **Announced.** A quiet bordered line above the form says the details came from the last order.
  A form that silently arrives full is a form a shopper does not re-read, and the one field most
  likely to be wrong on a returning order — the address itself — is the one they most need to
  re-read.
- **Editable without consequence.** `AddressForm` reads `initialValues` once, into `useState`.
  Typing therefore cannot write back, and the stored copy is untouched until the *next* confirmed
  payment replaces it wholesale. This is structural rather than guarded, which is why it is
  stated here: an `initialValues` that became a controlled prop would quietly break it.

**"Use a different address" clears it.** Somebody ordering for a friend this time needs one
click, not eight deletions. The link empties the form in the same act — via a changed React key,
which is how a `useState` initial value is asked to start over — so what they see afterwards is
the blank form they asked for rather than the details they have just discarded still sitting in
the boxes. The link then disappears, because there is no longer a saved address to talk about.

### The in-progress checkout outranks the last order

`/address` consults `sessionStorage` first and `localStorage` second. A shopper who reached
`/payment` and pressed back is mid-checkout, and that address is a more recent statement of
where *this* parcel is going than the one their last order went to. The pre-fill notice appears
only in the second case, because "filled in from your last order" would be a false sentence in
the first.

### What comes back is validated, and a bad record is discarded whole

`parseSavedAddress` requires all eight fields to be strings of at most 200 characters —
comfortably above the form's own 120-character limit on an address line — and returns `null`
otherwise. A partially salvaged address would pre-fill some boxes and drop others, which reads
to a shopper as the form having *lost* their details rather than never having had them.

The one exception is the state, which is blanked rather than fatal: the field is a `<select>`, an
unrecognised value cannot be an option in it, and every other line of a real address is still
worth restoring. `validateAddressForm` then refuses the submission until the state is answered.

This validation guards the read, not the write. Everything this module writes has already been
through the form; what comes *back* is whatever is under a key any script on the origin can set.

## Alternatives considered

**A "remember me" checkbox before saving.** The honest version of consent, and rejected as
theatre in this context. The data is the shopper's own address, it never leaves their machine,
and it is one visible link away from being erased. A checkbox on the checkout form would add a
decision to the highest-friction screen in the funnel in exchange for a guarantee the shopper
already has. The announcement and the clear link — shown at the moment the data is actually used
— are consent placed where it is legible.

**Saving to `customers` and pre-filling from the server by phone.** This is the accounts-shaped
answer wearing a different hat: it would mean typing a phone number to retrieve somebody's home
address, which is precisely the oracle ADR-045 refused to build for the tracking page, and at
much higher stakes because the payload is an address rather than a status line. Rejected on the
same reasoning, and it is the reason this feature is client-side by design rather than by
convenience.

**A cookie.** It would ride on every request to the origin, including every image and every API
call, putting a home address into server logs that have no use for it. `localStorage` is not
sent anywhere, which is exactly the property wanted.

**Keeping it in the existing `sessionStorage` bundle.** That bundle is cleared on a confirmed
payment by design, so it cannot outlive the order it describes — which is the one thing this
feature needs.

**An expiry on the stored address.** Considered and not taken. A stale address is visible, is
announced as coming from the last order, and is editable in place; silently discarding it after
N days would produce an empty form with no explanation, which is worse. Revisit if the address
ever pre-fills something the shopper does not see before submitting.

## Consequences

**What this makes easy.** A returning shopper's checkout is a glance and a click. Nothing about
the server, the database or the order path changed, so nothing about them needs re-testing
against this.

**What this makes harder.** There is now customer PII on the device outside the funnel's own
storage, and it survives the tab. It is the shopper's own address on the shopper's own machine,
erasable from the page it appears on and by clearing site data — but it is a real change from a
project that previously kept nothing past a session, and a shared device is the case where that
matters. The announcement and the clear link exist for that case.

`AddressForm`'s uncontrolled `initialValues` is now load-bearing for a correctness property
stated above rather than being an implementation choice, and `lib/saved-address.test.tsx` is
what notices if it changes.

**What would force a revisit.** Shopper accounts, which would make this the wrong layer to solve
the problem at. Any proposal to pre-fill something the shopper does not visibly confirm before
submitting — a saved payment instrument is the obvious one — which is a different decision
entirely and not an extension of this one. A second field on the address form that is not safe
to persist.
