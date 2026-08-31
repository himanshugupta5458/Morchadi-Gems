# ADR-072: The checkout is one funnel — the cart persuades, the two steps after it do not

- **Status:** Accepted
- **Date:** 2026-08-31
- **Prompt:** 116
- **Narrows:** [ADR-044](ADR-044-admin-order-detail-and-layout-split.md) (a third shell), [ADR-063](ADR-063-online-payment-discount.md) (where the discount is *shown*), [ADR-010](ADR-010-cart-architecture.md) (what the cart page renders). All three otherwise stand.

## Context

Four screens carry an order from a basket to a placed order: `/cart`, `/address`, `/payment`,
`/order-confirmation`. They had grown one prompt at a time and had never been looked at as one
journey, and it showed in three separate ways.

**Everything the cart did, every screen did.** `OrderTotals` rendered the "Add ₹N for free
shipping" nudge, and all four screens render `OrderTotals`. So the nudge appeared on the payment
step, two lines above the online-payment discount row — where a shopper about to commit is told
they are not spending enough — and on the confirmation screen, where the order is placed and the
nudge is an instruction to do something that is no longer possible.

**The two middle screens carried the whole shop on top of them.** `/address` and `/payment` were
nested inside `app/(storefront)`, so they rendered the shop header (two dropdown menus, About,
Contact), the seven-column footer, and the floating WhatsApp bubble over the bottom-right of a
form. A nested layout cannot decline what an ancestor renders, so this was not an oversight that
could be fixed in place.

**The cart page's right-hand column ran out before its left one did**, leaving a tall empty band
beside the summary, and its summary answered a question nobody asks — "Prices are confirmed
against the catalogue when your order is created" — while leaving the ones they do ask (who takes
the money, what if it is wrong, does it reach me) unanswered.

A fourth thing was reported as a suspected pricing bug and turned out not to be one; it is
recorded in [the audit log](../logs/2026-08-31-free-shipping-gap-audit.md) and summarised below.

## Decision

### The free-shipping nudge belongs to the cart, and to nothing else

`OrderTotals` no longer renders it. `FreeShippingProgress` does — a bar and a sentence, rendered
by `/cart` alone, directly above the cross-sell rail so the two read as one thought: how far off
free delivery this basket is, and four pieces from the same shelf that would close it.

**The figure it is measured against is unchanged, and was already correct.** It is
`amountToFreeShipping(subtotal)` where `subtotal` is `Σ entry.price × qty` — the amount actually
charged. Neither of the two other figures on those screens may be substituted for it:

| Candidate | Why not |
| --- | --- |
| The MRP subtotal | A compare-at price has never been summed into a cart total. Measuring the threshold against it would promise free delivery to a discounted cart the server then charges ₹99 for. |
| The total after the online-payment discount | `resolvePaymentPlan` computes `total = subtotal + shipping` and *then* subtracts the rebate, so shipping is decided before the discount exists. A gap that moved with it would advertise a threshold `calculateShipping` does not honour. |

So a gap that does **not** move when the discount is applied is the correct behaviour, and the
inconsistency that was noticed was one of *placement*, not arithmetic. Removing the nudge from the
payment step removes it. `lib/free-shipping-gap.test.ts` pins all of this in both directions.

### `app/(checkout)` is a third shell, a sibling of the shop and the panel

`/address` and `/payment` moved into a route group of their own with its own layout: the
providers, the page, and four policy links. A route group adds no URL segment, so both are served
at exactly the addresses they always were.

This is the same move ADR-044 made between the shop and the admin panel, for the same reason —
a nested layout cannot opt out of an ancestor — and it forced the providers out of
`app/(storefront)/layout.tsx` into `components/ShopProviders.tsx`, because the cart, the toast
host, analytics and campaign capture are shared by both shopper shells while the header, footer
and floating button are exactly what they were split over. Analytics stays inside it: a checkout
page is where a conversion is measured.

**`/order-confirmation` deliberately stayed in the shop.** It is the one post-funnel screen: it
ends in "Continue shopping" and a cross-sell rail, and a shopper who has just paid is the one
most worth handing the catalogue back to. The argument for stripping a screen is that the shopper
has committed and has not yet paid; neither half is true here.

`CheckoutHeader` is what replaces the shop chrome: the logo, the step indicator, and one link
back to the cart. It takes the step as a prop rather than reading the pathname, because each page
already knows which step it is and that is one fewer client bundle on the two screens where the
shopper is waiting on a redirect.

### The cross-sell rails ship data, not a catalogue

`/cart` and `/order-confirmation` both end in a rail of four pieces from the shelf the basket is
most about. Which shelf that is can only be decided in the browser — the cart lives in
`localStorage` and a completed order's items in `sessionStorage`, so no server render has seen
either — while what is *on* each shelf is a property of `data/products.json` that no request
changes.

So `getCrossSellShortlists` cuts six in-stock pieces per category on the server and hands them
down as a prop; `CrossSellRow` picks the category, excludes what is already in the basket, and
renders `ProductGrid`. The alternatives were both worse: fetching from a route adds a round trip
on the two screens where a shopper is least patient, and rendering every category's rail
server-side ships eleven rows of HTML to show one.

**The category is chosen by total value per category**, ties broken on the most valuable single
line and then on the basket's own order. A basket of one ₹1,200 necklace and three ₹200 rings is
a ring basket by count and a necklace basket by top item; money spent is the closest thing to a
statement of what the shopper came for, and it degenerates correctly for the single-category and
single-item baskets that are most of them.

