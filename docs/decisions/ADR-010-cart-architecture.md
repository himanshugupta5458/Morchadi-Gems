# ADR-010: Cart architecture

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 9

## Context

The cart is the first piece of state in this project that outlives a render. Everything
before it was derived: the catalogue ships as code, the shop page reads its filters from the
URL, and the product page is a pure function of an id. A cart is none of those things — it
is per-visitor, it has to survive a reload, and it is the input to a payment.

Three constraints shape it, and they pull against each other.

**There is no database and no account** ([ADR-001](ADR-001-tech-stack.md)). There is nowhere
server-side to put a cart and no identity to attach one to. It has to live in the browser.

**The server renders first.** Every page except `/shop` is prerendered at build time. A cart
that lives in `localStorage` is invisible to that render, and the header badge is on every
page — so the badge is a hydration hazard on the entire site, not just on `/cart`.

**Prices are not the client's to decide.** `CLAUDE.md` is unambiguous: an amount arriving
from the client is untrusted input. A cart stored in `localStorage` is, by construction,
client-controlled — a shopper can open devtools and set any price they like.

## Decision

**1. Client React Context, persisted to `localStorage` under `morchadi-cart-v1`.**

`CartProvider` (`lib/cart-context.tsx`) is mounted in `app/layout.tsx` and wraps the whole
app. `useCart()` exposes `items`, `lines`, `addItem`, `removeItem`, `setQty`, `clearCart`,
and the derived `itemCount` / `subtotal` / `shipping` / `total`.

The key is versioned. A change to the persisted shape ships as `-v2` and the old key is
simply never read again, which retires stale carts without a migration path to maintain.

**2. The catalogue is the source of truth for money. The stored item is a snapshot, and the
snapshot never decides anything.**

`CartItem` keeps `name`, `price` and `image` as written in `types/cart.ts`, so a persisted
cart is legible on its own. But nothing reads that `price`. `buildCartLines` joins each item
to its catalogue entry by id and takes `unitPrice` from the *catalogue*; `reconcileCartWithCatalogue`
overwrites the snapshot fields from the catalogue on every hydrate.

So a tampered `localStorage` price changes nothing — the tampered value is overwritten before
it is ever displayed and is not consulted even in the window before that. A catalogue
repricing reaches an old cart on the next load, with no cache to bust.

This is a display and reconciliation guarantee, not a payment guarantee. When the Cashfree
order route lands it will recompute every amount from `data/products.json` server-side and
ignore the request body's numbers entirely. This ADR does not weaken that requirement; the
client cart is upstream of it.

**3. The client is given a lean catalogue index, not the catalogue.**

`CartProvider` needs catalogue data to prune vanished ids, price lines, and flag out-of-stock
items — and it is a Client Component, so it cannot import `lib/products.ts` without pulling
`data/products.json` into the browser bundle. [ADR-008](ADR-008-shop-architecture.md) already
established that shipping the catalogue to the client is a bug, so:

`getCatalogueIndex()` projects the catalogue to `CatalogueEntry` — `id`, `name`, `price`,
`mrp`, `image`, `inStock` — and `app/layout.tsx`, a Server Component, passes it to the
provider as a prop.

| | Raw JSON |
| --- | --- |
| Full catalogue | 67,902 bytes |
| Lean index | 11,910 bytes |

Measured in the served HTML of `/product/nk-001`, the 100 index entries plus the five
per-card islands on that page cost **14.3 kB raw / 2.2 kB gzipped** of flight payload. First
Load JS is unchanged at ~106 kB. Descriptions, details and reviews stay on the server — the
served page contains no `shortDescription`, `reviewCount` or `reviews` field anywhere.

The same type is what every client cart component receives. `ProductCard` hands
`AddToCartButton` a `CatalogueEntry` rather than a `Product`, so a twelve-card grid
serialises twelve small objects instead of twelve full records.

**4. Hydration: render the empty cart, then reconcile.**

The provider's initial state is `[]` on the server *and* on the first client render. A
`useEffect` then reads `localStorage`, reconciles against the catalogue, and flips
`isHydrated`. The badge is therefore absent in the prerendered HTML and absent in the first
client render — it appears in the commit *after* hydration, which is a state update, not a
mismatch.

The alternative — a `useState` initialiser that reads `localStorage` — is the obvious
implementation and it is wrong. It makes the first client render disagree with the server
HTML for any returning visitor, which is exactly the error class this has to avoid.

