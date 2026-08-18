# ADR-019 — Product options: a recorded choice, never a price

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 18
**Builds on:** the `Product.options` field imported in [ADR-016](ADR-016-real-product-import.md),
the cart architecture in [ADR-010](ADR-010-cart-architecture.md), and the pricing core in
[ADR-013](ADR-013-order-creation-and-payment.md)

## Context

Four of the owner's products are made to the buyer's choice. `data/products.json` has carried
that choice as catalogue data since ADR-016 and nothing read it:

| Product | Group | Values |
| --- | --- | --- |
| P001 Wave Band Initial Ring | Letter | A–Z without X (25) |
| P005 Silver Initial Signet Ring | Letter | 22 of the 26 |
| P006 Floating Locket Pendant | Shape | Oval, Heart, Rectangle, Round |
| P010 Mini Watch Ring | Colour | Silver, Golden |

The owner's constraint is unusually clean: **the choice changes nothing but what gets made.**
Every letter costs ₹399. Every locket shape is the same photograph. There is one stock state
per product, not one per value. Nobody is ever charged differently for a `B` than for an `A`.

That is not what a variant system normally is. A variant system gives each combination its
own SKU, price, stock count and image, and every part of the codebase that touches money has
to learn about it. Building that here would import a large amount of machinery to model a
distinction that does not exist in this business, and would put the option data one step away
from the price calculation — which is exactly where a pricing bug lives.

The one thing the choice genuinely *does* change is identity. A shopper buying an `A` ring
and a `B` ring has bought two different things, and a cart that keys on the product id alone
would collapse them into "Wave Band Initial Ring ×2" and lose which letters to engrave. There
is no database ([ADR-001](ADR-001-tech-stack.md)), so whatever the cart records has to reach
the order under its own power or the information is gone.

## Decision

**An option is a recorded choice. It participates in line identity and in nothing else.**

### 1. Price, stock and image are independent of the selection, by construction

`buildOrderFromCart` is untouched by this prompt. Its signature still takes product ids and
quantities and an `OrderPricingEntry` catalogue with no `mrp` and no `options` field, so no
amount can read a choice even by accident. The client cart's `unitPrice` and `lineTotal`
still come from `CatalogueEntry.price`. `lib/order-options.ts`, which is the only server
module that handles selections, is typed against an `OrderOptionEntry` that has no `price` at
all. Tests assert that two selections of one product price identically to two of the same
piece, and that the totals are byte-identical whichever value is chosen.

### 2. The cart line's identity is `lineKey(productId, selectedOptions)`

`CartItem` gains an optional `selectedOptions?: Record<string, string>`. The cart's unit of
work moves from the product id to a **line key**: the product id alone when there is no
selection, and otherwise the id followed by the selection's `name=value` pairs, sorted and
percent-encoded.

```
P002                      a product sold in one configuration
P001|Letter=A             the same product, two lines
P001|Letter=B
P010|Colour=Golden|Letter=B   sorted, so record order cannot produce two keys
```

Three properties earn the encoding. Sorting makes the key independent of the order the
selection's keys happen to be in, so `{Letter, Colour}` and `{Colour, Letter}` are one line.
Percent-encoding makes it injective — a value containing `|` or `=` cannot forge another
line's key. And for the ninety-six products with no options the key **is** the product id,
which is why every existing call site, test and persisted cart kept working unchanged: the
337 tests that passed before this prompt still pass, untouched.

Add, increment, set-quantity, remove, dedupe and stale-prune all key on it.

### 3. Every group has a default, and the default is visible

The first value of each group is pre-selected. A personalized product is addable from a
product page or a shop card without the shopper ever opening a selector, and `AddToCartButton`
needed no change to do it: `addProductToCart` resolves whatever it is given — including
nothing — against the entry's current options, so a line always carries a complete selection.

A default nobody chose is still a default they have to be able to see, so the selection is
echoed above the buy buttons on the product page and under the name on every cart line, the
checkout summary and the confirmation receipt.

### 4. A withdrawn value drops the line; an added group fills with the default

On hydrate, a persisted line is dropped when its product has left the catalogue — as before —
and now also when its selection names a group or a value the catalogue no longer offers. A
line that is merely *incomplete*, because the product gained a group after it was added, is
kept and filled with the default.

The asymmetry is deliberate. A sold-out product keeps its line so the shopper can see it and
remove it; a withdrawn *value* has nothing to keep, because the line describes a piece we
cannot make. Substituting the nearest letter would ship somebody an engraving they did not
ask for, which is worse than making them choose again.

### 5. The order carries the selection, and lines merge for pricing only

`/api/create-order` receives one entry per cart line, each with its `selectedOptions`. Two
things then happen, in this order:

`mergeOrderItemsByProduct` sums the quantities of one product's lines into a single priced
item, because `buildOrderFromCart` deliberately refuses a repeated product id — merging inside
the pricing core would let a client beat the per-product quantity cap by repeating a product.
Merging in front of it keeps that guard: the *summed* quantity is what gets bounds-checked, so
two lines of six are still refused with `INVALID_QUANTITY`.

`validateOrderLineOptions` then checks each line's selection against `data/products.json` and
builds a compact `P001:Letter=A; P001:Letter=B` summary. A value the catalogue no longer
offers is refused with a new `INVALID_OPTION` code rather than silently resolved to a default,
for the same reason as the prune above — the shopper's browser may be holding a page from
before the change.

The summary goes to Cashfree as `order_tags`, split across at most three values to respect the
255-character limit, with a `+N more` marker if even that overflows. With no database, the
payment record is the order record: this is where a packer reads what to engrave.

### 6. Personalized means non-returnable, said where it applies

`/refund` already exempts made-to-order pieces from returns. Having options is what makes a
piece made-to-order, so the note appears with the option: in full next to the buy actions on
the product page, with a link to `/refund`, and in short form on the cart line.

## Alternatives considered

**A SKU per combination.** The conventional variant model. Rejected because it would create
25 SKUs for P001 that differ in no field — same price, same stock, same photograph — and put
option data inside the pricing path to express a difference that does not exist.

**Options as a free-text note on the order.** Cheapest possible: one textarea, no cart
changes. Rejected because it cannot make two letters two lines, so the cart could not show
what was chosen per line, quantities could not be edited per choice, and nothing validates
that the letter is one we offer.

**Keying cart lines by a generated line id.** A UUID per line instead of a derived key.
Rejected because merging then needs a separate comparison of selections anyway, persisted
lines cannot be re-identified after a catalogue change, and the same selection added twice
would silently become two lines.

**Resolving an unknown option value to the default at order time** instead of refusing it.
Rejected: it converts a stale page into a wrong engraving, silently.

## Consequences

**Easy.** Adding options to another product is a data edit — add an `options` array, and the
selector, the cart line echo, the note and the order metadata all follow. Auditing that
options cannot affect money is a type-level argument, not a code read: neither pricing module
can see an option, and `OrderOptionEntry` cannot see a price.

**Harder.** One product's lines now share the per-product quantity cap of 10 across all of
its selections, because they are merged before the cap is checked. Five `A` rings and six `B`
rings is a rejected order with an `INVALID_QUANTITY` message naming the product. This is the
correct reading of "at most ten of a piece" and it is the price of leaving the pricing core
untouched, but it is a real edge a shopper can reach from the cart page, where each line can
independently be set to 10.

**What would force a revisit.** A value that legitimately costs more — a longer chain, a
different stone. That breaks the premise in the title of this ADR and needs a new one, not an
edit to this file: prices would have to move into the option data and every module here that
is typed to be unable to see a price would have to be re-typed to see one.
