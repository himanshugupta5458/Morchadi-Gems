# ADR-063: A 5% online-payment discount, computed once and shared by the preview and the charge

- **Status:** Accepted
- **Date:** 2026-08-29
- **Prompt:** 107

## Context

[ADR-059](ADR-059-checkout-payment-paths.md) gave checkout three payment paths and let the
server price each one from its own catalogue read. Cash on delivery has stood at parity with
online payment since: whichever a shopper picks, the total is the same. The task behind this
prompt was to give online payment an edge — 5% off, and only where it can be offered honestly.

The obvious place for the incentive to land is `resolvePaymentPlan`, the one function
[ADR-059](ADR-059-checkout-payment-paths.md) already made the sole source of what each path
costs — the route calls it once, and the payment step's own live preview exists only to render
what the route is about to compute. A second, independent implementation of "5% off" in the
component would be a second place for the figure to drift from the one that actually gets
charged, which is precisely the failure mode `resolvePaymentPlan`'s single-source design exists
to rule out.

## Decision

### 1. The discount is a fact about `resolvePaymentPlan`'s `"full"` branch, not a new code path

`ONLINE_PAYMENT_DISCOUNT_RATE = 0.05` and `calculateOnlinePaymentDiscount(subtotal)` are added to
`lib/cod.ts`, beside the eligibility logic they depend on. `resolvePaymentPlan`'s `"full"` branch
now reads:

```ts
const isSimpleCodEligibleCart = cart.summary?.isCodEligible === true;
const onlineDiscount = isSimpleCodEligibleCart
  ? calculateOnlinePaymentDiscount(cart.subtotal)
  : 0;
```

`cart.summary` is the same `CartPrepaymentSummary | null` the `"cod"` and `"partial"` branches
already consult — the route's own catalogue read via `summariseCartPrepayment`, never anything
the client asserts. The discount is earned only when `isCodEligible` reads positively `true`:
never on `summary === null` (eligibility could not be established, so the safe reading already
used elsewhere in this function — no cash on delivery either — applies here too) and never on a
cart holding any piece with `minPrepaidAmount > 0` (see decision 3).

`resolvePaymentPlan` gained a `total` field on `PaymentPlan` (`amountPrepaid + amountDue`, after
any discount) and an `onlineDiscount` field, and its parameter changed from `{ total, summary }`
to `{ subtotal, shipping, summary }` — it now needs the two components of the total separately in
order to discount one and not the other. `app/api/create-order/route.ts` passes `order.subtotal`
and `order.shipping` instead of `order.total`, and writes `plan.total` /
`order.subtotal - plan.onlineDiscount` into `captureBase.pricing` rather than `order.total` /
`order.subtotal`, so the row records what was actually charged.

### 2. 5% of the product subtotal, never shipping, and never `mrp`

The discount is computed from `cart.subtotal` — the sum of `price × qty` across the cart's
lines — and `total = subtotal + shipping − onlineDiscount`. Shipping is untouched at every
subtotal: `lib/payment-paths.test.ts`'s `"never discounts shipping, only the subtotal"` prices
the same cart with and without a shipping fee and asserts the discount figure is identical while
`total` differs by exactly the shipping amount. Shipping is a delivery cost, not a piece of
merchandise, and discounting it would make the free-shipping threshold
([ADR-015](ADR-015-business-config-and-shipping-threshold.md)) and this discount interact in a
way neither was designed for.

`mrp` — the compare-at price `lib/format.ts`'s `calculateDiscountPercent` and
`hasVisibleDiscount` render against product and cart lines — is never read by any of this. Every
figure `calculateOnlinePaymentDiscount` and `resolvePaymentPlan` touch traces back to
`pricing.price` through `data/products.json` → `getOrderPricingCatalogue()` /
`getCodEligibilityCatalogue()`, and neither catalogue accessor carries an `mrp` field to read
([ADR-003](ADR-003-discount-display-pricing.md), the seal `lib/order.ts` states explicitly for
`OrderPricingEntry`). A catalogue-level markdown and this checkout-time discount are two
independent things that happen to both be called "discount"; the second never widens or narrows
the first, and a product's struck-through `mrp` on its own page is unaffected by which payment
path a shopper eventually chooses.

### 3. The partial-payment path is excluded structurally, not by a special case

Nothing in `resolvePaymentPlan`'s `"partial"` branch or in the discount calculation itself
mentions `minPrepaidAmount`. The exclusion is a consequence of `isCartCodEligible`
([ADR-058](ADR-058-cod-eligibility-and-min-prepaid-amount.md)), reused as-is: a cart with any
line reading `minPrepaidAmount > 0` produces `isCodEligible: false`, so
`isSimpleCodEligibleCart` is `false` for that cart on **every** path, including a shopper on such
a cart choosing "pay in full" instead of the minimum. There is no second gate to keep in sync
with the first, because there is only one gate — the same unanimity rule that decides whether
cash on delivery is offered at all also decides whether the online discount is. This is why
`lib/cod.ts`'s discount code needed no new eligibility concept: `isCartCodEligible` already meant
"this cart may be paid for later, in full, with no money changing hands until delivery," and a
cart that qualifies for that is, by the same fact, one this shop is comfortable collecting less
for if the shopper pays now instead.

