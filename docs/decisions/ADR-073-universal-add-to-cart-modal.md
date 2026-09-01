# ADR-073: One add-to-cart modal, for every product with anything to choose

- **Status:** Accepted
- **Date:** 2026-08-31
- **Prompt:** 117
- **Supersedes:** [ADR-067](ADR-067-card-variant-selection.md), §1, §2 and §4

## Context

[ADR-067](ADR-067-card-variant-selection.md) shipped this morning. It fixed a real defect — a
product card sent every option group's declared `default` with no visible sign a choice had been
made, and `/api/create-order` could not catch it because the value on the wire was always a
legal, currently-offered one — and it fixed it by **tiering the risk**. `selectCardPurchaseMode`
sorted every product into one of three shapes:

| Mode | Products | What the card did |
| --- | --- | --- |
| `add` | 390 | One tap |
| `choose-on-card` | 43 | Chips on the card, **the catalogue default pre-selected** |
| `choose-on-page` | 16 | A "Choose Your Options" link to `/product/{id}`, adding nothing |

The line between the last two was `CARD_OPTION_VALUE_LIMIT = 3`, and ADR-067 was explicit that
this is **a layout constraint, not a judgement about the option**: a fourth chip does not fit a
card at the two-abreast phone width.

ADR-067 §2 is the part this ADR is a response to. It records, in its own words, that the
pre-selected default inside `choose-on-card` is *"a known, accepted residual risk"*, agreed on
the owner's understanding that anything high-stakes has more than three values — and that
**this catalogue does not match that understanding**. 35 bangles and 3 rings sit inside the
three-value rule with their smallest size pre-selected; so do the two scrunchie sets and P398,
the birthstone pendant, whose two values are `February Purple` and `October Pink`. A shopper
born in October who taps Add to cart on that card gets February, visibly but not deliberately.

§2 ended by naming the two remedies and recording that neither was chosen: lower the ceiling, or
drop the pre-selection and disable Add to cart until a chip is tapped. This is the second of
those, generalised — and generalising it is what dissolves the tiering, because once nothing is
pre-selected there is nothing left for the tiers to protect against.

## Decision

### 1. Two modes, not three, and the second one opens a modal

`selectCardPurchaseMode` keeps its name and its role as the single decider, and returns:

| Mode | When | What the card does |
| --- | --- | --- |
| `add` | No option groups | Add to cart, one tap, unchanged |
| `choose` | **Any** option groups, any count, any size | Add to cart opens `AddToCartModal` |

`CARD_OPTION_VALUE_LIMIT` and `CHOOSE_OPTIONS_LABEL` are deleted, `CardOptionChips` is deleted,
and no card renders an option value anywhere.

### 2. Nothing is pre-selected inside the modal, for any product

This is the property ADR-067 existed to protect, and it is the reason this is a reversal worth
making rather than a restyle. ADR-067 protected it **conditionally** — fully for the 16 products
it routed to the product page, partially for the 43 it did not. This protects it
**unconditionally**, by a stricter rule than ADR-067 could state:

> A card sends no option value at all, because a card no longer records choices. It asks.

The modal opens with an empty draft. Its confirm button is disabled until every group holds a
value the catalogue currently offers (`isSelectionComplete`), and the helper text names the
first group still waiting (`firstUnansweredGroup`), so the sentence and the button cannot
disagree. Dismissing — the close icon, the overlay, Escape — adds nothing, and reopening starts
empty rather than resuming a half-made decision.

Two details carry that rule into places it could have leaked out of:

- **`OptionDropdown` renders a disabled "Choose…" placeholder** when its value is not one the
  group offers. A native select handed an empty value displays its first option, so without this
  the letter rings would have shown `A` — the silent default, drawn by the browser instead of by
  us.
- **`toConfirmedSelection` narrows the draft to the product's own groups** before it reaches the
  cart. `resolveSelectedOptions` fills any group it is not told about from `option.default`, and
  a stray key is the one way a value nobody chose could still get in.

### 3. Why one interaction beats three, now that the risk is gone

The three-way split was a *risk* model: ask on the card where it is safe, send the shopper away
where it is not. Once nothing is pre-selected anywhere, the birthstone pendant and the letter
ring are exactly as safe as the three-value bangle — every one of them is a question with no
answer filled in — and the model has nothing left to sort by. What remains is a cost: three
shapes to learn, three heights to reserve, and one of them ("Choose Your Options") that took a
shopper off the listing page to a product page in order to answer a question that fits in a
360px box.

The owner's call, stated plainly: **a single consistent interaction is worth more than the
risk tiering**, because the tiering's whole justification was a difference in risk that the
modal removes.

### 4. Reuse is the point, not an implementation detail

The modal renders `ProductOptionSelector` — the product page's own control, and the cart line
editor's — so a letter is a dropdown in all three places because it is the same question in all
three. It reads `item.options` and renders one labelled section per group; a metal tone, a chain
length, a second size, anything the catalogue can describe as an option group, needs no change
here. `ProductOptionSelector` gained two props to make that work: `label`, so the legend can
read "Select Size for bangles" while staying one string rather than a visible label beside a
hidden legend, and `layout`, so the modal's 360px width gets a 38px chip baseline while the
product page keeps values sized to their own labels.

`useAddToCartFlow` owns the branch — add outright, or open the modal — and every surface with an
add button goes through it: the product card, the compact cross-sell card, and
`AddToCartButton`. **A surface that decided for itself could forget the second half**, and
forgetting it is precisely ADR-067's defect.

