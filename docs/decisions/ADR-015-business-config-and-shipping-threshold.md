# ADR-015 — Single-source business config and a free-shipping threshold

**Status:** Accepted
**Date:** 2026-08-18
**Supersedes:** the placeholder-marker approach recorded in
[ADR-012](ADR-012-static-and-policy-pages.md) §"Unresolvable business facts"

## Context

Two unrelated problems arrived together, and both are about a single number or string being
written down in more than one place.

**The business identity was still placeholder.** ADR-012 deliberately marked what could not
be invented — `[REGISTERED ENTITY NAME]`, `[CITY]`, `[STATE]`, a `910000000000` WhatsApp
number, `hello@morchadigems.example` — and put those markers in `lib/config.ts` so they sat
in one file rather than across the pages. That was the right call at the time and it worked:
the real details have now been supplied and there was exactly one file to change.

But `lib/config.ts` is not a file a shop owner should be asked to edit. It holds derived
values (`DELIVERY_ESTIMATE_LINE`), functions (`buildWhatsAppLink`, `calculateShipping`),
metadata shapes and operational promises, all mixed in with the eight facts about the
business itself. Opening it to change a phone number means reading code.

**Shipping was a flat ₹99 with no free tier.** The business wants free shipping over ₹799.
The rate was already a single constant read by the cart, the server-side order pricing, the
trust strip and four policy pages — so the risk was not that the change is hard, but that a
*conditional* rate is easy to implement twice and get subtly different, particularly across
the client/server boundary where the two answers are produced by different modules.

## Decision

### 1. `config/business.ts` is the owner's file

A new top-level `config/` directory holds one file, `config/business.ts`, exporting a single
`BUSINESS` object of plain literal fields with a comment on each. It contains no logic, no
derived values, no formatting, and no imports. It is the only place in the repository where
the legal entity name, brand name, jurisdiction, support email, phone number, WhatsApp
number and postal address are written down.

`lib/config.ts` imports `BUSINESS` and is now purely the *site's* configuration: it maps
those facts into the shapes the app already consumes (`SITE_CONFIG`, `CONTACT_CONFIG`,
`LEGAL_CONFIG`), derives what can be derived, and adds the service commitments that belong
to the site rather than to the entity — opening hours, reply window, dispatch and delivery
windows, the payment provider.

Nothing outside `lib/config.ts` imports `config/business.ts`. Pages and components keep
reading `lib/config.ts` exactly as before, so the wiring changed and the call sites did not.

Two consolidations fell out of this. `CONTACT_CONFIG.privacyEmail` and
`CONTACT_CONFIG.orderSupportEmail` are gone: there is one business inbox, and three keys
holding what must always be the same address is drift waiting to happen. All support,
returns, order and privacy contact points now read `CONTACT_CONFIG.supportEmail`. This also
closed the `.example`-versus-real-domain discrepancy flagged in the prompt-13 build log row.

`phoneHref` is derived from `phoneDisplay` by stripping non-digits rather than being a
second field, so the two cannot disagree. `whatsappNumber` stays a separate field because a
shop's chat number legitimately differs from its landline.

The full postal address now renders publicly on `/contact` and in the footer. That is a
deliberate business decision, not an accident of having the data: an Indian ecommerce
merchant is expected to publish a registered address, and Cashfree's onboarding asks for
one that matches the site.

### 2. One shipping rule, one function, two callers

`lib/config.ts` gains `FREE_SHIPPING_THRESHOLD = 799` alongside `FLAT_SHIPPING_RATE = 99`,
and one function over both:

```ts
export function calculateShipping(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_RATE;
}
```

**The boundary is inclusive.** A subtotal of exactly ₹799 ships free. `>=`, not `>`. This is
the kind of detail that gets decided twice and differently, so it is stated here, stated in
the shipping policy, and pinned by tests at 798 / 799 / 800 in both pricing modules.

Both pricing paths call this function rather than reimplementing the comparison:

- `calculateCartTotals` in `lib/cart.ts` — what the shopper is shown.
- `buildOrderFromCart` in `lib/order.ts` — what is charged.

The `subtotal <= 0` guard is what replaced the cart's previous "charge shipping only when a
payable line exists" check. It is now expressed as a property of the subtotal rather than of
the line list, which is why the same function serves both callers: an empty cart, a cart
holding nothing but sold-out pieces, and an order that never got built all produce a
subtotal of zero and no shipping.

### 3. The trust boundary is unchanged