Two regression tests exist because this is the property most likely to be broken by a future
change that edits the discount condition without noticing it is reading the eligibility flag:
`lib/payment-paths.test.ts`'s `"never discounts a cart holding any piece that requires
prepayment, on either of its two options"` asserts `resolvePaymentPlan` returns `onlineDiscount:
0` for both `"full"` and `"partial"` against a barred cart, and `lib/payment-checkout.test.tsx`'s
`"never discounts paying in full on a cart that requires prepayment"` renders the actual payment
step against a `REQUIRES_PREPAYMENT` fixture and asserts no "Save" badge, no discount row, and a
pay button reading the undiscounted total.

### 4. Nearest rupee, via one function every caller shares

`calculateOnlinePaymentDiscount` is `Math.round(subtotal * ONLINE_PAYMENT_DISCOUNT_RATE)`.
Nearest-rupee was chosen over always-down or always-up because every rupee amount in this
codebase has been a whole number from `data/products.json` onward — the tolerance note on
`isBalancedOrderPayment` in `lib/order-capture.ts` records that this is the first place a 5% cut
could produce a fraction — and nearest-rupee is the reading that does not systematically favour
either the shop or the shopper the way a fixed rounding direction would.

**One function, not one rule restated twice.** `resolvePaymentPlan` (the authoritative figure)
and `PaymentCheckout.tsx`'s `buildPaymentChoiceOptions` (the live preview shown before a shopper
commits to a path) both call `calculateOnlinePaymentDiscount` directly rather than each
re-implementing `subtotal × 5%, rounded`. Two independent roundings of the same number can
disagree by a rupee at the boundary of a `.5` case; importing the same function cannot.
`lib/payment-paths.test.ts`'s `"rounds to the nearest rupee, via the one function both the plan
and any preview must share"` sweeps nine subtotals — including several odd multiples of 20 where
`× 0.05` lands exactly on `.5` — and asserts `plan.onlineDiscount === calculateOnlinePaymentDiscount(subtotal)` and that the result is always an integer.

### 5. The UI mirrors the server's decision; it does not make its own

`buildPaymentChoiceOptions` computes `onlineDiscount` from `prepayment.isCodEligible` — the same
client-side `summariseCartPrepayment` call [ADR-059](ADR-059-checkout-payment-paths.md) §8
already accepted as a rendering aid, not a binding one. The pay-in-full button's amount, its
"Save 5%" badge, and the `OrderTotals` discount row all derive from this one client-side figure,
and all three disappear together the instant cash on delivery is selected
(`lib/payment-checkout.test.tsx`'s `"reflects the online discount live in the Order Summary, and
drops it the instant cash on delivery is chosen"`). None of it is authoritative: `/api/create-order`
recomputes eligibility and the discount from its own catalogue read on every call
(decision 1), and a stale or tampered set of client-side options costs the shopper a rendering
mismatch at worst, never a different charge.

## Alternatives considered

**A flat rupee discount instead of a percentage.** Rejected without much debate — the brief was
explicitly "5% off," and a flat amount would either overpay on cheap carts or underpay on
expensive ones relative to that brief.

**Discounting the whole `total` (subtotal + shipping) instead of `subtotal` alone.** Rejected in
decision 2: shipping is a pass-through delivery cost, not merchandise, and discounting it would
make this feature and the free-shipping threshold interact unpredictably — a cart just under the
free-shipping line would see its effective discount rate change depending on whether the ₹99
shipping fee was itself discounted.

**A configurable rate, read from `config/business.ts` like `FREE_SHIPPING_THRESHOLD`.** Rejected
on the explicit brief that a per-owner setting was out of scope for this change; `0.05` is a
constant in `lib/cod.ts` rather than configuration. Revisit if the owner asks to tune the rate
without a code change.

**A separate `isOnlineDiscountEligible` flag, computed independently of `isCartCodEligible`.**
Considered because "eligible for cash on delivery" and "eligible for an online-payment discount"
are conceptually different questions that happen to share an answer today. Rejected in decision
3: a second flag computed from the same unanimity rule would be two implementations of one fact,
and the whole value of reusing `isCartCodEligible` is that there is nothing to keep in sync. If
the two questions are ever meant to diverge — a piece that may be paid for on delivery but should
never be discounted, say — that is the day this decision gets revisited, not before.

## Consequences

- Paying online in full is now strictly cheaper than cash on delivery on any cart every line of
  which reads `minPrepaidAmount: 0` — today, every cart, since no product yet carries a
  nonzero floor ([ADR-058](ADR-058-cod-eligibility-and-min-prepaid-amount.md)'s consequences
  already recorded this). The incentive is live in production the moment this ships.
- `PaymentPlan.total` is a new field, and it is no longer always `cart.subtotal + cart.shipping`
  — the first time this codebase has needed a payment total to differ from that sum. Any future
  caller of `resolvePaymentPlan` must read `plan.total` rather than recomputing
  `subtotal + shipping` itself, or it will silently ignore the discount.
- `mrp`/`hasVisibleDiscount` and this discount remain two unconnected mechanisms, verified by
  grep across `lib/`, `components/` and `app/` rather than assumed: neither `lib/cod.ts` nor its
  callers import or read `mrp` anywhere.
- **Revisit if** a product ever ships with `minPrepaidAmount > 0`: decision 3's exclusion becomes
  observable in production for the first time rather than only in tests overriding the
  eligibility catalogue, and is worth a manual walkthrough at that point, matching the same
  caution [ADR-059](ADR-059-checkout-payment-paths.md)'s consequences already recorded for the
  partial-payment path generally.
