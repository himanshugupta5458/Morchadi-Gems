# ADR-016 — Importing the owner's real products into a placeholder catalogue

**Status:** Accepted
**Date:** 2026-08-18
**Amends:** the id convention in [ADR-002](ADR-002-product-data-model.md), the discount
ceiling in [ADR-003](ADR-003-discount-display-pricing.md), and the "100 placeholder
products" premise in [ADR-006](ADR-006-product-image-convention.md)

## Context

Until now every one of the 100 products in `data/products.json` was invented — names,
prices, materials, ratings and reviews written to make the storefront render populated while
the real catalogue did not exist. The owner has now supplied 21 real products: a photograph
each, a name and description, a selling price, an MRP where there is one, a stock state, and
for four of them a per-piece choice the buyer makes (an engraved letter, a locket shape, a
plating colour).

Three things about that data do not fit the catalogue the placeholders shaped:

**The ids do not fit.** The owner refers to these pieces by their P-code — P001 through
P021 — on the invoices, in the photo filenames, and in every message about them. ADR-002's
`nk-001` / `rg-013` convention encodes the category into the id, which is useful when you
are inventing a hundred rows and worthless when the owner already has a numbering scheme.

**The prices do not fit.** These are ₹130–₹499 pieces. The placeholder catalogue was priced
₹299–₹25,000 and the validator asserted that band. The MRPs are steeper too: ₹130 against
₹599 is a 78% implied discount, and ADR-003 set a 60% credibility ceiling on invented MRPs.

**Some fields the owner simply did not supply.** There is no measured weight for any of the
21. The placeholder rows all have one because it was made up.

Separately, four products carry buyer-selectable options. Wiring options into the product
page and the cart means changing the cart's line identity — a cart line is currently keyed
by product id alone, and "P001 in K" and "P001 in M" are different lines. That is a real
change to the money path and it is not this change.

## Decision

### 1. Real products keep their P-code as their id

`id` is `P001`…`P021`, exactly as the owner writes it. The image path derivation from
ADR-006 is untouched and now yields `/products/P001.webp`; the 21 photographs are dropped
in under those names and `validate:products` confirms each exists on disk.

The `{prefix}-NNN` convention survives for every placeholder row. The validator now accepts
**either** form, and only applies the category-prefix rule to ids that are not P-codes.

The two schemes coexist deliberately rather than one being migrated to the other. The
placeholders are temporary; renumbering them to P-codes would imply they are the owner's
and make it harder, not easier, to tell invented rows from real ones at a glance.

### 2. Options are captured as data now and wired later

`Product` gains `options?: ProductOption[]` where `ProductOption` is `{ name, values }`.
P001 and P005 carry a `Letter`, P010 a `Colour`, P006 a `Shape`. Nothing reads the field:
the product page does not render a selector, `CatalogueEntry` does not carry it, and cart
lines are still keyed by product id alone.

Recording the data one prompt ahead of the UI is the point. The selector and the cart
keying change together in the next prompt, and doing that against a catalogue that already
holds the real values means the wiring is tested against real option sets — a 25-letter
list, a 4-value shape list — rather than a fixture invented for the occasion.

`validate:products` checks the shape today so a malformed option cannot sit in the
catalogue unnoticed while nothing renders it: each option needs a non-empty `name`, at
least one non-empty value, no duplicate values, and no two options sharing a name.

### 3. Fixed attributes are `details`, not options

Stone colour, size and material are properties of the piece, not choices the buyer makes.
`ProductDetails` gains optional `stone` and `size` alongside `material`, `weight`, `closure`
and `type`, and `ProductDetailsList` renders them in that order when present.

The distinction is what keeps the option model honest: "Green Solitaire Thread Ring" has a
green stone recorded in `details.stone` and no options, so it will never grow a selector.
P010 has two platings the buyer picks between, so it does.

### 4. Checks invented for placeholder data apply only to placeholder data

Three validator rules existed to keep *made-up* data plausible. They are now scoped to the
rows they were written for:

| Rule | Placeholder rows | Owner's rows |
| --- | --- | --- |
| Id convention | `{prefix}-NNN` enforced | P-code |
| Implied discount ceiling | 60% | 80% |
| `details.weight` | Required | Optional |

The price band floor moved from ₹299 to ₹100 for all rows, because it is a sanity bound on
a data-entry slip rather than a claim about the range the shop sells in.

Everything else — id uniqueness, image path and file existence, `mrp >= price`, rating
range and precision, review count and distinctness, flag types, no stray keys — is checked
identically on all 100 products.

