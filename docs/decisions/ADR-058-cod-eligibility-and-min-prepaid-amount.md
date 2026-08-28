# ADR-058: Cash on delivery is decided per product by `pricing.minPrepaidAmount`, and a cart qualifies only unanimously

- **Status:** Accepted
- **Date:** 2026-08-28
- **Prompt:** 99

## Context

Cashfree's account manager has **denied cash on delivery at the account level** (ticket
8266236). There is no `payment_methods` toggle to enable, and — more consequentially — none of
the controls a gateway normally wraps around COD comes with it:

| What a gateway usually supplies | What this shop gets |
| --- | --- |
| Pincode serviceability | Nothing |
| RTO risk scoring on the buyer | Nothing |
| Order-value ceilings | Nothing |
| Buyer history and blocklists | Nothing — [there are no shopper accounts](ADR-001-tech-stack.md) |

So COD is being built entirely storefront-side, and the owner has explicitly accepted the risk
of taking a COD order with **no fraud or eligibility screening whatsoever** behind it. That is
a business decision, recorded here because it is the premise every rule below rests on and it
is not one a future reader should have to infer from the absence of screening code.

What the shop can still control is *which pieces* it is willing to send out uncollected. A
₹210 hair tie that never gets picked up costs the shop ₹210 and a courier leg. A ₹12,000 piece
does not, and no amount of storefront logic changes that arithmetic.

## Decision

### 1. The field is per-unit and lives in `pricing`

`ProductPricing` gains `minPrepaidAmount: number` — whole rupees, per unit:

- **`0`** means the piece may be sold cash on delivery. Every one of the 449 records in the
  catalogue is `0` today.
- **Any value above `0`** means COD is unavailable for any order containing the piece, and at
  least that much per unit must be paid online.

It belongs in `pricing` rather than beside `stock.inStock` or in `flags` because it is
denominated in rupees and constrains an amount. It is catalogue data, so it ships as code and
carries the same audit trail every other price does — a price change is a commit
([ADR-001](ADR-001-tech-stack.md)).

### 2. A cart qualifies for COD only unanimously

`isCartCodEligible` in [`lib/cod.ts`](../../lib/cod.ts) offers COD only when **every** line
reads `minPrepaidAmount === 0`. One barred piece withdraws the option from the whole order,
not from its own line.

The alternative — collect the eligible portion in cash and charge the rest online — was
rejected. It splits a single delivery into two settlement paths, and the reconciliation
problem that creates (a partial refund against a partially-collected order, with the courier
holding the cash) is considerably larger than the merchandising benefit of letting a mixed
cart through. Strictness here is a reconciliation decision wearing a checkout costume.

### 3. An empty cart is **not** eligible

`isCartCodEligible([])` is `false`, not the vacuous `true` that `Array.every` would otherwise
give.

There is nothing to decide about an empty cart, and a caller about to render a payment choice
is better served by the answer that fails safe. A caller asking the question at all has a bug;
`false` makes that bug quiet rather than sending an empty order down the cash-collection path.
This is asserted by an explicit test rather than left to `every`'s semantics, because it is a
decision and not an accident.

### 4. Eligibility gets its own catalogue accessor, not a wider `OrderPricingEntry`

`getCodEligibilityCatalogue()` in [`lib/products.ts`](../../lib/products.ts) returns
`CodEligibilityEntry { id, minPrepaidAmount }` — a fourth accessor beside
`getOrderPricingCatalogue`, `getOrderCaptureCatalogue` and `getOrderOptionCatalogue`.

`minPrepaidAmount` was **not** added to `OrderPricingEntry`, and the reasoning is the one
already written down for `pricing.cost`, which got its own accessor for exactly this reason:
each accessor carries the fields one decision may read, so no caller acquires a field by
accident.

Applied here it cuts both ways, which is what makes it worth the fourth accessor:

- `buildOrderFromCart` cannot read `minPrepaidAmount` into a total — it is not in the object.
- `isCartCodEligible` cannot read `price` into an eligibility rule — likewise.

That second direction is the one that matters. Whether COD is offered is a property of *which
pieces* are in the basket, never of what it is worth. Keeping the amount out of
`CodEligibilityEntry` is what stops this rule quietly becoming an order-value threshold the
first time somebody is tempted to add one, and the type system enforces it rather than a
convention.

### 5. A migrated product arrives COD-eligible, and the draft does not get a say

`mapPricing` in [`lib/draft-a-to-product.ts`](../../lib/draft-a-to-product.ts) writes
`minPrepaidAmount: 0` and does not read the field from the Draft A record.

Whether a piece is too costly to risk on an uncollected delivery is a statement about the
shop's exposure, not a fact about the product, so a content draft is not in a position to
assert it. Migrated records arrive eligible and the owner raises individual ones afterwards —
the same posture the backfill took with the catalogue that predates the field.

### 6. The validator's split: shape is hard, amount is advisory

`scripts/validate-products.mjs` requires `pricing.minPrepaidAmount` on every product and
requires it to be a whole number of rupees, zero or more. A missing or malformed field is a
**hard failure**.

An amount **greater than the piece's own `price`** — asking a shopper to prepay more than the
item costs — is an **advisory**, not a failure. This mirrors the existing split on
`pricing.cost`, where presence and shape are hard checks and cost-against-price is advisory:
the figure is the owner's to correct, and a business number that wants attention should not
turn the build red.

Both rules live in `scripts/min-prepaid-rule.mjs` rather than inline in the validator, so the
tests exercise the code the gate actually runs. The validator calls `process.exit` at module
scope and cannot be imported by a test, which is the same constraint that produced
`banned-meta-adjectives.mjs` and `keyword-normalisation.mjs`.

## Consequences

- Every product carries a field that nothing reads yet. The checkout UI, the COD order path
  that bypasses Cashfree, and `captureOrder`'s hardcoded `paymentType: "prepaid"` are
  deliberately **not** in this change — that work touches the money path and gets its own
  isolated review.
- There is no admin UI for setting the field. Raising a product's `minPrepaidAmount` is a
  commit, like every other price change.
- **The shop carries the full COD risk.** No screening exists at any layer, by decision rather
  than by oversight. If RTO losses turn out to be material, the levers available are this
  field, a pincode allowlist the shop would have to build itself, or dropping COD again.
- The unanimity rule means one barred piece can cost the shop a whole COD basket. That is the
  intended trade and it is worth re-examining with real order data rather than in advance.
