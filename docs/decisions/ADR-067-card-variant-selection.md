# ADR-067: How a product card asks for an option, and how a cart line changes one

- **Status:** Accepted
- **Date:** 2026-08-30
- **Prompt:** 111

## Context

`ProductCard`'s Add to cart button sent every option group's declared `default` and gave no
visible sign that a choice had been made at all. The card rendered no control, so the shopper
saw a name, a price, and a button — and the line that arrived in their cart carried a selection
nobody had made.

**`/api/create-order` could not catch this, and it is worth being precise about why.**
`validateOrderLineOptions` refuses a selection the catalogue no longer offers, which is the
right guard against a stale browser tab. The value the card sent was never stale: it was always
a legal, currently-offered value taken straight out of the record. The order route had no way to
tell "the default, because the shopper chose it" from "the default, because nobody was asked",
because on the wire those two are the same request. Server-side validation was working exactly
as designed and the defect passed straight through it.

What that produced in this catalogue:

| Product | What the card sent |
| --- | --- |
| 42 bangles and 3 rings carrying a size group | The smallest listed size — `2.4`, or ring size `6` |
| P398, a birthstone pendant | `February Purple`, whatever month the shopper was born in |
| P408, a letter ring | `B` — the first entry in a values list that is not in alphabetical order, so not even the first letter of the alphabet |

The other half of the same problem was the cart. `CartLineItem` printed the recorded selection
as muted read-only text. A shopper who noticed the wrong size had no way to correct it: the only
route out was to remove the line and add it again from the product page.

## Decision

### 1. A card asks only the questions it can ask properly

`selectCardPurchaseMode` in `lib/card-purchase.ts` reads a product's option groups and returns
one of three modes. Nothing else decides this, and the card, the tests and the ADR all name the
same function.

| Mode | When | What the card does |
| --- | --- | --- |
| `add` | No option groups | Add to cart, one tap, unchanged. 390 of 449 products |
| `choose-on-card` | Exactly one group of **at most three** values | Chips on the card, the catalogue default pre-selected, Add to cart adds whatever is selected. 43 products |
| `choose-on-page` | One group with more values, **or** more than one group of any size | The button reads **"Choose Your Options"** and is a link to `/product/{id}`. It adds nothing. 16 products |

The three-value ceiling is a layout constraint, not a judgement about the option: a fourth chip
does not fit a card at the two-abreast phone width without wrapping to a second row, and a row
whose height depends on which product is in it is the misalignment the rest of this ADR exists
to prevent.

### 2. The pre-selected default on `choose-on-card` is a known, accepted residual risk

The owner confirmed this rule, on the understanding that anything high-stakes has more than
three values and is therefore routed to `choose-on-page`. **That understanding does not match
this catalogue**, and the discrepancy is recorded here rather than argued in code:

| Products still pre-selecting a default | Group |
| --- | --- |
| 35 | `Size for bangles`, exactly three values — `2.4` / `2.6` / `2.8`, default `2.4` |
| 3 | `Size for rings`, exactly three values — `6` / `7` / `8`, default `6` |
| 2 | `size` on the scrunchie sets — Small / Medium / Large, default Small |
| 1 | P398's `Stone`, two values — `February Purple` / `October Pink` |

Of the 45 size products the investigation counted, 7 are multi-group and are fixed by
`choose-on-page`; the other 38 keep a pre-selected default, as does the birthstone pendant. So
the rule as agreed fixes the letter rings outright and reduces the size and stone cases to a
*visible* default rather than an invisible one — the chips are on the card, the selected one is
marked, and a shopper who wants another taps it.

That is a real improvement and it is not the whole fix. The remedy, if the owner wants one
later, is a one-line change: lower `CARD_OPTION_VALUE_LIMIT`, or drop the pre-selection for
`choose-on-card` and disable Add to cart until a chip is tapped. Both were offered and the rule
above is the one that was chosen; this row exists so the next person does not have to rediscover
the arithmetic.

### 3. Cart lines are editable, through checkout's own validator

`changeCartItemOptions` in `lib/cart.ts` changes a line's selection and calls
`validateOrderLineOptions` — **the same function `/api/create-order` runs**, not a cart-side copy
of it. A selection the cart accepts is therefore one checkout accepts, and a withdrawn value is
refused in the words the order route would have used. Two rules follow from the cart's existing
behaviour rather than being invented here: an edit that lands on a line the cart already holds
merges into it and sums the quantities, exactly as adding the same choice twice does, and an edit
that does not keeps its line where it was in the list.

