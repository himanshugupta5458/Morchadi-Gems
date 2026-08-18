# ADR-013: Order creation and the payment step

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 12

## Context

This is the first code in the project that can cost someone money.

Everything up to now has been reversible. A wrong price on a product card is embarrassing; a
wrong price in a payment order is a charge on a real card. Four constraints shape every
decision below.

**There is no database** ([ADR-001](ADR-001-tech-stack.md)). `data/products.json` is the only
authority on what anything costs, and it is read at request time on the server.

**Cashfree is a hosted redirect.** The browser leaves this site, pays somewhere else, and
comes back. The order has to be created and priced *before* the shopper leaves, and nothing
about the amount can be re-negotiated after they go.

**The client holds the entire cart.** It lives in `localStorage`
([ADR-010](ADR-010-cart-architecture.md)) and the address bundle in `sessionStorage`
([ADR-011](ADR-011-checkout-address-step.md)). Both are trivially editable by anyone with a
devtools console. The amounts already written into that bundle are, by ADR-011's own words,
display-only.

**`CLAUDE.md` is unambiguous:** an amount arriving from the client is untrusted input and is
never used to create a payment order.

## Decision

### 1. The server is the sole pricing authority, enforced by a signature that cannot take a price

`buildOrderFromCart(items, catalogue)` in `lib/order.ts` is the one place an order total is
produced. `items` is `{ productId, qty }[]` and nothing else. There is no parameter for a
price, a line total, or an order total — a tampered amount is not *rejected*, it is
*unrepresentable*.

Three properties are load-bearing, and each has a test:

- **A rejected order carries no money.** Failure returns zeroed `subtotal`, `shipping` and
  `total` and an empty `lineItems`. A caller that forgets to check `valid` still cannot
  charge anything.
- **Every fault is collected, not just the first.** One round trip tells the shopper about
  all of their bad lines, the same principle as `validateAddressForm`.
- **`mrp` is invisible to the pricing core.** The `catalogue` parameter is typed as
  `OrderPricingEntry` — `id`, `name`, `price`, `inStock` — which *has no `mrp` field*. Both
  `Product` and `CatalogueEntry` satisfy it structurally, so callers pass what they already
  have, but the function cannot read a compare-at price even by accident.
  [ADR-003](ADR-003-discount-display-pricing.md) said `mrp` is display-only; this makes it a
  compile-time fact rather than a convention.

`parseOrderItems` sits in front of it and reduces an arbitrary JSON body to that shape,
dropping any extra fields the client attached. A non-numeric `qty` is passed through as `NaN`
rather than collapsing the request, so a bad quantity is reported against the product it
belongs to.

### 2. Duplicate product ids are refused, not merged

Two lines for the same product could be summed. They are refused instead: merging would let
a client send the same id five times at `qty: 10` and buy fifty of a piece capped at ten.
The cart cannot produce a duplicate, so this only ever fires on a hand-made request — which
is exactly when it matters.

### 3. `/api/create-order` re-validates the address it is given

The client already validated the address on `/address`. The route validates it again with the
same `validateAddressForm`, because "the client said it was valid" is not a fact the server
has. Reusing the validator rather than writing a looser server-side one means the two can
never disagree about what a valid Indian address is.

Precedence when both are wrong: items first, then address. A cart problem is fixed on
`/cart` and an address problem on `/address`, and sending the shopper to two places at once
helps nobody.

### 4. The response tells the client which environment its session belongs to

The 200 body is `{ orderId, paymentSessionId, mode }`. `mode` exists because the Cashfree
browser SDK must be initialised against the same environment the `payment_session_id` was
minted in, and the client has no other way to know which that was — the environment is a
server-side variable it cannot read.

`CASHFREE_ENV` resolves to production only on the exact string `production`. A typo, a blank
value or a forgotten variable therefore fails towards sandbox: the failure mode of a
misconfiguration is "no real money moves", not "real money moves against test credentials".

### 5. `order_id` is `MG_{epoch ms}_{8 base36}`

URL-safe, sorts chronologically, and 25 characters — inside Cashfree's 50-character
alphanumeric-and-underscore limit. The timestamp makes an order findable in a support
conversation without a database to look it up in; the random suffix, from `node:crypto`,
means two checkouts in the same millisecond cannot collide. `customer_id` is
`guest_{12 base36}`, freshly generated per order: there are no accounts, so it deliberately
links to nothing and cannot be used to correlate two orders by the same person.

### 6. The return URL comes from configuration first, the request second

`resolveAppBaseUrl` prefers `APP_BASE_URL`, falls back to `NEXT_PUBLIC_BASE_URL`, then the
request's own origin, then localhost. Configuration wins because behind a proxy the request's
host can be an internal name the shopper's browser cannot reach — and this URL is where the
shopper lands after paying, so getting it wrong strands a completed payment.

`APP_BASE_URL` is preferred over the public variable because the return URL is a server-side
concern; the public one is only a fallback so a deployment that sets just that still works.

