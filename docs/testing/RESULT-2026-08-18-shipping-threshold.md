# Test Result: Free-shipping threshold — 2026-08-18

- **Plan:** [PLAN-shipping-threshold.md](PLAN-shipping-threshold.md)
- **Commit:** `43e4645` plus the prompt-14 working tree
- **Environment:** local. Vitest 4.1.10 for the automated cases; TC-20 read from the
  `next build` output in `.next/server/app/*.html`. No Cashfree call was made.

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | `lib/cart.test.ts` — 798 → `{798, 99, 897}` |
| TC-02 | Pass | 799 → `{799, 0, 799}`; the inclusive boundary holds |
| TC-03 | Pass | 800 → `{800, 0, 800}` |
| TC-04 | Pass | `lib/order.test.ts` — 798 → `valid`, `99`, `897` |
| TC-05 | Pass | 799 → `valid`, `0`, `799` |
| TC-06 | Pass | 800 → `valid`, `0`, `800` |
| TC-07 | Pass | Empty cart zeroed, no flat rate |
| TC-08 | Pass | Sold-out-only cart `{0, 0, 0}` |
| TC-09 | Pass | Orphaned id produces no line and no shipping |
| TC-10 | Pass | Rejected order still zeroes `shipping` alongside every other amount |
| TC-11 | Pass | ₹250 + ₹100 → `subtotal 350`, `shipping 99`, `total 449` |
| TC-12 | Pass | ₹2000 + ₹1000 → `shipping 0`, `total 3000` |
| TC-13 | Pass | 10 × sold-out ₹700 alongside a ₹250 line still charges ₹99 |
| TC-14 | Pass | Two cheap lines `99`, one ₹1,000 line `0` |
| TC-15 | Pass | `price: 1`, `lineTotal: 1`, `total: 1` on the request ignored; `subtotal 1250`, free |
| TC-16 | Pass | `mrp: 250000` on a ₹500 piece; `subtotal 1000` |
| TC-17 | Pass | `FLAT_SHIPPING_RATE === 99`, `FREE_SHIPPING_THRESHOLD === 799` |
| TC-18 | Pass | `lib/cart-context.test.tsx` — `FREE` rendered, `₹1,099` explicitly asserted absent |
| TC-19 | Pass | `lib/address-checkout.test.tsx` — summary reads `FREE`, bundle written `{2000, 0, 2000}` |
| TC-20 | Pass | Built HTML: `/` carries "Free Shipping Over ₹799" and "Free shipping over ₹799 across India"; `/shipping` states the inclusive boundary in words; no `₹99`-as-flat-rate copy survives |

## Failures

None.

## Summary

20 passed, 0 failed, 0 skipped. Full suite **337 passing across 12 files** (up from 328 —
nine new cases, and eleven existing assertions rewritten where they assumed a flat rate).

Shippable. The rule is applied from one function in both pricing paths, the boundary is
inclusive on both sides of the client/server line, and shipping remains derived on the server
from a catalogue-priced subtotal rather than accepted from the request.

One thing this run could not check: a real Cashfree payment either side of ₹799. The amount
Cashfree is asked for is `buildOrderFromCart`'s `total`, which TC-04 to TC-06 cover directly,
but the first sandbox payment at ₹799 will be the first end-to-end proof that a free-shipping
order reaches the gateway with the right figure.