**Weight is not invented for the owner's products.** A stated weight is a factual claim to
a buyer, and there is no version of it that is better than absent. `ProductDetailsList`
already renders only the keys present, so those rows simply have no Weight line until the
owner supplies one.

### 5. The 18 real rings replace the 13 placeholder rings entirely

Rings is the category the owner actually stocks, so every `rg-*` row is deleted rather than
kept alongside. Eight further placeholders are trimmed to hold the catalogue at exactly 100,
spread one or two per category and chosen as the most duplicative row within each:

| Removed | Category | Duplicated |
| --- | --- | --- |
| `rg-001` … `rg-013` | rings | replaced wholesale by P001–P021's 18 rings |
| `nk-011` | necklaces | `nk-001`, also a kundan bridal necklace |
| `nk-012` | necklaces | `nk-005`, also an oxidised silver piece |
| `er-013` | earrings | `er-003`, also oxidised silver |
| `br-012` | bracelets | `br-002`, also oxidised silver |
| `bn-013` | bangles | `bn-003`, also an oxidised kada |
| `pd-011` | pendants | `pd-009`, also a premium navratna-class pendant |
| `ak-011` | anklets | `ak-001`, also a silver payal |
| `np-009` | nose-pins | `np-003`, also a silver nose ring |

100 is not a magic number, but it is the number `validate:products` asserts and the number
every doc quotes, and holding it means the trim is a deliberate act rather than drift.

The three out-of-stock placeholders (`nk-006`, `er-004`, `bn-006`) are kept on purpose. Four
of the owner's products are out of stock too, but they are all rings and all under ₹500 —
keeping placeholder sold-outs preserves coverage of the sold-out UI at other price points
and in other categories. The validator now asserts 2–3 *placeholder* sold-outs specifically,
so the coverage cannot be trimmed away by accident later.

### 6. P004 and P012 stay as two listings

They are the same ring, photographed identically, priced identically. The owner lists them
twice and asked for them kept that way, so they are two rows with distinct names ("Heart
Crystal Adjustable Ring", "Clear Heart Statement Ring"). This is the owner's merchandising
call, not a data error, and de-duplicating it would silently overrule them.

### 7. The owner's products get placeholder ratings and reviews

All 21 launch with a rating, a review count and 2–3 reviews drawn from the same invented
pool the placeholder catalogue uses. None of it is real: the shop has taken no orders yet,
so there is no review to show.

This is a considered trade, not an oversight. A product card with no rating reads as broken
next to 79 that have one, and the alternative — stripping ratings from the whole catalogue —
would strip the storefront of its social proof entirely before launch. The reviews are
consistent with what already ships and carry no claim the placeholders do not.

**This must be revisited before the shop takes real orders.** Fabricated reviews on a live
storefront are a consumer-protection problem, not a design one. The replacement path is the
same for both: real reviews arrive, and these rows are overwritten.

## Consequences

- Rings is now the largest category (18 of 100) and is entirely real.
- Home's Best Sellers and New Arrivals surface 10 of the owner's products between them, with
  the remaining 6 flags on placeholders so all eight categories stay represented.
- The catalogue holds two id schemes at once. `getProductById`, related products, shop
  filters and category counts are all data-driven and needed no change; the id is an opaque
  key everywhere except the validator and the image path.
- Four products have options that nothing renders. Until the next prompt, a buyer adding
  P001 to the cart gets a ring with no letter recorded. This is why the option data landing
  first is only safe for one prompt.
- The validator's per-row exemptions are keyed off `^P\d{3}$`. If placeholders are ever
  renumbered to P-codes, those exemptions silently widen to cover them.

## Alternatives considered

**Renumber the real products into `rg-014` … `rg-031`.** Rejected. It breaks the owner's own
numbering, which is what they will quote when reporting a stock or price problem, and it
buys only a uniform-looking id column.

**Wire options in the same change.** Rejected. Cart line identity is on the money path and
`buildOrderFromCart` is the one place a total is produced. Changing what a cart line *is*
deserves its own change with its own tests, not a rider on a data import.

**Delete every placeholder and ship 21 products.** Rejected, for now. Seven of the eight
categories would empty out, the shop's filters and category tiles would have nothing to
show, and the storefront would look abandoned rather than small. The placeholders go when
there is real stock to replace them, category by category — rings just went first.

**Drop ratings and reviews from the real products.** Rejected on the grounds above, and
recorded as a launch blocker instead.
