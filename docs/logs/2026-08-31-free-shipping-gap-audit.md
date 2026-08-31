# The free-shipping gap was reported as wrong and is not, and two nearby things were

- **Date:** 2026-08-31
- **Prompt:** 116
- **Severity:** Minor (the reported defect), Major (one of the two found instead)
- **Status:** Resolved

## Symptom, as reported

> The gap-to-free-shipping amount (e.g. "Add ₹250 for free shipping") must be calculated
> against the actual selling price the customer is being charged — including today's 5%
> online-payment discount, if that path is selected — never against the MRP or the pre-discount
> subtotal. […] a discount being applied but the free-shipping gap not moving in response.

Two claims, and they need separating: that the gap might be read against a compare-at price, and
that it does not move when the online-payment discount is applied. The first would be a bug. The
second was observed correctly and is not one.

## Investigation

### It is not read against MRP, and structurally cannot be

The gap is `amountToFreeShipping(subtotal)` (`lib/config.ts`), and `subtotal` reaches it from
`calculateCartTotals` (`lib/cart.ts`), which sums `line.lineTotal`. `buildCartLines` sets
`lineTotal = entry.price * quantity`, and `entry.price` is the amount charged.

`mrp` is not merely unread by that path — until this prompt it was not summed anywhere at all.
The docblock on `calculateCartTotals` had said so since it was written: *"`mrp` is absent from
this file by design — the charged amount is always `price`."*

### It does not move with the online discount, and must not

`resolvePaymentPlan` (`lib/cod.ts`) computes:

```
total = cart.subtotal + cart.shipping        // shipping already decided
onlineDiscount = calculateOnlinePaymentDiscount(cart.subtotal)
discountedTotal = total - onlineDiscount
```

and the server's own pricing does the same, in `buildOrderFromCart` (`lib/order.ts:143`):

```
shipping = calculateShipping(subtotal)       // the undiscounted product subtotal
```

So **shipping is decided before the rebate exists**, and the rebate never moves the threshold. A
gap that moved with it would be advertising a threshold `/api/create-order` does not honour. The
worked case: a ₹799 cart ships free and is charged ₹759 after the 5% rebate; a gap read against
₹759 would tell that shopper they were ₹40 short of the free shipping they had already earned.

**The gap was therefore already the exact complement of the rule that charges.** It is now pinned
as such by `lib/free-shipping-gap.test.ts`, in both directions — including the over-promise case
above, asserted as the thing that must *not* happen.

### What was actually wrong: where the nudge was rendered

`OrderTotals` rendered the nudge, and all four order-summarising screens render `OrderTotals`. On
`/payment` that put "Add ₹250 for free shipping" two lines above "Online payment discount (5%)
−₹23" — two correct figures, adjacent, that look as though they should interact and do not. On
`/order-confirmation` it put a call to add more to a basket that had already been paid for.

Fixed by moving the nudge out of `OrderTotals` into `FreeShippingProgress`, rendered by `/cart`
alone. No arithmetic changed. See
[ADR-072](../decisions/ADR-072-checkout-flow-polish.md).

## Two defects found beside it

### The cart summary was never actually sticky (Major)

`CartSummary` and `CheckoutSummary` both carried `lg:sticky lg:top-32` and had done for several
prompts. Neither ever stuck.

A grid item is stretched to its row's height by default, so the panel filled its own containing
block and had nowhere to travel — `position: sticky` with zero slack is `position: static` with
extra classes. Measured in the browser before the fix: scrolling the cart 400px moved the summary
heading from `y = 371` to `y = −29`, straight off the top of the screen.

`lg:self-start` is the whole fix. After it, the same 400px scroll leaves the heading at
`y = 153` — pinned. The class had been on the element long enough to be believed; nothing had
ever measured it.

### The receipt totalled the cart, not the charge (Major)

Found while walking a real prepaid sandbox order. The confirmation screen showed:

```
Amount paid        ₹526
…
What you ordered
  Subtotal         ₹450
  Shipping         ₹99
  TOTAL            ₹549
```

Both figures are true and the pairing is not. The `sessionStorage` bundle is written at
`/address`, one step before a payment path exists, so `bundle.total` is what the cart was worth;
`amount` is what Cashfree charged after the 5% rebate. Nothing on the screen explained the ₹23.

`readBundleReceiptTotals` (`lib/verify.ts`) now derives the receipt's total from
`amountPrepaid + amountDue` — the two figures the server stamped onto the bundle, and the same
ones `canDisplayBundleForOrder` already reconciles against Cashfree before the receipt renders at
all — and surfaces the gap as an "Online payment discount" row. Nothing is recomputed from the
5% rate, so the row cannot disagree with the charge.

Introduced by [ADR-063](../decisions/ADR-063-online-payment-discount.md), which added a discount
to the charge and left the bundle's stamped `total` behind. Regression-tested in
`lib/confirmation-fine-print.test.tsx`, including the undiscounted case, which must render
exactly as it always did.

## Lessons

- **"Figure A does not respond to figure B" is a question about the rule, not a bug report.**
  Here the answer was that the rule deliberately decouples them, and the fix was to stop
  rendering the two side by side rather than to couple them.
- **A CSS class is not a behaviour until something measures it.** `lg:sticky` shipped, read
  correctly in review, and did nothing. The browser walk-through in the manual pass is what
  caught it, and it is why that pass now measures positions rather than only asserting text.
- **A discount added to a charge has to be chased into every screen that restates the total.**
  ADR-063 moved the charge; the receipt kept quoting a figure written one step earlier.
