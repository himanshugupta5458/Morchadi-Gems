# ADR-003: Discount display pricing

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 3

## Context

Jewelry retail in India is sold against a compare-at price. A shopper expects to see what a
piece "normally" costs struck through, next to what they will actually pay. Without that
contrast the catalogue reads as expensive rather than as good value, and the storefront
loses the single most effective merchandising device it has.

This creates a hazard. The moment a second money-shaped number exists on a product, there
are two candidates for "the amount", and the wrong one can reach the payment order. That
would be a real financial defect: overcharging every customer by 10–40%, silently, on a
code path that tests would happily pass because both numbers are valid integers.

[ADR-001](ADR-001-tech-stack.md) and `CLAUDE.md` already establish the trust boundary —
the client sends product IDs and quantities, the server decides what those cost by reading
`data/products.json`. A second price field has to be introduced without weakening it.

## Decision

**`Product` gains one field, `mrp: number`.** It is the display-only compare-at price. It
is always a positive whole number of rupees and always greater than or equal to `price`.

**`price` remains the only field that any amount calculation may read.** `mrp` is display
data in the same category as `shortDescription` or `rating`. Concretely, and permanently:

- the Cashfree order amount is computed from `price`
- cart line totals, the subtotal, shipping, and the order total are computed from `price`
- `mrp` never appears in `lib/` pricing code, in any route handler, or in any figure sent
  to a payment provider
- `mrp` appears only in presentational components, as a struck-through string

The naming carries the rule. The field is not called `originalPrice`, `listPrice`, or
`compareAtPrice` — all of which read as prices and invite arithmetic. `mrp` is a
merchandising acronym, not a price noun, and the two helpers that touch it
(`calculateDiscountPercent`, `hasVisibleDiscount` in `lib/format.ts`) both return display
values — a percentage and a boolean. Neither returns rupees. There is no function anywhere
that turns an `mrp` into an amount.

**`mrp === price` is a supported state, not a data error.** Five of the hundred products
ship at full price. `ProductCard` branches on it: with a discount it shows the struck `mrp`,
the `price` in sale red, and a percentage chip; without one it shows `price` alone in ink,
with no strikethrough and no chip. A "0% off" chip is a bug, not an edge case.

**The catalogue's discount spread is fixed data, not a runtime calculation.** Each product
carries a literal `mrp` in `data/products.json`, seeded 10–40% above its `price` and
rounded to a retail-plausible figure (nearest ₹100 above ₹5,000, ₹50 above ₹1,000, ₹10
below). Nothing derives a discount at render time from a percentage constant, so changing
one product's discount is a one-line data edit.

**`scripts/validate-products.mjs` enforces the invariants.** Every product must have an
`mrp` that is a positive whole number, is `>= price`, and implies a discount of no more
than 60%. The 60% ceiling is a credibility guard: a jewelry storefront advertising "80%
off" reads as fraudulent, and Indian consumer-protection guidance on misleading MRP claims
makes an inflated compare-at price a legal exposure, not just a taste question.

## Alternatives considered

**A `discountPercent` field, with `mrp` derived at render.** Rejected. It puts a
multiplication between the data and the displayed price, and a rounding choice inside a
component. It also makes the struck-through number a computed figure, which is exactly the
kind of thing that later gets "reused" in a total.

**A `price` / `salePrice` pair, where `price` is the higher number.** Rejected, and it is
worth naming why: it inverts the meaning of `price`. Every existing call site — and every
future one written by someone who did not read this file — reads `price` and assumes it is
the amount charged. Under that scheme they would all silently overcharge. The chosen shape
fails safe: anyone who ignores `mrp` entirely still gets correct money.

**Deriving `mrp` from `price` at runtime with a fixed markup.** Rejected. Uniform discounts
across a hundred products look synthetic, and merchandising then lives in code rather than
in the catalogue.

**No compare-at price at all.** Rejected on commercial grounds. It is the standard
convention for the category, and its absence is conspicuous.

## Consequences

Cards, product pages, and the cart can all show a discount without any of them gaining the
ability to compute one. Merchandising is a data edit.

The invariant is now enforced in three places — the type, the validator, and this record —
but none of them can stop a determined future change from summing `mrp`. The real defence
is that `price` is the shorter, more obvious field, and that no helper converts `mrp` into
money. Any code review that sees `mrp` inside an arithmetic expression that produces rupees
should treat it as a defect on sight.

Displayed discounts are static until someone edits the catalogue. If Morchadi Gems ever
runs a real time-boxed sale, that is a different feature — scheduled pricing — and it needs
its own ADR rather than an overloaded `mrp`.

We would revisit this if the business began running genuine promotional pricing, or if a
compare-at price ever needed to vary by region or campaign. Both would move pricing out of
a static catalogue and force ADR-001's no-database decision back open.
