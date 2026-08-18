# ADR-011: Checkout step 1 — the address page

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 10

## Context

`/address` is the first page in this project that asks the shopper for something rather than
showing them something, and the first that has to hand state to a *later* page.

Four constraints shape it.

**There are no accounts** ([ADR-001](ADR-001-tech-stack.md)). Nothing is remembered between
visits, nothing is prefilled from a profile, and the address exists only for this order.

**Cashfree is a hosted redirect.** The browser will leave this site entirely and come back.
Anything the confirmation page needs to render has to survive that round trip, and there is no
database to park it in.

**The cart lives in `localStorage`** ([ADR-010](ADR-010-cart-architecture.md)), so the server
render knows nothing about it. This page has to *decide something* on that unknown — whether
there is anything to check out at all — which the cart page did not have to do.

**Money is not the client's to state.** `CLAUDE.md` is unambiguous: an amount arriving from
the client is untrusted input. This page is about to write amounts into browser storage.

## Decision

**1. Validation is pure functions in `lib/address.ts`, returning field-level errors.**

One validator per field, each returning `string | undefined`, plus `validateAddressForm`
which runs all of them and returns `{ errors, address }`. `address` is non-null exactly when
`errors` is empty, and it is trimmed and normalised — so the caller cannot accidentally store
raw form input, and there is no cast between "checked" and "typed".

`validateAddressForm` deliberately does **not** stop at the first failure. A submit reports
every problem at once; making someone discover their mistakes one round trip at a time is a
worse form for no less code.

No validation library. The eight rules here are short, specific to Indian addresses, and
carry copy we want to control. A schema library would add a dependency and a DSL to express
`^[6-9][0-9]{9}$`.

**2. The states list is one typed constant, in `types/cart.ts`.**

`INDIAN_STATES` (28 states + 8 union territories, `as const`), the derived `IndianState`
union, and the `isIndianState` guard live beside `Address` — the same arrangement
`types/product.ts` uses for `CATEGORIES` and `Category`. The `/address` dropdown maps over it
and the validator checks against it, so **the control cannot offer a value the validator
rejects**. `Address.state` is typed `IndianState`, not `string`, so an unvalidated state
cannot be assigned anywhere downstream.

**3. `sessionStorage` is a display bridge. It is never trusted for money.**

On a valid submit, `buildCheckoutData` assembles a `CheckoutData` — cart items, address,
subtotal, shipping, total — and it is written to `sessionStorage` under
`morchadi-checkout-v1`. `/payment` and the confirmation page read it to render a summary.

**Those amounts are display state and nothing else.** They exist so a page can say "₹2,099"
after a redirect without refetching. The order-creation route, when it is built, will take the
product ids and quantities, recompute every amount server-side from `data/products.json`, and
ignore the numbers stored here entirely. A shopper who edits `sessionStorage` to `total: 1`
changes what one page *renders* and nothing about what they are *charged*.

This is stated bluntly because the shape of `CheckoutData` invites the opposite reading: it
looks like an order, and a later prompt could plausibly post it straight to Cashfree. That
would be the bug this ADR exists to prevent. `parseCheckoutData` reinforces it — it validates
*shape* only, and its test suite asserts that a tampered total passes, because rejecting it
would imply this layer was ever an authority on the number.

`sessionStorage` rather than `localStorage`: a half-finished checkout should not outlive the
tab, and a stale address from three weeks ago is worse than an empty form.

**4. Storage failure never blocks the checkout.**

`sessionStorage` throws in some private-browsing modes and when the quota is full.
`writeCheckoutData` catches, returns `false`, and the page navigates to `/payment` anyway. A
checkout must not die because a summary could not be cached. The consequence is handed to the
next step: **`/payment` must handle a missing bundle** — read it, and if it is `null`, send the
shopper back to `/address` rather than rendering an empty order.

**5. The form repopulates from the bundle on mount.**

`/payment` will offer an Edit affordance back to here. Reading the stored bundle on mount and
seeding the form from `toAddressFormValues(address)` makes that a real back-navigation rather
than a retype. A corrupt bundle is ignored and the form starts empty.

**6. An unreachable checkout renders a guard, not a redirect.**

If the cart is empty, or a line has sold out, `/address` shows a `CheckoutGuardNotice` — an
explanation plus links back to the cart and the shop.

A redirect was the other option and is worse here. It would have to fire from an effect after
hydration, which races the cart's own hydration and can bounce a shopper with a full cart; and
a checkout that silently relocates you reads as a fault rather than as a rule. The guard says
what happened.

**7. Nothing is decided until both the cart and the saved address are known.**

The page renders a loading notice until `isHydrated` **and** the `sessionStorage` read has
happened. Verified against the served build: the prerendered `/address` HTML contains the
loading notice and zero occurrences of the guard text, the form, or the summary.

Two flashes are avoided by waiting, and they are different bugs. Rendering the guard first
would show "there is nothing to check out" to someone with a full cart. Rendering the form
before the bundle is read would show empty fields to someone who came back to edit, then fill
them a frame later.

**8. No native form submission.**

The `<form>` carries `noValidate` and an `onSubmit` that calls `preventDefault` first, so the
browser never navigates and never renders its own validation bubbles. Submit is not disabled
while the form is invalid — a dead button explains nothing. Pressing it validates, shows every
error, and moves focus to the topmost invalid field via `ADDRESS_FIELDS` order.

## Alternatives considered

**A validation library (Zod, Yup, react-hook-form).** Standard, and it would replace ~120
lines. Rejected for eight fixed fields whose rules are all local and whose error copy is
brand voice; the pure functions are directly unit-testable and add nothing to the bundle.

**Trusting the stored totals at order creation.** The bundle already holds them and it would
save recomputing. Rejected — it is the exact failure `CLAUDE.md` forbids, and the numbers are
in a store the shopper can edit.

**`localStorage` for the checkout bundle.** Would survive a tab close, which sounds like a
feature. Rejected: a stale address and a stale cart snapshot resurfacing days later is a
support problem, not a convenience.

**Redirecting an empty cart to `/cart`.** Rejected in favour of the guard — see above.

**Disabling submit until the form is valid.** Rejected: with no errors shown yet, a disabled
button is a puzzle. Validation on submit with focus management is more accessible.

**Storing the address on the server against a draft order id.** The correct answer with a
database. There is no database ([ADR-001](ADR-001-tech-stack.md)).

## Consequences

**Easy.** Validation is testable without a DOM and is already covered by 50 cases. The states
list cannot drift between control and validator. The summary panel is shared with `/cart`
through `OrderTotals`, so the two cannot disagree about a total. Coming back from `/payment` to
edit is free.

**Hard.** The address does not survive a tab close, and there is no "save my address" without
accounts. The page cannot be meaningfully server-rendered — a cold visit shows a loading line
for one frame by design. And the bundle is a contract with no compiler behind it across the
redirect: `/payment` must treat a missing or corrupt bundle as normal, not exceptional.

**What would force a revisit.** Accounts or saved addresses (the address moves server-side).
International shipping (the states list and the phone and pincode rules stop being Indian).
Server-side draft orders, which would make the `sessionStorage` bridge unnecessary. Address
autocomplete or pincode-to-city lookup, which would introduce a network call into a page that
currently has none.
