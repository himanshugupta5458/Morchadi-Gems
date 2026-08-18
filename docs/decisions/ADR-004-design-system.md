# ADR-004: Design system

- **Status:** Accepted
- **Date:** 2026-08-17
- **Prompt:** 3

## Context

Everything built after this prompt — the home page, category listings, the product page,
cart and checkout — is composed of the same handful of visual atoms. Deciding the palette,
the type pairing, and the component contracts once, before any page exists, is far cheaper
than reconciling four pages that each invented their own card.

The brief is a white-forward jewelry storefront with antique-gold and deep-maroon accents,
a bold serif heading treatment with a gold italic counterpart, and a clean geometric sans
for body and UI. The product is small, ornate, and warm-toned; the interface around it has
to be quiet enough to disappear behind the photography that will eventually land.

## Decision

### Palette

Eleven tokens, in `tailwind.config.ts`. No component writes a hex literal.

| Token | Hex | Role |
| --- | --- | --- |
| `white` | `#FFFFFF` | Page and card ground |
| `ivory` | `#FDFBF7` | Warm recessed ground — placeholders, primary button text |
| `charcoal` / `ink` | `#1C1C1C` | Body text, primary button fill |
| `gold` | `#C6A24C` | The accent — italic headings, rules, focus ring |
| `gold-deep` | `#A9863A` | Gold on white where `gold` lacks contrast — icons, eyebrows |
| `maroon` | `#4A1621` | Secondary accent — trust labels, hover fills |
| `honey` | `#CBA96C` | Tertiary warm tone |
| `amber` | `#F5A623` | Star fill only |
| `muted` | `#6B6B6B` | Secondary text, product names |
| `sale` | `#E23A2E` | Discounted price and chip only |
| `line` | `#E8E4DC` | Every hairline border, and empty star fill |

`charcoal` and `ink` are the same value under two names on purpose: `charcoal` names a
surface, `ink` names text. They are expected to diverge before they merge.

`sale` and `amber` are reserved. Red on this storefront always means a discounted price;
amber always means a rating star. Reusing either for general decoration would make both
meaningless, so neither appears anywhere else.

### Type

**Fraunces** for display, **Jost** for body and UI, both via `next/font/google`, exposed as
`--font-display` and `--font-sans`.

Fraunces over Playfair Display, which was the obvious alternative. Three reasons:

1. **The italic is the brand.** The two-tone lockup leans entirely on the italic word, so
   the italic is a primary weight here, not an afterthought. Fraunces' italic is a true
   cut with a distinctly different, softer character — it reads as a deliberate second
   voice next to the roman. Playfair's italic is a closer sibling of its roman, and the
   contrast the lockup depends on largely collapses.
2. **Optical sizing.** Fraunces is a variable font with an `opsz` axis, so the same family
   holds up at a 68px hero and a 12px trust label. Playfair is built for display sizes and
   gets brittle small — thin hairlines break up, and tight apertures fill in.
3. **Warmth over neoclassical.** Playfair's high-contrast Didone structure is cool and
   editorial. Fraunces has softer, slightly wonky terminals that sit better with warm gold
   and handcrafted jewelry, without tipping into ornament.

Jost over Futura and its clones: a geometric sans with real weight coverage, a permissive
licence, wide language support, and — being variable — no extra network cost for the
weights the UI actually uses. Its geometry is a clean foil to Fraunces' warmth.

Both load with `display: "swap"` and are self-hosted by `next/font`, so there is no
render-blocking request to Google and no layout-shift-on-swap penalty.

### The two-tone heading signature

Every section heading in the storefront is one lockup: an uppercase, letter-spaced roman
phrase followed by a single italic gold word, with a 64px gold rule beneath it.

```
NEW ARRIVALS Collection
─────
```

It is a component (`SectionHeading`), not a pattern to be re-typed. The roman word carries
the category or section; the italic gold word carries the flourish. That split is the
storefront's single most repeated visual idea, so it lives in exactly one file.

### Component inventory

