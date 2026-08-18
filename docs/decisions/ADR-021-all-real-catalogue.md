# ADR-021 — The catalogue becomes entirely real: 49 products, no invented filler

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 20
**Builds on:** the product data model in [ADR-002](ADR-002-product-data-model.md), the
discount display rules in [ADR-003](ADR-003-discount-display-pricing.md), the image path
convention in [ADR-006](ADR-006-product-image-convention.md), the first real import in
[ADR-016](ADR-016-real-product-import.md), the honest-language pass in
[ADR-018](ADR-018-honest-product-description.md), the options model in
[ADR-019](ADR-019-product-options.md), and the two-tier IA in
[ADR-020](ADR-020-two-tier-catalogue-ia.md)

## Context

The catalogue held 100 products: the owner's 21 real ones from ADR-016, and 79 invented
placeholders that had been there since the site was scaffolded. The placeholders were
always scaffolding — they existed so the grid, the pagination, the filters and the price
bands had something to work on before there was anything real to sell.

They cannot ship. A storefront that lists 79 products nobody stocks is not a storefront
with placeholder content in it; it is a shop that takes money for things that do not exist.
Every invented row was a live product page with an Add to Cart button, a price, and
fabricated reviews under a name no customer ever wrote.

The owner has now supplied their full range: 49 products, P001–P049, with photography for
every one already on disk under the ADR-006 path convention.

## Decision

**`data/products.json` contains the owner's real range and nothing else.** Every non-P-code
row is deleted. P001–P021 keep the data imported in ADR-016 unchanged; P022–P049 are added.
The catalogue is 49 products across all ten ADR-020 categories.

### The id is the guarantee, and the validator now enforces it

`scripts/validate-products.mjs` previously accepted two id conventions — the owner's P-code
*or* the `nk-001` category-prefix form invented for the placeholders. It now accepts only
`^P\d{3}$`.

That single line is what makes "no invented products" a property of the repository rather
than a fact about one afternoon. An invented row cannot be added later without either
taking a P-code it has no right to or failing the gate. The whole placeholder apparatus goes
with it: the category-prefix map, the second discount ceiling that applied only to
placeholders, the required-weight rule that applied only to placeholders, and the check that
2–3 placeholders be out of stock.

Two floors move with the real data. `MIN_PRICE` drops from ₹100 to ₹25 — P047 sells at ₹49,
and the old floor was calibrated to invented prices. The discount ceiling is a single 80%
for every product; the highest in the catalogue is P020 at 78.3%.

The per-category "has at least one product" check, relaxed to a report in ADR-020 while
`watches` and `hair-accessories` stood empty, is restored as a hard failure. Every category
now holds stock, and an empty one is a broken nav entry.

### Prices come from the owner's list, unchanged

Where the owner quoted two numbers, the lower is `price` and the higher is `mrp`. Where they
quoted one, `mrp` equals `price` and no discount is displayed — ADR-003 already makes an
equal pair render as a plain price with no struck-through comparison. Seven products sell at
full price on that rule.

### Stock is binary, because the shop is

"Will be available soon" and "Out of stock" both become `inStock: false`; "N units in stock"
becomes `true`. The unit count is deliberately dropped. There is no database
([ADR-001](ADR-001-tech-stack.md)), so a quantity in a JSON file could not be decremented by
a sale and would be a number that lies more with every order. Six products are out of stock:
P006, P008, P011, P015, and the two tulip bracelets P039 and P040 that the owner lists as
available soon.

### Collection tagging: eight anti-tarnish, zero gifting

`anti-tarnish` is tagged on the eight products whose supplied copy states it: P022, P023,
P036, P037, P038, P039, P040, P046. No P001–P021 product's description claims it, so none
is tagged — the tag records what the owner said about a specific product, not what the site
says about the range in general.

**`gifting` is tagged on nothing, and that is a decision, not an omission.** Nothing in the
range is sold as a gift set. Tagging products into it to stop the facet looking empty would
make the tag mean "we thought this would do as a present", which is not a fact about the
product and not something a shopper could rely on. The consequence is accepted and recorded
below: the Gifting entry in the nav and the filter sidebar resolves to an empty listing
until a gift set is stocked. A test pins that state so it reads as known rather than broken.

### Variants: one added, two refused

P048 gains a Colour option — Ivory White, Antique Gold, Lilac Shimmer, Cream Shimmer — on
exactly the ADR-019 mechanism P010 uses. It qualifies for the same reason: the choice
changes what gets sent and nothing else. Same price, one stock state, one photograph.

P041 (Kashmiri Ghungroo Bangles) and P049 (Satin Scrunchies) were offered by the owner in
packs and sizes **at different prices**. Both ship here as single-price products with the
pack and size folded into `details.size`, because ADR-019 draws its line precisely there: an
option participates in line identity and in nothing else. A choice that changes the price is
a different product, and modelling it as an option would put a price-bearing field one step
away from the money path — which is exactly where a pricing bug lives. The honest thing is
to sell one configuration at one price and settle the rest on WhatsApp, which is what the
copy says.

### Thin categories are accepted

`pendants` holds one product, `necklaces` and `watches` two each. These are real counts of a
real range. A category page with one product is a thin page; a category page with one real
product and four invented ones is a dishonest page. The former is the correct trade.

## Alternatives considered

**Keep the placeholders and mark them out of stock.** Rejected: an out-of-stock listing is
still a claim to stock the item, and 79 permanently-sold-out products would read as a failing
shop rather than an honest one.

**Keep the placeholders behind a feature flag or a `draft` field.** Rejected as the same
thing with more machinery. Nothing needs the rows; deleting them is cheaper than gating them.

**Model P041 and P049 packs and sizes as priced variants.** Rejected — see above. Doing it
properly means per-variant price and stock, which is the SKU system ADR-019 declined to
build for a business that does not have one.

**Delete the 100 orphaned placeholder images.** Not done this prompt, by instruction. They
are noted in [IMAGES.md](../design/IMAGES.md) as orphaned and safe to delete.

## Consequences

- 49 products, 66 static pages (down from 117). Category counts: rings 18, earrings 7,
  nose-pins 5, bracelets 5, bangles 3, anklets 3, hair-accessories 3, necklaces 2,
  watches 2, pendants 1.
- Eight featured and eight new, both spread beyond rings so the home shelves show the range.
- **Every product now costs ₹499 or less**, so the `1000-4999` and `5000-plus` price bands
  are empty and the `under-999` collection returns the whole catalogue. The bands and the
  collection are still correct — they describe the catalogue accurately — but two of the
  three price checkboxes now lead to an empty listing. Re-banding the price facet to the
  real spread (roughly ₹49–₹199, ₹200–₹299, ₹300+) is a follow-up; the band keys are public
  URL surface under ADR-008 and ADR-020, so it is a deliberate change, not a tidy-up.
- The `gifting` nav link and facet checkbox lead to an empty listing until a gift set exists.
- 100 orphaned placeholder images (1.2 MB) remain under `public/products`, unreferenced.
- `scripts/generate-placeholders.mjs` still runs and still skips everything: all 49 product
  images and all 10 category images exist. It stays for the next product the owner adds.