**This is what made `ProductCard` a shared component**, and it carries a new obligation.
`CrossSellRow` is a Client Component, so every module `ProductCard` imports is now compiled into
a browser bundle too — and `lib/products.ts` imports the 1.4MB catalogue at module scope. The
three projections a card needs moved to `lib/product-view.ts`, which holds no catalogue;
`ProductCard` takes `ProductCardView` rather than `Product`, so `pricing.cost` and
`migrationProvenance` cannot cross the boundary even by accident; and
`lib/catalogue-client-boundary.test.ts` fails if any shopper-facing `"use client"` module ever
reaches the catalogue again, at any depth.

### A gift note is recorded, never priced

`orders.gift_message` is a nullable `VARCHAR(300)`. The payment step offers a free-text field; the
route parses it with `parseGiftMessage` — control characters dropped, trimmed, truncated,
`null` for anything that is not a string — and hands it to `captureOrder` beside `utm`, after
`resolvePaymentPlan` has already decided every amount.

**No function that decides an amount is ever passed it.** The cap is enforced three times over on
purpose: the textarea stops accepting at 300, the parser truncates at 300, and the column refuses
more than 300. Malformed input becomes `null` rather than a refusal, for the reason a failed
WhatsApp message is not an error — a courtesy layered on a working checkout must never become a
new way for a paid order to fail.

It surfaces read-only on the admin order detail, and only there. No admin write touches the
column, so there is no rule for a route handler to re-derive and nothing an authenticated `curl`
can name — which is the one thing that keeps it outside
[ADR-044](ADR-044-admin-order-detail-and-layout-split.md)'s server-side re-derivation rule rather
than an exception to it.

### The confirmation screen states what it can actually check

Three changes, and the reasoning differs for each.

**The `COD_…` reference is gone from the placed screen.** It names a payment that does not exist:
no gateway minted it, no bank statement carries it, and nothing outside this repository can be
looked up by it. Printed under a ten-character order number set in heading type, its only effect
was to offer a second thing to quote. It survives on the *unresolved* states, where it is the
only identifier the page has.

**The `MG_…` payment reference stays exactly where it is.** It is what Cashfree's dashboard is
searched by and what a bank dispute is raised against, and on an order whose Postgres capture
failed it is the only identifier the shopper has at all (ADR-042). Both directions are pinned by
`lib/confirmation-fine-print.test.tsx`, because the risk this change carried was removing the
wrong one.

**The email line says "on its way", not "has been sent".** The send is fire-and-forget on both
paths and its outcome never reaches the page: a paid order's email is dispatched by
`/api/notify-admin`, which the browser calls without reading the reply, and a cash-on-delivery
order's from inside `/api/create-order`, unawaited. Either can also end at
`SKIPPED_NOT_CONFIGURED` on a deployment with no `RESEND_API_KEY` — a runtime-only secret this
page cannot read, and one that is deliberately not a Docker build ARG. What *is* knowable is that
an address was captured and the dispatch was attempted, so the line renders only when the
reconciled bundle carries a non-empty email, and it names the spam folder and the support address
because on those deployments a missing email is a real possibility rather than a formality.

### The receipt totals what was charged

Found during the manual pass and fixed here rather than left: the `sessionStorage` bundle is
written at `/address`, one step before a payment path exists, so its `total` is the cart's worth
and not the amount charged. On a discounted order the confirmation screen printed both — "Amount
paid ₹526" directly above a receipt totalling ₹549, with nothing saying why they differ.

`readBundleReceiptTotals` corrects it from `amountPrepaid + amountDue`, the two figures the
*server* stamped and the same ones `canDisplayBundleForOrder` already reconciles against Cashfree
before any of it renders, and shows the gap as its own row. Nothing is recomputed from the
discount rate, so this cannot disagree with what was charged.

## Consequences

- The nudge exists on one screen. Adding it to a second means asking whether the shopper can
  still act on it.
- `/address` and `/payment` are a shell of their own. A new checkout step goes in
  `app/(checkout)`; a new *shop* page goes in `app/(storefront)`, and neither inherits the
  other's chrome.
- `ProductCard` is a shared component with a boundary test behind it. Adding an import to it now
  has a browser-bundle cost, and `lib/catalogue-client-boundary.test.ts` is what says so.
- `CatalogueEntry` carries `category`. It is display and merchandising data — no amount, no
  eligibility rule and no total reads it — and it is what lets the browser answer "what shelf is
  this basket from" without a second catalogue.
- The cart page ships the cash-on-delivery catalogue and the cross-sell shortlists, about 24KB
  more than before on a page that already carried the 66KB catalogue index. Both are noindex,
  late-funnel screens.
- `orders.gift_message` exists and is written by exactly one path. Anything that wants to *use* a
  gift note — printing it, editing it, emailing it — is a new decision.

## Alternatives considered

**Keeping the nudge everywhere and making it discount-aware.** Rejected outright: it would have
advertised a free-shipping threshold the server does not honour, which is a worse defect than the
placement one it was trying to fix.

**Making the shop chrome route-aware instead of splitting the shell.** A client `Header` reading
`usePathname` would have been a smaller diff and a worse structure — the chrome would have become
conditional everywhere rather than absent in one place, and ADR-044 had already made this call
once for the same reason.

**Fetching the cross-sell suggestions from a route**, the way `/api/search` fetches suggestions.
Right for search, which is paid for only by visitors who search; wrong here, where the rail is
part of the page and a round trip buys a loading state on the cart.

**Storing the gift note in the checkout bundle.** The bundle is a summary the confirmation page
reconciles against a verified order. A note the shopper is still typing is neither summary nor
evidence; it goes straight into the one request that creates the order, and if they navigate away
it is gone, exactly like an unsubmitted form field.

**Reporting the email as sent.** Would have required either awaiting a dispatch that is
deliberately not awaited, or reading `RESEND_API_KEY` at build time, where it is not present. The
honest sentence was cheaper than either.