### 7. Secrets are kept out of the client by the build, not by discipline

`lib/cashfree-config.ts` starts with `import "server-only"`. Importing it from a
`"use client"` file is a build failure, which was verified by doing it deliberately. This is
why the Cashfree config lives in its own module instead of in `lib/config.ts` — that file is
imported by client components, so it can never hold a credential.

The payment page holds no key, knows no Cashfree endpoint, and calls exactly one URL:
`/api/create-order`, our own. It uses the npm SDK solely for `checkout()`, which needs only
the `payment_session_id`.

### 8. Upstream failures are logged in full and reported in one sentence

On a Cashfree error the route logs the status and the raw upstream body with the order id,
and returns a 502 with a fixed, shopper-readable message and `retryable: true`. The upstream
body never crosses to the browser: it can carry provider-internal detail, and a shopper can
do nothing with `"code": "request_failed"` except lose confidence. A 15-second timeout turns
a hung gateway into the same 502 rather than a spinner that never resolves.

Missing credentials are a distinct 503 `PAYMENT_NOT_CONFIGURED`, not a 502, because retrying
cannot fix them — the fix is a deployment change.

### 9. The double-submit guard is a ref, not the disabled attribute

Disabling the button is a state update, and state updates are not applied until React
re-renders. A fast double click can therefore fire the handler twice before the button ever
goes grey — and two handlers means two Cashfree orders for one cart.

The latch is a `useRef` checked and set in the same synchronous tick as the click. The
`disabled` attribute is still there, but it is the *visible* half of the guard; the ref is
the half that is actually correct. The ref is released again on every failure path so a
retryable error stays retryable, and deliberately not released on success, because the
browser is on its way to Cashfree.

### 10. The payment guard decides after hydration, exactly as `/address` does

The cart and the address bundle are both browser state, so the server render knows neither.
The page shows a neutral "Loading your order…" until both have been read, then decides. It
never renders a payment button it might have to take away — a checkout that briefly shows
"Pay ₹4,299" before admitting the cart is empty is worse than one that takes a frame longer
to make up its mind. Confirmed against the production build: the served HTML for `/payment`
contains the loading line and no amount.

Four guards, in order: empty cart, a sold-out line, no address bundle, then pay. The
missing-address guard points at `/address` rather than `/cart`, which is why
`CheckoutGuardNotice` grew an optional `action`.

## Alternatives considered

**Trust the `total` in the `sessionStorage` bundle.** It is right there and already computed.
Rejected outright — it is client-writable, and `CLAUDE.md` forbids it. This is the entire
reason ADR-011 labelled those amounts display-only.

**Sign the checkout bundle server-side and verify the signature.** Would let the server trust
the client's total. Rejected: it is strictly more machinery than recomputing from a JSON file
that is already in memory, and it makes the trusted amount a function of a stale snapshot
rather than of the catalogue as it is *now*. Recomputing also naturally catches a price
change or a sell-out between `/address` and `/payment`.

**The Cashfree Node SDK.** Rejected in favour of `fetch`. One POST with five headers does not
justify a dependency in the payment path, and pinning `x-api-version` explicitly makes the
contract this code was written against visible in the code. The browser SDK *is* used,
because `checkout()` is not a call we can reimplement.

**Merging duplicate ids instead of refusing them.** Rejected — see decision 2.

**Creating the order on the server as the shopper lands on `/payment`.** Would remove a round
trip from the click. Rejected: it creates a Cashfree order for every visit to the page,
including ones nobody pays for, and it makes the page non-static.

**Redirecting instead of guarding when the cart is empty.** Rejected for the same reason as
in [ADR-011](ADR-011-checkout-address-step.md): a redirect fired from an effect races
hydration, and a checkout that bounces the shopper somewhere unannounced reads as a fault.

## Consequences

**Easy.** A price change in `data/products.json` is authoritative the instant it deploys; no
cache, no snapshot, no reconciliation. The pricing core is a pure function of two arguments
and is tested without a server, a network, or a Cashfree account. A tampered request is not a
security hole to patch but a shape the code cannot accept.

**Hard.** Every order costs one synchronous call to Cashfree before the redirect, so the
button has a visible latency the page has to narrate. There is still no record of an order
anywhere on our side — `order_id` is generated, sent, and forgotten. Nothing yet reconciles a
payment against what was ordered.

**Known incomplete, by design.** `return_url` points at `/order-confirmation`, which does not
exist yet. A sandbox payment completed today lands on a 404. That is the intended checkpoint
for this prompt: the route creating a real payment session is what is being proven, and the
confirmation page plus server-side verification are the next prompt's work.

**What would force a revisit.** A discount code, a per-order shipping rule, or tax would all
extend `buildOrderFromCart` — none of them change where the authority lives. Real inventory
counts (rather than a boolean `inStock`) would need a reservation at order-creation time,
which this design has nowhere to put. Retrying a failed payment for the *same* order, rather
than creating a new one, would need the order id to outlive the request.