Shipping is still decided server-side. `buildOrderFromCart` derives it from a subtotal it
computed itself from `data/products.json`, and its signature still has nowhere to put a
client-supplied amount. A client cannot claim to have qualified for free delivery, and a
client that quietly sends a ₹0 shipping figure is not sending an input to anything — the
cart's number is display only. `mrp` remains absent from the pricing types, so a compare-at
price cannot push a subtotal over the threshold either.

### 4. Display rules

The rule is visible wherever it is charged:

| Where | Copy |
| --- | --- |
| `TrustStrip` | "Free Shipping Over ₹799" |
| `AnnouncementBar` | "Free shipping over ₹799 across India" |
| `OrderTotals` row label | "Shipping (free over ₹799)" |
| `OrderTotals` row value | `₹99` when charged, `FREE` when earned, `—` when there is nothing payable |
| `OrderTotals` hint | "Add ₹X for free shipping" while `0 < subtotal < 799` |
| `/shipping`, `/terms`, `/about`, `/shop` metadata | free over ₹799, ₹99 below, India only |

Every one of those reads `FREE_SHIPPING_THRESHOLD` and `FLAT_SHIPPING_RATE` from
`lib/config.ts`. No page writes "₹799" or "₹99" as a literal. The `—` state is kept distinct
from `FREE` on purpose: an empty cart has not earned free shipping, it simply has nothing to
ship, and showing "FREE" there would read as a promise.

The "Add ₹X for free shipping" hint is computed by `amountToFreeShipping`, which is display
only — no total is ever derived from it.

## Alternatives considered

**Leave the business facts in `lib/config.ts`.** They were already in one file, which met
the letter of the requirement. Rejected because the file also holds functions and derived
strings; "the one place the owner edits" and "the module the app imports" are different
jobs, and the owner's file should be readable without reading code.

**Put the values in environment variables.** Tempting for a hosted app, but wrong here: none
of these are secrets, all of them belong in version control with the copy they appear in,
and a missing env var would silently render an empty address on a live policy page. The
catalogue is already committed data (ADR-001); the business identity belongs with it.

**Keep `privacyEmail` and `orderSupportEmail` as separate keys pointing at the same
address.** Rejected — three fields that must always hold the same value is exactly the
duplication this ADR exists to remove. If the business later wants a dedicated privacy
inbox, adding the field back is a two-line change made deliberately rather than a divergence
discovered by a shopper.

**Compute shipping inline in both `lib/cart.ts` and `lib/order.ts`.** It is a two-line
comparison, and inlining it would have looked harmless. Rejected because the failure mode is
the worst one available: the cart shows free shipping, the server charges ₹99, and the
shopper's card is debited an amount the page never displayed. A shared constant is not
enough — the *comparison* has to be shared, because that is where the `>=`/`>` decision
lives.

**An exclusive boundary (`> 799`).** Arbitrary either way, but inclusive is what a shopper
reading "free over ₹799" and landing on exactly ₹799 expects to happen, and it is the
friendlier of the two failures.

**A percentage or per-region rate.** Out of scope and unwanted — India-only shipping with
one threshold is the whole rule, and the policy pages say so in those terms.

## Consequences

**Easy.** Changing any business fact is one edit in `config/business.ts` that propagates to
the header, footer, contact page, all four policies, the WhatsApp button, the `tel:` link
and every share card. Changing the shipping rule is one edit to two constants in
`lib/config.ts` that propagates to both pricing paths and all display copy simultaneously.

**Harder.** Copy that reads naturally under a flat rate no longer does — "the ₹99 shipping
charge" became "any shipping charge paid on the original order" in the refund policy,
because whether one was paid now depends on the order. Prose that names an amount has to be
written conditionally or not name it.

**Also settled.** The `[PLACEHOLDER — confirm]` markers on the refund policy's
non-returnable categories are resolved rather than deleted: made-to-order pieces, pierced
jewellery on hygiene grounds, and clearance purchases are non-returnable, and no pickup is
arranged for change-of-mind returns (collection remains at our cost for faulty or incorrect
pieces). These are business-policy calls now written into the policy; the owner should
confirm them, but the site no longer ships bracketed placeholder text to shoppers.

**What would force a revisit.** A second shipping tier, per-state rates, or a courier
surcharge would outgrow a single threshold and want a table plus a lookup. Selling outside
India would break the "India only" claim the same copy makes. A separate privacy or legal
inbox would reintroduce a second email field.