### 5. One reserved slot survives, and it was measured

ADR-067 reserved three boxes below the photograph — a two-line name block, an `h-8` chip row and
an `h-11` action. The chip row is gone with the chips. The name is one truncated line, because
nothing below it varies any more. The action keeps a reserved `h-10` box and `fillHeight`,
because it is the one element whose *label* changes ("Add to cart" / "Added ✓" / "Sold out").

The tag beside it — `3 sizes`, `25 options` — is the one thing that appears on 59 cards and not
on the other 390, and the question of whether it needs a reserved slot was **measured rather than
assumed**: `scripts/measure-card-heights.mjs` loads the built listing in a headless Chromium,
groups cards into rows by their top offset, and reports the spread of real
`getBoundingClientRect` heights within each row, at three viewports, with and without the slot.

**The measurement contradicted the assumption, and the record should say so.** The expectation
going in was that removing the slot would misalign a mixed row. It does not, at any viewport:
every row measured 0px spread with the slot and 0px without it. `ProductGrid` stretches its grid
items and `mt-auto` bottom-aligns the action, so within-row alignment is guaranteed by the grid
and not by anything reserved on the card.

What the slot actually buys is **row-to-row** uniformity, and it is worth 24px — the 16px line
box plus the 8px `gap-2` that comes with it. Without it, a row holding one tagged card stays
289.59px at phone width while a row of untagged cards drops to 265.59px, so the listing's
vertical rhythm would depend on which products happened to fall in which row and would change
with the sort order and the page. The slot stays for that reason rather than the one it was
originally reserved for, at 16px — down from ADR-067's 76px. The full table of measured numbers is in
[`docs/testing/RESULT-2026-09-01-universal-add-to-cart-modal.md`](../testing/RESULT-2026-09-01-universal-add-to-cart-modal.md);
[the plan](../testing/PLAN-universal-add-to-cart-modal.md) states what it had to show, and
records that its own first draft predicted the wrong number.

### 6. What the tag counts, and why it changes

`describeOptionGroups` counts **values** when there is one group and **groups** when there is
more than one. That is deliberate and not an oversight: with one group the useful number is how
many values it offers, because that is the whole question; with several, the useful number is
how many questions there are. A piece with a design group and a size group is "2 options" to a
shopper, and summing its values into "5 options" would describe a list that appears nowhere.

## Alternatives considered

**Keep ADR-067 and only drop the pre-selection inside `choose-on-card`.** ADR-067 §2 named this
as the one-line remedy, and it would have closed the bangle and birthstone cases. It leaves the
three-way split standing for a reason that no longer exists — with no default pre-selected, a
three-value chip row on a card is not safer than a five-value one, it is merely narrower — and
keeps "Choose Your Options" sending shoppers to a product page to answer a question a dialog
answers in place. Rejected because it fixes the symptom and keeps the model that produced it.

**Lower `CARD_OPTION_VALUE_LIMIT` to 1.** Also named in ADR-067 §2. It ends pre-selection in this
catalogue by routing everything with options to the product page, which is a full page load per
add and the worst outcome for the 43 products that were working.

**Inline expansion on the card instead of a modal.** A card that grows a selector in place when
tapped keeps the shopper on the listing without an overlay. It cannot work in a grid: a card
that changes height reflows its row, and a 200px tile at the two-abreast phone width has no room
for a labelled group, let alone two. This is the constraint ADR-067's ceiling was about, and it
did not go away.

**A global modal owned by a provider, opened by id.** One mount instead of one per card. It puts
cart-add behaviour behind a context and a lookup, so a caller could raise the modal for a product
it does not hold; per-caller mounting keeps the item and the handler in the same scope. The
portal already solves the only problem a global mount would have solved, which is escaping the
card's transformed ancestor.

## Consequences

- **The no-silent-default property is now unconditional**, and ADR-067 §2's accepted residual
  risk is closed. 38 size products, two scrunchie sets and the birthstone pendant no longer
  arrive in a cart carrying a value nobody picked.
- **A card with options costs one extra tap** — Add to cart, then Add to cart. That is the price
  of the property above, and it is paid by 59 of 449 products.
- `AddToCartModal` is a portal on `document.body`, which means a page with no `ToastProvider` or
  `CartProvider` above it cannot render one. Both shopper shells provide both; the admin shell
  provides neither and has no add buttons.
- **The reserved-height apparatus shrank from 76px to 16px** and the shop listing is denser for
  it, but it did not disappear. A future card element that appears on some products and not
  others makes the grid's rows disagree about their height unless it reserves a slot;
  `lib/product-card-alignment.test.tsx` asserts the structure and
  `scripts/measure-card-heights.mjs` is what measures the consequence.
- **The within-row alignment this card family has worried about since ADR-067 turns out to be
  the grid\'s property, not the card\'s.** That is worth knowing before the next reserved box is
  added on alignment grounds: `ProductGrid`\'s stretch and the action\'s `mt-auto` level a row
  whatever the cards in it contain.
- `fillHeight` still has one caller and is still opt-in, so ADR-025's rule that padding defines a
  button's height governs everywhere else.
- **`ProductOptionSelector` has two more props.** They are both about presentation and neither
  can change which control a group gets — that stays `option.type`, which is ADR-027's rule.
- The three-way `CardPurchaseMode` shape is gone from the type system, so any surface still
  branching on `choose-on-card` or `choose-on-page` fails to compile rather than falling through
  to a default.
