# Design System

The working reference for tokens and UI primitives. Rationale lives in
[ADR-004](../decisions/ADR-004-design-system.md); pricing display rules in
[ADR-003](../decisions/ADR-003-discount-display-pricing.md).

Everything here is verifiable in the browser at [`/style-guide`](#style-guide).

## Colour

Defined in `tailwind.config.ts` under `theme.extend.colors`. **No component writes a hex
literal.** Available as `bg-*`, `text-*`, `border-*`, `fill-*`, `ring-*`.

| Token | Hex | Use it for | Do not use it for |
| --- | --- | --- | --- |
| `white` | `#FFFFFF` | Page ground, card ground, image area | — |
| `ivory` | `#FDFBF7` | Recessed warm ground, placeholder fill, text on `charcoal` | Page ground |
| `charcoal` | `#1C1C1C` | Primary button fill, sold-out badge | Body text (use `ink`) |
| `ink` | `#1C1C1C` | Body text, headings, undiscounted price | Fills (use `charcoal`) |
| `gold` | `#C6A24C` | Italic accent word, rules, focus ring | Small text on white |
| `gold-deep` | `#A9863A` | Icons and eyebrow text on white | Large fills |
| `maroon` | `#4A1621` | Trust labels, button hover fill | Body text |
| `honey` | `#CBA96C` | Tertiary warm accent | Text |
| `amber` | `#F5A623` | Star fill — **nothing else** | Any non-rating element |
| `muted` | `#6B6B6B` | Product names, secondary text, struck-through `mrp` | Anything load-bearing |
| `sale` | `#E23A2E` | Discounted price and `% off` chip — **nothing else** | Errors, warnings, decoration |
| `line` | `#E8E4DC` | Every hairline border, empty star fill | Text |
| `whatsapp` | `#25D366` | The floating WhatsApp button — **nothing else** | Any brand surface |

`whatsapp` is a vendor colour, not a brand colour. It exists so `WhatsAppButton` does not
write a hex literal; it is off-palette by design and must not spread.

`amber` and `sale` are reserved. On this storefront red always means a discounted price and
amber always means a rating star. Borrowing either for decoration makes both meaningless.

`charcoal` and `ink` currently share a value: `charcoal` names a surface, `ink` names text.
Use the one that matches intent — they are expected to diverge before they merge.

## Type

Two families, loaded by `next/font/google` in `app/layout.tsx` and exposed as CSS variables
on `<html>`.

| Family | Font | Variable | Tailwind |
| --- | --- | --- | --- |
| Display | Fraunces (variable, roman + italic) | `--font-display` | `font-display` |
| Body / UI | Jost (variable) | `--font-sans` | `font-sans` |

`app/globals.css` sets the base: `body` is `font-sans text-body text-ink` on white, and
`h1`–`h6` default to `font-display` at weight 600. A heading does not need `font-display`
spelled out unless it is on a non-heading element.

### Scale

| Token | Size | Tracking | Use |
| --- | --- | --- | --- |
| `text-display-lg` | 68px | −0.03em | Hero, one per page at most |
| `text-display` | 52px | −0.025em | Page titles |
| `text-heading-lg` | 40px | −0.02em | Section headings (desktop) |
| `text-heading` | 30px | −0.015em | Section headings (mobile), product title |
| `text-heading-sm` | 22px | −0.01em | Card and panel titles |
| `text-body-lg` | 17px | — | Lead paragraphs, price |
| `text-body` | 15px | — | Default body |
| `text-body-sm` | 13px | — | Secondary text, product names |
| `text-label` | 12px | 0.14em | Buttons, uppercase UI labels |
| `text-eyebrow` | 11px | 0.22em | Chips, badges, uppercase eyebrows |

Two extra tracking tokens exist for uppercase text on non-scale sizes: `tracking-caps`
(0.14em) and `tracking-caps-wide` (0.22em). Uppercase text is always tracked — untracked
caps read as cramped at every size.

### Layout tokens

- `container` — centred, max 1280px, padding 1.25rem → 1.5rem (sm) → 2.5rem (lg)
- `max-w-prose` — 68ch, for any block of running text
- `rounded-card` — 2px, the only radius in the system; jewelry retail reads sharper square
- `shadow-card` / `shadow-card-hover` — low and raised elevation. Nothing rests on
  `shadow-card-hover`; it is what a surface lifts *to* (hovered card, open nav panel,
  mobile drawer, WhatsApp button)
- `duration-250` — the standard transition

## Components

All live in `/components`, all named exports, all pure and prop-driven. Server Components
unless marked *Client Component* below.

### `SectionHeading`

The two-tone lockup — an uppercase roman phrase, an italic accent word, and a rule.
This is the storefront's signature; use it for every section heading rather than
hand-rolling an `<h2>`.

```tsx
<SectionHeading
  roman="New Arrivals"
  accent="Collection"
  subtitle="Freshly cut, freshly set, and ready to wear this season."
/>

<SectionHeading roman="Customer" accent="Speak" tone="honey" />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `roman` | `string` | — | Uppercased by CSS; pass it title-case |
| `accent` | `string` | — | Rendered italic. One or two words |
| `subtitle` | `string?` | — | Constrained to `max-w-prose` |
| `align` | `"left" \| "center"` | `"center"` | |
| `tone` | `"light" \| "honey"` | `"light"` | Pick by the ground it sits on — see below |
| `as` | `"h1" \| "h2" \| "h3"` | `"h2"` | Set this to keep heading order correct |

#### Tones

| Tone | Ground | Roman | Accent | Rule | Subtitle |
| --- | --- | --- | --- | --- | --- |
| `light` | `white`, `ivory` | `ink` | `gold` | `gold` | `muted` |
| `honey` | `honey`, other warm/dark bands | `ink` | `maroon` | `maroon` | `maroon/80` |

Gold on `honey` is gold on gold — the accent word disappears. On any warm or dark ground,
use `tone="honey"`: the accent moves to `maroon`, which holds against `honey` while keeping
the lockup's two-tone contrast. The roman word stays `ink` in both tones.

The rule is that the tone is chosen by the *background*, not by the section. Adding a third
ground means adding a third tone here rather than overriding colours at the call site.

### `Button` — *Client Component*

```tsx
<Button variant="primary" onClick={handleAddToCart}>Add to cart</Button>
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `"primary" \| "secondary"` | `"primary"` | Primary is charcoal fill; secondary is outlined |
| `size` | `"sm" \| "md"` | `"md"` | `sm` for in-card actions |
| `fullWidth` | `boolean` | `false` | |
| `disabled` | `boolean` | `false` | Renders in `line` / `muted`, not-allowed cursor |
| …rest | native `<button>` props | — | `className` is deliberately **not** accepted |

Both variants hover to `maroon`. `className` is excluded from the props so variants stay
the only way to change a button's appearance.

### `ButtonLink`

```tsx
<ButtonLink href="/shop">Shop Collection</ButtonLink>
<ButtonLink href="#shop-by-category" variant="secondary">Explore Categories</ButtonLink>
```

An `<a>` that looks exactly like a `Button`, for when the action is navigation. Takes
`href` plus the same `variant` / `size` / `fullWidth`. A Server Component — reach for this
first and use `Button` only when something genuinely fires on click.

Both components build their classes with `buttonClasses()` from `lib/button-styles.ts`, so
a variant cannot look one way as a button and another as a link. Change the appearance
there, never at a call site.

### `ViewAllLink`

```tsx
<ViewAllLink href="/shop?sort=newest" />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `href` | `string` | — | |
| `label` | `string` | `"View all"` | |

The shelf action that sits opposite a left-aligned `SectionHeading`. Arrow nudges right on
hover.

### `StarRating`

```tsx
<StarRating value={4.5} count={128} />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `number` | — | 0–5, clamped. Fractions render as partial fill |
| `count` | `number?` | — | Renders as `(128)` and enters the accessible label |
| `size` | `"sm" \| "md"` | `"sm"` | 12px / 16px |

Fill is a clipped overlay, not a glyph swap, so any fraction renders — not just halves.
The whole group is one `role="img"` with a text label; individual stars are `aria-hidden`.

### `PriceDisplay`

```tsx
<PriceDisplay mrp={product.mrp} price={product.price} />
<PriceDisplay mrp={product.mrp} price={product.price} size="lg" />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `mrp` | `number` | — | Compare-at only — never an amount |
| `price` | `number` | — | The charged amount |
| `size` | `"md" \| "lg"` | `"md"` | `md` on cards, `lg` on the product page |

**The only implementation of [ADR-003](../decisions/ADR-003-discount-display-pricing.md)'s
display rules.** `mrp > price` → struck `mrp` in muted, `price` in `sale`, a `% off` chip.
`mrp === price` → `price` alone in `ink`. Used by `ProductCard`, the product page, and
`/style-guide` — never hand-roll this markup again.

### `Monogram`

```tsx
<Monogram name="Ananya Iyer" accent="gold" />
```

An initials avatar (`getInitials`) in a `gold` or `charcoal` circle. Shared by
`TestimonialCard` and `ProductReviews`. Sharing the treatment does **not** merge the
concepts — store testimonials and per-product reviews stay separate types and components.

### `ProductImagePlaceholder`

Gem icon plus "Image coming soon" on `ivory`, at `sm` (card) or `lg` (product page). Stands
in for an **empty `images[]`**, which is a data error — a product with no photography yet
still has a generated placeholder file at its normal path ([ADR-006](../decisions/ADR-006-product-image-convention.md)).

### `ProductCard`

```tsx
<ProductCard product={product} />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `product` | `Product` | — | |
| `priority` | `boolean` | `false` | Pass `true` for above-the-fold cards only |

A Server Component with no handler props. It slots in `AddToCartButton`, which reaches the
cart itself — so a grid of cards stays server-rendered and ships one small island per card
([ADR-010](../decisions/ADR-010-cart-architecture.md)).

Behaviour:

- The whole card links to `/product/[id]` via a stretched link; Add-to-cart sits above it
- Image uses `next/image` with `fill` and `object-contain` on an `ivory` image area,
  resolving `/products/{id}.webp` — see [IMAGES.md](IMAGES.md)
- Empty `images[]` renders the in-component "Image coming soon" gem placeholder instead of a
  broken image. This is for a **data error**, not for a photo that has not arrived — a
  product with no photography yet still has a generated placeholder file at its normal path
- `mrp > price` → struck `mrp` in muted, `price` in `sale`, and a `% off` chip
- `mrp === price` → `price` alone in `ink`, no strikethrough, no chip
- `inStock: false` → "Sold out" badge and a disabled button
- `isNew: true` and in stock → "New" badge

Price display rules are fixed by [ADR-003](../decisions/ADR-003-discount-display-pricing.md).
`mrp` is display-only and must never reach an amount calculation.

**Frame and elevation.** The card has exactly one border: the outer `line` hairline. There
is no frame around the image area and no divider between the image and the body — a product
photo carries its own edge, and a second rule inside the first reads as a picture frame
rather than as product photography.

Every card is flat at rest — no resting shadow. Hover is the only elevation: a 4px lift
(`-translate-y-1`) plus `shadow-card-hover`, on a `duration-250` transition. This is
uniform across every card state, including sold-out. If a grid of cards shows two different
resting elevations, that is a bug.

### `ProductGrid`

```tsx
<ProductGrid products={newArrivals} />
<ProductGrid products={results} priorityCount={4} />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `products` | `Product[]` | — | Rendered as given — no filtering, no sorting |
| `priorityCount` | `number` | `0` | First N cards get `priority`; above-the-fold only |

2 columns on mobile, 3 from `md`, 4 from `lg`. **Page-agnostic by design** — it decides
nothing about which products it shows, so Home and the Shop page compose the same grid
rather than forking it ([ADR-007](../decisions/ADR-007-home-composition.md)). Any product
listing should go through this rather than hand-rolling a grid.

### `CategoryTile` / `CategoryGrid`

```tsx
<CategoryGrid />
<CategoryTile category={category} />
```

`CategoryGrid` takes no props and renders all eight `CATEGORIES` — 2 columns on mobile,
4 from `lg`. `CategoryTile` is a portrait 4:5 tile off `/categories/{slug}.webp` with a
bottom scrim for label legibility and a gentle zoom on hover; the whole tile links to
`/shop?category={slug}`.

Labels and slugs come from `CATEGORIES`, and the image path from
`buildCategoryImageSrc()` — never write either by hand.

### Product page components

Rationale in [ADR-009](../decisions/ADR-009-product-page.md).

| Component | Kind | Notes |
| --- | --- | --- |
| `Breadcrumb` | Server | `trail: { label, href? }[]`; the last step has no `href` and gets `aria-current="page"` |
| `ProductImagePanel` | Server | One square image, `object-contain` on `ivory`, or the placeholder |
| `ProductGallery` | *Client* | `ProductImagePanel` plus a thumbnail strip. **Only rendered when `images.length > 1`** |
| `QuantityStepper` | *Client* | Controlled. `value` / `onChange` / `disabled` / `accessibleLabel` |
| `ProductPurchasePanel` | *Client* | Owns quantity **and option** state; takes a `CatalogueEntry` and required `onAddToCart` / `onBuyNow` |
| `ProductPurchaseActions` | *Client* | Wraps the panel and supplies both handlers from `useCart()` |
| `ProductOptionSelector` | *Client* | One option group. Chips up to six values, a select beyond |
| `SelectedOptionsSummary` | Server | `Letter: A · Colour: Silver`; renders nothing when there is no selection |
| `PersonalizedNote` | Server | &ldquo;Personalized · non-returnable&rdquo;, long form with a `/refund` link |
| `ProductDetailsList` | Server | Definition list; renders only the `details` keys present |
| `ProductReviews` | Server | Aggregate plus the per-product review list |

**The gallery is deliberately dormant.** Every catalogued product has exactly one image, so
the product page renders `ProductImagePanel` directly and ships no client JS for it. With
one image there is **no thumbnail row** — a one-thumbnail strip is decoration pretending to
be a control. `/style-guide` renders the gallery against a synthetic two-image product so
the branch is not shipped unseen.

**`QuantityStepper` never produces an invalid value.** Buttons, typing, and paste all route
through `clampQuantity` in `lib/quantity.ts` (1–10, integer), which is unit-tested. Nothing
downstream needs to re-validate a quantity.

**`accessibleLabel` exists for `/cart`.** With one stepper on the page the visible
&ldquo;Quantity&rdquo; text is its label. With one per cart line that label is ambiguous, so the
cart passes the product name and the control names itself &mdash; &ldquo;Increase quantity, Kundan
Rani Haar&rdquo;. Ids are generated with `useId`, so several steppers never collide.

**`ProductPurchasePanel` is presentational and never imports the cart.** It takes a
`CatalogueEntry` and two required handlers; `ProductPurchaseActions` is the client wrapper that
supplies them. Add to cart adds and toasts; Buy now adds and then navigates to `/address`, so
the item is still in the cart if the shopper backs out.

#### `ProductOptionSelector`

```tsx
<ProductOptionSelector option={option} value={value} onChange={choose} />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `option` | `ProductOption` | — | One group: `{ name, values }` |
| `value` | `string` | — | Always set — there is no empty state |
| `disabled` | `boolean` | `false` | Sold-out products still render their selectors, inert |
| `onChange` | `(value: string) => void` | — | |

**The layout is chosen by list length, not by group name.** Six values or fewer render as
chips; anything longer becomes a native select. Twenty-five engraving letters as chips are a
wall to scan, and four locket shapes in a dropdown hide the choice behind a click.

**Chips are radio inputs, not buttons.** A visually-hidden `<input type="radio">` per value
with a styled `<label>` gets arrow-key navigation, the checked state, the group's accessible
name from the `<legend>`, and focus rings via `peer-focus-visible` — none of which a row of
`<button>`s gets without re-implementing all of it. The select branch is a plain labelled
`<select>` reusing `fieldControlClasses`, so it matches the address form's controls.

**There is no &ldquo;please choose&rdquo; state.** `ProductPurchasePanel` seeds the selection
with each group's first value, so a personalized piece is addable without touching a selector.
The current selection is echoed under the selectors as &ldquo;Your choice — Letter: A&rdquo;,
because a default the shopper never picked still has to be one they can see. See
[ADR-019](../decisions/ADR-019-product-options.md).

#### `PersonalizedNote` and `SelectedOptionsSummary`

```tsx
<PersonalizedNote withExplanation />       product page — the sentence and the /refund link
<PersonalizedNote />                       cart line — the label alone
<SelectedOptionsSummary selectedOptions={line.selectedOptions} />
```

`PersonalizedNote` is `/refund`'s made-to-order carve-out said at the moment it applies rather
than only on the policy page. `withExplanation` is off on a cart line because four stacked
copies of one sentence is noise; the label still carries the meaning.

`SelectedOptionsSummary` returns `null` when there is no selection, so a caller never has to
guard it — the cart line, the checkout summary and the confirmation receipt all render it
unconditionally and only the personalized lines show anything.

### Cart components

Rationale in [ADR-010](../decisions/ADR-010-cart-architecture.md).

| Component | Kind | Notes |
| --- | --- | --- |
| `AddToCartButton` | *Client* | The island a Server Component slots into a card |
| `ProductPurchaseActions` | *Client* | Wraps `ProductPurchasePanel` with cart handlers |
| `CartView` | *Client* | The whole of `/cart` below the heading; picks loading / empty / populated |
| `CartLineItem` | *Client* | One line: thumbnail, name, chosen options, unit `PriceDisplay`, stepper, line total, remove |
| `CartSummary` | *Client* | Subtotal, shipping, total, and the two CTAs. Sticky from `lg` |
| `CartEmptyState` | Server | Gem icon, rule, and a Continue shopping CTA |
| `ToastViewport` | *Client* | The always-mounted `role="status"` live region |

#### `AddToCartButton`

```tsx
<AddToCartButton item={toCatalogueEntry(product)} fullWidth />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `item` | `CatalogueEntry` | — | **Not** a `Product` — see below |
| `variant` | `"primary" \| "secondary"` | `"secondary"` | |
| `size` | `"sm" \| "md"` | `"sm"` | |
| `fullWidth` | `boolean` | `false` | |

Adds one unit and raises the toast. Disabled and relabelled &ldquo;Sold out&rdquo; when
`inStock` is false; `addProductToCart` refuses an out-of-stock entry as well, so the disabled
attribute is the courtesy and the pure function is the rule.

**It takes a `CatalogueEntry`, never a `Product`.** Props crossing into a Client Component are
serialised into the page, so handing a card the full record would ship its description, details
and reviews to the browser. `toCatalogueEntry(product)` narrows it to six fields — seven for
the four products that carry `options`, which the client cart needs in order to re-validate a
stored choice and fill in defaults.

**A card's Add to cart works on a personalized product without a selector.** It passes no
selection, and `addProductToCart` resolves that to each group's defaults, so the four optioned
products behave on a shop card exactly as the other ninety-six do.

#### Cart lines are keyed by choice, not by product

`/cart` addresses every edit by `CartLine.key` — `lineKey(productId, selectedOptions)` — so one
product can hold several lines, one per recorded choice, and the stepper and the remove button
act on the line the shopper is looking at. Their accessible names carry the choice too
(&ldquo;Increase quantity, Wave Band Initial Ring, Letter: B&rdquo;), because two lines of one
product would otherwise be two identically-named controls. For the ninety-six products without
options the key *is* the product id and nothing about the line changed. See
[ADR-019](../decisions/ADR-019-product-options.md).

#### `OrderTotals`

```tsx
<OrderTotals subtotal={2000} shipping={0} total={2000} />     free — subtotal ≥ ₹799
<OrderTotals subtotal={500} shipping={99} total={599} />      charged — subtotal < ₹799
```

Subtotal, shipping and total, rendered identically wherever an order is summarised — `/cart`
and every checkout step compose it rather than formatting their own rows, so the two cannot
disagree about the one number that matters. No tax line, no coupon row.

The shipping row reads `FREE_SHIPPING_THRESHOLD` from `lib/config.ts` for its label and
takes its value from the caller:

| Condition | Value shown |
| --- | --- |
| `shipping > 0` | the amount, e.g. `₹99` |
| `shipping === 0` and `subtotal > 0` | `FREE` |
| nothing payable | `—` |

`FREE` and `—` are deliberately different: an empty cart has not earned free shipping, it
has nothing to ship, and showing `FREE` there would read as a promise. Below the threshold
a `gold-deep` hint line reads &ldquo;Add ₹X for free shipping&rdquo;, computed by
`amountToFreeShipping` — display only, never part of a total. See
[ADR-015](../decisions/ADR-015-business-config-and-shipping-threshold.md).

#### `CartSummary`

```tsx
<CartSummary subtotal={4200} shipping={0} total={4200} isCheckoutBlocked={false} />
```

`OrderTotals` plus the two CTAs. When `isCheckoutBlocked`, the primary CTA renders as a
disabled `Button` rather than a `ButtonLink`, because a link cannot be disabled.

#### Toasts

```tsx
const { showToast } = useToast();
showToast("Added to cart");
```

`ToastProvider` is mounted in `app/layout.tsx` and holds **one** toast at a time &mdash; a new
message replaces the current one and restarts its `TOAST_DURATION_MS` timer, so tapping Add to
cart on four cards does not produce a queue draining one notice after another. The pill sits
bottom-left (`bottom-4 left-4`, `sm:bottom-6 sm:left-6`) to stay clear of the WhatsApp button on
the right. The live region is always mounted so a screen reader announces the message rather than
the arrival of the region.

**Design tokens added:** the `toast-in` keyframe and animation (250ms fade and 0.5rem rise),
disabled under `prefers-reduced-motion`, and `CheckIcon` in `icons.tsx`.

### Form fields

Rationale in [ADR-011](../decisions/ADR-011-checkout-address-step.md).

| Component | Kind | Notes |
| --- | --- | --- |
| `FormField` | Server | The shell: label, control slot, error line. Exports `fieldErrorId` and the shared control classes |
| `TextField` | *Client* | Controlled `<input>`; composes `FormField` |
| `SelectField` | *Client* | Controlled `<select>` with a caret; composes `FormField` |
| `TextAreaField` | *Client* | Controlled `<textarea>`, `rows` and vertical resize; composes `FormField` |
| `FormFieldPreview` | *Client* | `/style-guide` host for the controlled fields |

```tsx
<TextField
  id="address-phone"
  label="Mobile number"
  value={phone}
  type="tel"
  inputMode="tel"
  autoComplete="tel-national"
  maxLength={10}
  error={errors.phone}
  onChange={(value) => handleChange("phone", value)}
  onBlur={() => handleBlur("phone")}
/>

<SelectField
  id="address-state"
  label="State"
  value={state}
  options={INDIAN_STATES}
  placeholder="Select a state"
  error={errors.state}
  onChange={setState}
  onBlur={handleBlur}
/>
```

**Never hand-roll a label and an error line.** The aria wiring is the part that is easy to get
subtly wrong once per field, so it lives in one place: an `error` sets `aria-invalid`, points
`aria-describedby` at `${id}-error`, and moves the border from `line` to `sale`. Passing no
`error` clears all three. `isOptional` appends a lowercase &ldquo;optional&rdquo; to the label
&mdash; the only field marking in the system, because marking the required majority is noise.

`SelectField`'s `options` is a `readonly string[]`, fed by the typed constant it belongs to
(`INDIAN_STATES`). The placeholder is always the `""` option, so &ldquo;not chosen&rdquo; is
representable and the validator can reject it.

**Validator copy stays neutral.** `validateName` and `validateEmail` are shared by the
checkout and the contact form, so their messages say &ldquo;Enter a name&rdquo; rather than
&ldquo;Enter the full name for delivery&rdquo;. The field&apos;s label supplies the context;
copy that restates *why* a value is wanted breaks the moment the rule is reused
([ADR-012](../decisions/ADR-012-static-and-policy-pages.md)).

### Long-form content

Rationale in [ADR-012](../decisions/ADR-012-static-and-policy-pages.md).

| Component | Kind | Notes |
| --- | --- | --- |
| `Prose` | Server | Long-form typography; styles descendants by element |
| `PolicyPage` | Server | The shell all four policy pages use |
| `PolicyDisclaimer` | Server | The sample-template notice |
| `TextAreaField` | *Client* | Multi-line sibling of `TextField`, same `FormField` shell |
| `ContactDetails` | Server | Email, phone, a `wa.me` WhatsApp link and the registered address, all from `CONTACT_CONFIG` / `config/business.ts` |
| `ContactForm` | *Client* | The only client island on the six content pages |

#### `Prose`

```tsx
<Prose>
  <h2>A heading</h2>
  <p>Body copy, with an <a href="/shop">inline link</a>.</p>
  <ul><li>A list item</li></ul>
</Prose>
```

Takes no props but `children`. It styles `h2`, `h3`, `p`, `ul`, `ol`, `li`, `a`, `strong` and
`code` with arbitrary-variant selectors, so a page written as prose uses plain semantic HTML
and still lands on the type scale, the gold list marker and the gold-underlined link. The
measure is capped at `max-w-prose` (68ch).

**No `@tailwindcss/typography`.** The plugin ships an opinionated stylesheet that would have
to be overridden back to our tokens; this is about twenty declarations using the tokens
directly.

#### `PolicyPage`

```tsx
<PolicyPage roman="Privacy" accent="Policy" summary="…" currentHref="/privacy">
  <h2>1. The short version</h2>
  <p>…</p>
</PolicyPage>
```

Owns the breadcrumb, two-tone heading, the `Last updated` line (from
`LEGAL_CONFIG.policyLastUpdatedIso`, rendered through `formatPolicyDate` in a `<time>`), the
`PolicyDisclaimer`, the `Prose` wrapper, and the cross-links to sibling policies. A policy
page therefore contains **only its own words**.

Cross-links come from `POLICY_LINKS` filtered by `currentHref`, so adding a fifth policy is
one array entry in `lib/navigation.ts` and it appears in the footer and on every existing
policy page.

**The disclaimer is a component, not copy.** It cannot be removed from one page and left on
the others. Taking it off is a decision for whoever commissions the legal review.

### Checkout components

| Component | Kind | Notes |
| --- | --- | --- |
| `CheckoutSteps` | Server | Address / Payment / Confirmation. `current: 1 \| 2 \| 3` |
| `AddressCheckout` | *Client* | `/address` below the heading: waits, guards, then form + summary |
| `AddressForm` | *Client* | Owns form values and errors; calls back with a validated `Address` |
| `CheckoutSummary` | *Client* | Read-only line list plus `OrderTotals`, with an Edit cart link |
| `CheckoutGuardNotice` | Server | Shown when a checkout step is reached with nothing payable |
| `PanelNotice` | Server | One-line bordered panel for a loading or waiting state |

**`CheckoutSteps` is presentational, not a control.** No step is clickable — a progress
indicator that navigates invites skipping a step. The current step carries `aria-current`;
earlier steps read as complete.

**`CheckoutGuardNotice` explains rather than redirects.** A redirect fired from an effect races
the cart's own hydration and can bounce a shopper who has a full cart, and a checkout that
relocates you unannounced reads as a fault. It offers Back to cart and Continue shopping.

**`CheckoutSummary` is the read-only twin of `CartSummary`.** It lists what is being bought
with a quantity pip on each thumbnail, but offers no stepper and no remove — quantity edits
belong on `/cart`, which the Edit cart link goes to.

**`PanelNotice` is shared by `/cart` and `/address`** so the two waiting states are the same
size and the page does not visibly collapse when one replaces real content.

### `Pagination`

```tsx
<Pagination page={3} totalPages={9} hrefForPage={(page) => buildShopHref(withPage(query, page))} />
```

| Prop | Type | Notes |
| --- | --- | --- |
| `page` | `number` | Current page, 1-based |
| `totalPages` | `number` | |
| `hrefForPage` | `(page: number) => string` | Caller owns URL shape |

Renders `1 … 4 [5] 6 … 9` as plain links via `buildPaginationRange()`. Returns `null` at one
page or fewer. Prev/Next are **omitted** at the ends rather than rendered disabled. The
component knows nothing about the shop — pass it a href builder and it works anywhere.

### Shop controls

All three read the current `ShopQuery` as a prop and derive their state from it — there is no
local filter state anywhere ([ADR-008](../decisions/ADR-008-shop-architecture.md)).

| Component | Kind | Notes |
| --- | --- | --- |
| `ShopFilterPanel` | *Client* | Category and price checkboxes; pushes a new URL on change |
| `ShopFilterDrawer` | *Client* | Below `lg`: trigger with active-filter count, slide-over holding the panel. Focus trap, scroll lock, Escape to close |
| `ShopSortSelect` | *Client* | Native `<select>` over `SORT_OPTIONS` |
| `ShopActiveFilters` | Server | Removable chips plus "Clear all" |

**These import from `@/lib/shop-query`, never `@/lib/shop`.** The latter pulls in
`data/products.json`, which would ship the whole catalogue to the browser.

### `Hero`

```tsx
<Hero categoryAnchorId="shop-by-category" />
```

The home hero: eyebrow, two-tone display headline, gold rule, positioning line, primary and
secondary CTAs, and a catalogue count, beside a 4:3 image panel off `/hero/home-hero.webp`.

It is **typographic first** — the composition reads as finished with the image removed. That
is deliberate and load-bearing, not a stylistic preference; see
[ADR-007](../decisions/ADR-007-home-composition.md). Do not rebalance it toward the image
while the image is still a placeholder.

`categoryAnchorId` is passed in rather than hard-coded so the hero does not have to know
what the page below it is called.

### `TrustBadge` / `TrustStrip`

```tsx
<TrustStrip />
<TrustBadge icon={<ShieldCheckIcon className="h-7 w-7" />} label="Secure Payments" />
```

`TrustBadge` takes `icon`, `label`, and an optional `detail`, and is the primitive a page
maps its own list over — `/about` renders six of them in a 2/3-column grid for "Why Choose
Morchadi". `TrustStrip` takes no props and renders the fixed four — Secure Payments, Free Shipping Over ₹799, Easy 7-Day Returns,
Anti-Tarnish Quality — 2-up on mobile, 4-up from `lg`. The threshold and the returns window are
`FREE_SHIPPING_THRESHOLD` and `RETURN_WINDOW_DAYS` from `lib/config.ts`, the same constants
the cart charges from and the policies quote, so the badge cannot outlive the rule.

The fourth badge used to read "Certified Quality". It does not any more: nothing here is
certified, and a badge that says so is a false claim rather than a design choice
([ADR-018](../decisions/ADR-018-honest-product-description.md)). Copy that describes the
catalogue belongs to the same rule as copy that quotes a number — say what is true, and say it
once. `PRODUCT_DESCRIPTOR` in `lib/config.ts` is the single definition of how the catalogue is
described in metadata, read by `SITE_CONFIG.description` and by the shop's `generateMetadata`.

### `TestimonialCard`

```tsx
<TestimonialCard testimonial={testimonial} accent="gold" />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `testimonial` | `Testimonial` | — | `{ name, rating, text }` |
| `accent` | `"gold" \| "charcoal"` | `"gold"` | Monogram circle fill |

A white card with a `StarRating`, the quote, and a `figcaption` carrying a monogram avatar
built from the initials (`getInitials`) — never a photo. Callers alternate `accent` by index
so a row does not read as a single block of gold.

Stars stay `amber`, matching `ProductCard`. `amber` is the reserved rating colour; a
gold-starred testimonial next to an amber-starred product card would make two ratings on the
same page look like two different scales.

These are **store-level** testimonials, a different thing from the per-product
`Product.reviews` that render on a product page.

### Global chrome

Rendered once by `app/layout.tsx`, so every route inherits it. Rationale in
[ADR-005](../decisions/ADR-005-navigation-and-chrome.md).

```
<AnnouncementBar />   charcoal strip, above the header, scrolls away
<Header />            sticky; wordmark + cart, then the category bar
<main>{children}</main>
<Footer />            charcoal, four columns + copyright row
<WhatsAppButton />    fixed bottom-right
```

A page never renders its own `<main>` — the layout owns it.

#### `AnnouncementBar` — *Client Component*

Charcoal strip, 36px, centred `text-eyebrow`. Three messages cross-fade every 4s — the
shipping and returns lines are built from `FREE_SHIPPING_THRESHOLD` and
`RETURN_WINDOW_DAYS` rather than written out. All three stay in the DOM so screen readers read them once rather than being interrupted
on a timer; the fade is dropped under `prefers-reduced-motion`. No props, non-dismissible,
no stored state.

#### `Header`

Server Component composing three clients. Top row: `MobileNav` (hamburger, below `lg`),
`Wordmark`, and `CartLink`. Second row: `CategoryNavBar`, hidden below `lg`.
`sticky top-0 z-40`.

#### `Wordmark`

The brand lockup as a link to `/` — `Morchadi` roman, `Gems` gold italic, matching
`SectionHeading`. `tone` is `"ink"` (default) or `"ivory"` for the footer; the gold italic is
constant. `onNavigate` lets the mobile drawer close itself on click.

#### `CartLink` — *Client Component*

Cart icon linking to `/cart`, with a `maroon` count badge that is **hidden at 0**. The count
is `itemCount` from `useCart()`. `withLabel` adds the "Cart" text for the mobile drawer.

The badge is absent from the prerendered HTML and from the first client render, and appears
only after the persisted cart has been read — so a returning visitor never gets a hydration
mismatch on a component that sits on every page. There is nothing to hide at 0, so nothing
flashes. See [ADR-010](../decisions/ADR-010-cart-architecture.md); the empty-first render is
covered by a test that fails if it is ever changed to read `localStorage` eagerly.

#### `CategoryNavBar` — *Client Component*

Charcoal bar, `lg` and up. The eight categories from `NAV_CATEGORIES`, uppercase
`text-eyebrow` with a caret that rotates 180° when open. One panel open at a time.

Each trigger is a real `<button>` carrying `aria-expanded` and `aria-controls`. Opens on
hover, on click, and on `ArrowDown`; closes on `Escape` (returning focus to its trigger), on
mouse-leave, and when focus leaves the item. The panel is not rendered while closed, so
nothing hidden is ever in the tab order. Focus rings switch to `ring-offset-charcoal` so the
gold ring reads against the dark bar.

#### `MobileNav` — *Client Component*

Below `lg`. Hamburger opens a left drawer holding the wordmark, a labelled cart link, and an
accordion of the eight categories, each expanding to the same four quick filters. No hover
behaviour on this path.

`role="dialog" aria-modal="true"`, focus moves to the close button on open and back to the
hamburger on close, Tab cycles within the panel, `Escape` closes, and body scroll is locked
while open. Every link closes the drawer on click.

#### `Footer`

Charcoal, `ivory` text. Six columns at `lg` — brand (spanning two: blurb, registered
address, support email, phone), Shop (the eight categories), Company (About / Contact /
Terms), Policies, Secure Payments (Cashfree) — over a copyright row. The address and contact
links come from `CONTACT_CONFIG`, which reads `config/business.ts`, so they match the contact
page and the policies by construction. The year is build-time, since every route is
prerendered.

#### `WhatsAppButton`

`fixed bottom-4 right-4` (`bottom-6 right-6` from `sm`), `z-30` — under the header and the
drawer, over page content. A `whatsapp`-green pill with the glyph plus a "Chat with us"
label that collapses to an icon-only circle below `sm`, so it does not sit on top of mobile
content. A plain `<a>` to `wa.me` built by `buildWhatsAppLink()`; no widget, no script.

### `TestimonialBand` / `TestimonialCarousel`

`TestimonialBand` is the section: `honey` ground, a `tone="honey"` `SectionHeading` and the
carousel. It reads `getTestimonials()` and passes the data down, so the JSON import stays
server-side.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `roman` | `string` | `"Customer"` | Heading, roman half |
| `accent` | `string` | `"Speak"` | Heading, italic half |
| `subtitle` | `string` | `"What people tell us after the box arrives."` | |

The home page takes the defaults; `/about` runs the same band as "Customer / Love"
([ADR-017](../decisions/ADR-017-final-content-pass.md)). The data source is deliberately not
a prop — the JSON import belongs inside the band.

`TestimonialCarousel` is the Client Component. One DOM, two layouts: a snap-scrolling
carousel with dot pagination below `lg`, a 3-column grid from `lg` where the dots are hidden.
Scroll position is the single source of truth for the active dot — dots and auto-advance both
scroll the track rather than setting an index, so the two can never disagree. Auto-advance
runs at 6s, only below `lg`, and is skipped entirely on hover, on focus within the band, and
under `prefers-reduced-motion`.

### `icons.tsx`

`GemOutlineIcon`, `ShieldCheckIcon`, `TruckIcon`, `ReturnArrowIcon`, `CertificateIcon`,
`CartIcon`, `ArrowRightIcon`, `CaretDownIcon`, `CheckIcon`, `FilterIcon`, `MinusIcon`,
`PlusIcon`, `MenuIcon`, `CloseIcon`, `WhatsAppIcon`. `CaretDownIcon` doubles as the
`SelectField` chevron, which is why that `<select>` is `appearance-none`.
All 24px on `currentColor`; size and colour them with `className`. Every one is a stroked
outline except `WhatsAppIcon`, which is the vendor's filled glyph and is not ours to restyle.

## Formatting helpers

In `lib/format.ts` — components stay presentational, so this logic does not live in JSX.

| Function | Returns | Notes |
| --- | --- | --- |
| `formatRupees(amount)` | `"₹18,500"` | `en-IN`, no decimals |
| `calculateDiscountPercent(mrp, price)` | `number` | `0` when there is no discount |
| `hasVisibleDiscount(mrp, price)` | `boolean` | Branch on this, not on `mrp > price` |
| `getInitials(fullName)` | `"AI"` | First letter of the first two words; monogram avatars |
| `formatMilestone(count)` | `"10,000+"` | `en-IN`, no decimals; about-page stat band and journey |
| `clampQuantity(value)` | `1`–`10` | In `lib/quantity.ts`. The only definition of a valid quantity |

None of these convert `mrp` into an amount, and none should be made to.

## Navigation model

`lib/navigation.ts` is the single source for what the chrome links to. `NAV_CATEGORIES`
derives from `CATEGORIES` in `types/product.ts`, so the desktop nav, the mobile accordion,
and the footer's Shop column cannot drift from each other or from the catalogue.

| Export | Notes |
| --- | --- |
| `NAV_CATEGORIES` | The eight categories, each with its four `quickFilters` |
| `buildCategoryQuickFilters(category)` | "All {Category}" plus the three price bands |
| `buildCategoryHref(slug)` | `/shop?category={slug}` |
| `buildCategoryImageSrc(slug)` | `/categories/{slug}.webp` |
| `COMPANY_LINKS` | About, Contact, Terms & Conditions |

The categories are flat — there are no sub-categories — so the mega-nav panels offer price
bands (`under-999`, `1000-4999`, `5000-plus`) rather than an invented taxonomy. Those band
keys are a public URL surface that `/shop` must honour; see
[ADR-005](../decisions/ADR-005-navigation-and-chrome.md) before changing them.

`lib/config.ts` holds `SITE_CONFIG` — brand name, SEO strings, WhatsApp number, greeting —
and `buildWhatsAppLink()`. The number there is a placeholder pending the real business
number.

## Shop query vocabulary

`lib/shop-query.ts` owns the `/shop` URL surface: `PRICE_BANDS`, `SORT_OPTIONS`,
`DEFAULT_SORT`, `PER_PAGE`, `parseShopQuery`, `buildShopHref`, the query mutators, and
`buildPaginationRange`. It imports **no product data**, which is what lets Client Components
use it without shipping the catalogue.

`lib/shop.ts` adds `getShopResults` — the pure filter/sort/paginate core, covered by 53 unit
tests — and re-exports all of the above. Server code imports `@/lib/shop`; client code
imports `@/lib/shop-query`.

Never hardcode a band label, a sort slug, or a page size in a component. The band keys and
sort slugs are public URL surface — see
[ADR-008](../decisions/ADR-008-shop-architecture.md) before changing one.

## Style guide

`/style-guide` renders every token and primitive against real catalogue data — including
the discounted, full-price, empty-image, and sold-out card states, both `SectionHeading`
tones on their actual grounds, the testimonial cards on `honey`, and the cart pieces that
would otherwise only be visible with something in a cart: `AddToCartButton` in both states,
`CartSummary` populated and blocked, `CartEmptyState`, the form fields in default, optional and
errored states, all three `CheckoutSteps` positions, `CheckoutGuardNotice`, the `Prose` element set,
`PolicyDisclaimer`, `TextAreaField` in its errored state, and both `ProductOptionSelector`
layouts with the `PersonalizedNote` in both of its forms. The global chrome wraps
it like any other route, so the header, footer, announcement bar, and WhatsApp button are
checked in place rather than mocked in a panel.

It is **internal QA**: `noindex, nofollow`, and not linked from any navigation. It exists so
the foundation can be checked without a page built on top of it.

**Adding or changing a primitive means updating `/style-guide` in the same change.** A
style guide that has drifted from the components is worse than none.