Seven primitives, all pure and prop-driven, all Server Components except where noted.

| Component | Contract |
| --- | --- |
| `SectionHeading` | `roman`, `accent`, `subtitle?`, `align?`, `as?` — the two-tone lockup |
| `Button` | `variant` (`primary` \| `secondary`), `size`, `fullWidth`, plus native button props. **Client Component** |
| `StarRating` | `value` (0–5, halves supported), `count?`, `size?` |
| `ProductCard` | `product`, `onAddToCart?`, `priority?` |
| `TrustBadge` | `icon`, `label`, `detail?` |
| `TrustStrip` | No props — the fixed four-badge row |
| `icons.tsx` | Five stroked 24px SVG icons, sized and coloured by `className` |

`Button` is the only Client Component, because it is the only primitive that takes an event
handler. The boundary is pushed to the leaf: `ProductCard` stays a Server Component and
forwards `onAddToCart` down into `Button`, so a grid of cards rendered from a Server
Component ships no JavaScript for the cards themselves.

`ProductCard` uses a stretched link — the product link owns an `after:absolute after:inset-0`
overlay covering the card, and the Add-to-cart button sits above it on `z-10`. This gives a
fully clickable card without nesting a `<button>` inside an `<a>`, which is invalid HTML and
breaks keyboard navigation.

Presentation logic that is not pure markup lives in `lib/format.ts`
(`formatRupees`, `calculateDiscountPercent`, `hasVisibleDiscount`), per the `CLAUDE.md`
rule that components stay presentational.

### Placeholder imagery

`public/placeholder-product.png` is a generated 900×900 gold gem outline on ivory. Product
photography is an external blocker; until it lands, every product points at this file.

[ADR-002](ADR-002-product-data-model.md) records the placeholder path as
`/placeholder-product.jpg`. That file was never created, so every product card referenced a
404. The path is now `/placeholder-product.png` and the asset exists. This corrects a
dangling reference only — ADR-002's actual decisions (`images` stays `string[]`, a shared
placeholder stands in until real photography exists) are unchanged and not superseded.

`ProductCard` additionally renders a designed in-component placeholder when `images` is
empty, so the card degrades gracefully rather than rendering a broken image box.

## Alternatives considered

**Playfair Display for the serif.** Rejected — see the three reasons above. Its italic in
particular cannot carry the lockup.

**A single family across display and body.** Rejected. The roman/italic contrast that
defines the heading treatment needs a body face that is unmistakably not the display face,
or the italic stops reading as special.

**A CSS-variable design-token layer feeding Tailwind.** Rejected as premature. There is one
theme and no dark mode; Tailwind's config is already the single source of truth, and a
second indirection would buy nothing today.

**Shipping a component library (shadcn/ui, Radix, MUI).** Rejected. Seven presentational
primitives with no complex interaction do not justify the dependency, the bundle, or the
fight against opinionated defaults. This will be revisited if genuinely hard interactive
components — a combobox, a modal with focus trapping — become necessary.

**Making `ProductCard` a Client Component.** Rejected. It would push every card in every
grid into the client bundle for the sake of one button. Forwarding the handler to a client
leaf achieves the same behaviour at a fraction of the JavaScript.

## Consequences

Pages built after this prompt compose existing primitives rather than inventing markup, and
a palette or type change is a one-file edit.

The design system is verified through `/style-guide`, which renders every primitive against
real catalogue data. That route is internal QA: `noindex, nofollow`, not linked from any
navigation, and it must be updated whenever a primitive is added or its props change.

The primitives are deliberately unstyled beyond what the brief demands — no size variants
nobody uses, no theme props. Adding a variant when a page needs one is cheap; removing
speculative ones is not.

No dark mode. A white-forward jewelry storefront has no use for one, and the palette makes
assumptions (warm ivory grounds, hairline `line` borders) that a dark theme would need to
rethink from scratch rather than invert.

We would revisit this if the brand identity changed, if real photography demanded a
different card treatment, or if the storefront grew interactive components complex enough
to justify a headless library.