`CartLineOptionsEditor` is the surface. It renders `ProductOptionSelector` — the product page's
own control — so a letter is a dropdown in the cart for the same reason it is one on the page.
The draft is local until Save, so a refusal leaves the shopper's selection on screen with the
reason beside it.

### 4. Every card reserves the same vertical space, in every mode

Three fixed boxes below the photograph, present whether or not they have anything in them:

| Box | Height | Why it is reserved even when empty |
| --- | --- | --- |
| The name | `min-h-[2.75rem]`, two lines clamped | Pre-existing. A one-line and a two-line name push the price to the same offset |
| The chip row | `h-8` | An option-less card renders it empty. A row that appeared only on carded-option products would push their price and button down by its own height |
| The action | `h-11` | "Choose Your Options" wraps to two lines at every width below a desktop column; "Add to cart" never does |

The action box needed one addition to the button primitive. [ADR-025](ADR-025-button-padding-tailwind-content.md)
settled that padding alone defines a button's height, and that rule is what makes two buttons
with different labels different heights — which is exactly what a mixed row must not have. So
`buttonClasses` gained `fillHeight`, which drops the vertical padding and takes `h-full` from
the box the caller has already sized. It is opt-in, the product card is its only caller, and
ADR-025's rule still governs every other button on the site.

The chips themselves are `OptionRadioGroup` at card scale — the same radio wiring, checked state,
arrow-key handling and focus ring as the product page's chips and pills, with the group's name
kept as the accessible name alone because the card has one row of space to spend. They are laid
out as a grid of equal columns rather than a wrapping flex row, so the row is one line however
long the values are; a long value truncates visually and stays whole in the DOM.

### 5. Availability is one predicate, and the badge is one cascade

`stock.quantity` joins `stock.inStock` on the record. They answer different questions — "is this
being sold at all" and "how many are on the shelf" — and `isStockAvailable` is the only place
they are combined. `toCatalogueEntry`, the order pricing catalogue and the product schema all
read it, so a zero count cannot produce a "Sold Out" badge above a working Add to cart button.

`selectProductBadge` returns at most one badge, in a strict priority order:

1. **Sold Out** — not available. Nothing else about the piece matters yet.
2. **Only N left** — `quantity <= 2`, with the real count. It outranks merchandising because it
   is the only badge that is about to stop being true.
3. **The owner's badge** — `flags.badge`, or `flags.isNew` for the New case.
4. Nothing.

**`flags.isNew` was kept and `flags.badge` added beside it**, rather than one replacing the
other. They are not duplicates: `isNew` is a *membership* flag that decides the home
new-arrivals row, the `new-arrivals` collection facet and a catalogue floor, and 408 of the 449
records carry it — which is why it could never be a badge on its own. `badge` is a *display*
choice and the only field that can ask for Trending or Best Seller. The cascade's New case fires
on either, so every New badge that rendered before this change renders after it, and no record
needed its badge backfilled to anything but `null`.

The shop's Status facet reads `selectProductBadge` rather than the fields beneath it, so "Only a
few left" lists exactly the pieces whose cards say that — a low-stock piece the owner also marked
Trending is filed under the badge a shopper actually saw.

## Consequences

- A card can no longer record a choice nobody made for a product with more than three values or
  more than one group. For the 43 products inside the card rule it records a *visible* default;
  §2 states plainly which those are.
- `CARD_OPTION_VALUE_LIMIT` is now a real merchandising lever. Raising it puts more questions on
  cards; lowering it to `1` would end pre-selection in this catalogue entirely.
- Every card is `h-8 + h-11` taller in its action area than before, including the option-less
  majority. That is the price of a row that holds all three modes at one baseline.
- `stock.quantity` is a field the owner now has to keep true. Every existing record was
  backfilled to `10` for in-stock and `0` for sold-out — a placeholder chosen to sit clear of
  the low-stock threshold, so nothing in the catalogue claims a scarcity it cannot support until
  the owner enters a real figure in the admin form.
- `fillHeight` is a second way for a button to get its height. It is documented as opt-in and
  single-caller; a third caller should be asked to justify itself.