`isHydrated` is also public, because "empty" and "not yet known" are different things. The
header treats them the same (no badge either way, so nothing flashes). `/cart` does not: it
shows a quiet loading line until hydration, because rendering "Your cart is empty" and then
replacing it with three items a frame later is a flash of wrong content — not a React error,
but worse to look at than a brief wait on the one page that is entirely about the cart.

**5. An item that goes out of stock stays in the cart, flagged, and blocks checkout.**

Reconciliation drops items whose product has left the catalogue — there is nothing to show,
nothing to price, and no page to link to. An item whose product is merely `inStock: false` is
kept.

Deleting it silently would be the easier code and the worse behaviour: the shopper chose that
piece, and a cart that quietly empties itself between visits is a cart the shopper stops
trusting. So the line renders, desaturated, marked "Out of stock", with its stepper and line
total withdrawn and one action offered — remove.

It contributes nothing to `subtotal`, and it does not attract shipping on its own: a cart
holding only sold-out lines totals ₹0, not ₹99. Checkout is blocked until it is removed,
which is the honest consequence of an order that cannot be fulfilled.

Adding an out-of-stock product is refused in `addProductToCart` itself, not only by the
disabled buttons — the buttons are the UI, and the pure function is the rule.

**6. The cart math is pure and lives in `lib/cart.ts`.**

Every operation — add, increment, clamp, merge, remove, set quantity, prune, parse, total —
is a pure function over arrays. `CartProvider` holds state and calls them; it decides nothing
about money.

This is why the arithmetic has 49 unit tests without a DOM, a render, or a mock. It also
means the same functions are available to the checkout route later without dragging React
into a server module. Quantity bounds are not redefined here — `clampQuantity` from
`lib/quantity.ts` ([ADR-009](ADR-009-product-page.md)) remains the only definition of a valid
quantity, and every entry point routes through it.

`mrp` is absent from `lib/cart.ts` entirely. It reaches the cart page only as a
`PriceDisplay` prop.

**7. Flat shipping comes from `lib/config.ts`.**

`FLAT_SHIPPING_RATE = 99`, charged once per order, only when there is at least one payable
line. The cart math, the summary label and every later server total read it from there. No
coupons, no tax line.

## Alternatives considered

**A `useState` initialiser reading `localStorage`.** Fewer lines, no `isHydrated` flag, and
a hydration mismatch on every returning visitor. Rejected. Its failure is proven rather than
asserted: injecting exactly this change makes the "server renders the empty badge" test fail.

**Shipping the full catalogue to the client.** Would remove the `CatalogueEntry` projection
and the prop-drilling from the layout. Costs 68 kB of product prose in the browser to save a
type. Rejected on the same grounds as ADR-008.

**Keeping the cart in React state only, with no persistence.** No hydration problem at all,
because there is nothing to restore. Rejected: a jewellery cart is built over several
sessions, and losing it on refresh is the single most expensive UX failure available here.

**Trusting the stored price snapshot.** It is right there in `CartItem` and it saves a
lookup. Rejected — it is attacker-controlled and it goes stale. The snapshot is kept for
legibility and deliberately never read.

**Deleting out-of-stock items during reconciliation.** Simpler code, simpler totals, and it
makes the cart lie about what the shopper put in it. Rejected.

**`sessionStorage`, or a cookie.** `sessionStorage` dies with the tab, which defeats the
point. A cookie would be sent on every request, including for static assets, to serve a value
the server has no use for. Rejected.

**Cross-tab sync via the `storage` event.** Not built. Two tabs open on the site will
overwrite each other's cart, last write wins. It is a real gap, deliberately deferred — say
so rather than pretend the current design covers it.

## Consequences

**Easy.** Adding to the cart from anywhere is one hook call. The cart survives reloads and
navigations with no server round trip. A catalogue edit — reprice, rename, mark sold out,
delete — propagates to every stored cart on next load with no migration. The arithmetic is
testable in isolation and already is.

**Hard.** The cart does not follow a shopper between devices or browsers, and clearing site
data clears it; without accounts there is no fix, only a different product. Two open tabs can
clobber each other. The provider wraps every page, so every page pays ~2.2 kB gzipped of
flight payload for the catalogue index whether or not it uses the cart. And the empty-first
render means `/cart` cannot be meaningfully server-rendered — it shows a loading line for one
frame by design.

**What would force a revisit.** Accounts or saved carts (the cart would move server-side and
this whole ADR is superseded). Per-item shipping or weight-based rates (the flat constant
stops being a constant). A catalogue large enough that the lean index stops being cheap to
serialise into every page. Real-time stock, which would make `inStock` too stale to trust at
render time and push availability to a request-time check.
