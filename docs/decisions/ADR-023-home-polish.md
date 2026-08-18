# ADR-023 — Home reads as an everyday brand: real imagery, honest positioning, buttons with room

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 22
**Builds on:** the home composition in [ADR-007](ADR-007-home-composition.md), the image
path convention in [ADR-006](ADR-006-product-image-convention.md), the honest-description
vocabulary in [ADR-018](ADR-018-honest-product-description.md), and the two-tier IA in
[ADR-020](ADR-020-two-tier-catalogue-ia.md)

## Context

[ADR-007](ADR-007-home-composition.md) built the home page to read finished *without* real
photography, and it did — but the compromises it made are only correct while the pictures
are missing. All eleven are now in place: `public/categories/{slug}.webp` for the ten
categories and `public/hero/home-hero.webp` for the hero. Every one of them is a light,
cream-ground studio shot, which is the fact most of this ADR turns on.

Four things did not survive contact with the real images and the real catalogue:

**The hero was a text block with a picture next to it.** A 4:3 panel in five of twelve
columns, dimmed under a `from-ivory/60` wash. That treatment existed to stop a wordless
placeholder from looking like an empty box. Applied to a photograph it does the opposite —
it hides the only thing that now makes the page look like a shop.

**The headline claimed the wrong category.** "THE EVERYDAY / *Heirloom*" and a lede reading
"Gold-plated, anti-tarnish and kind to skin". An heirloom is a thing you inherit, which is
the precious-metal frame [ADR-018](ADR-018-honest-product-description.md) spent a whole
prompt removing from the rest of the site; the hero kept it in the largest type on the site.
And "gold-plated" is true of most of the catalogue, not all of it — the range also runs
silver-plated, brass, CZ and glass, so as a blanket opening claim it is simply wrong.

**The hero counted the stock.** "49 pieces across 10 collections" was written when the
catalogue was 100 invented rows and the number sounded like range. At 49 real products it
sounds like a limitation, and it is a line that goes stale on every import.

**Two interactive surfaces were under-weight.** `Button` sat at `px-7 py-3.5`, which on
uppercase type tracked at `0.14em` reads as cramped rather than tight. The collection strip
from [ADR-020](ADR-020-two-tier-catalogue-ia.md) used a `border-line` outline on white — a
`#E8E4DC` hairline on `#FFFFFF`, about 1.2:1 — so the second tier of the whole IA was
effectively invisible.

## Decision

### The hero photograph is the section's ground, not a panel in it

The image is composed with its left third empty. The copy goes in that gap.

```tsx
<section className="relative isolate flex flex-col-reverse overflow-hidden bg-ivory lg:block">
  <div className="relative aspect-[16/10] w-full sm:aspect-[16/7] lg:absolute lg:inset-0 lg:aspect-auto">
```

One `<Image fill priority>`, declared once and repositioned by breakpoint rather than
rendered twice. Below `lg` the frame is an in-flow aspect-ratio box and `flex-col-reverse`
puts it under the copy; from `lg` up the same element goes `absolute inset-0` and becomes
the ground, with a left-to-right ivory scrim over it and the container's `lg:min-h-[36rem]`
setting the height. Because the frame is either a fixed aspect ratio or absolutely
positioned, it never contributes an unmeasured height — there is no layout shift at either
breakpoint.

**The scrim only exists at `lg`.** `hidden … lg:block`, `from-ivory via-ivory/85
to-transparent`. Below `lg` the copy is not over the image at all, so a wash there would
mute the photograph for no reason. This is the inverse of the old treatment, which washed
the image at every width to hide what was behind it.

The `object-position` differs by breakpoint too: `object-right` on the stacked frame keeps
the jewellery in shot when a landscape image is cropped to 16:10, `lg:object-center` shows
the full composition once the section is wide.

### The headline says what the brand actually sells

| | Before | After |
| --- | --- | --- |
| Headline | `THE EVERYDAY` / *Heirloom* | `EVERYDAY` / *Sparkle* |
| Lede | "Gold-plated, anti-tarnish and kind to skin — finished by hand in small batches, priced to be worn rather than locked away." | "Anti-tarnish jewellery made to wear every day, priced so you actually can." |
| Third line | "49 pieces across 10 collections" | *deleted* |

`EVERYDAY / Sparkle` keeps the two-tone lockup — roman uppercase in `ink`, italic in `gold` —
that `SectionHeading` uses across the site, so the hero still rhymes with every section
below it. It was chosen over `WEAR IT / Everyday` and `DAILY / Adornments` on the lockup:
the pattern wants a plain roman word and an evocative italic one, and "Adornments" is too
long to hold the display size at `sm` while "Wear It" puts the weak word in the gold slot.

The lede survives being read literally, which is the [ADR-018](ADR-018-honest-product-description.md)
test. It names one material property — anti-tarnish — that every piece in the catalogue
actually has, and makes one promise about price. It claims no metal.

**The count is gone and is not replaced.** A number that has to be re-justified after every
catalogue change is a line that will eventually be wrong.

### Buttons get room, and `sm` gets less of it than `md`

```
sm: px-4 py-2   →  px-5 py-3
md: px-7 py-3.5 →  px-10 py-4
```

Changed once in `lib/button-styles.ts`, which both `Button` and `ButtonLink` read, so every
button on the site moves together — hero CTAs, add-to-cart, checkout, the contact form.

The two sizes did not move by the same amount, deliberately. `md` gains 43% horizontally
because it is used where there is space. `sm` is used almost exclusively `fullWidth` inside
a product card, and on a 375px viewport a two-column grid leaves that button about 125px of
content width. At `px-6` the string "Add to cart" at `0.6875rem` tracked `0.14em` needs more
than the remaining 75px and wraps to two lines. `px-5` leaves it 83px and it does not. The
horizontal padding on a `fullWidth` button is cosmetic anyway — the width comes from the
parent — so `sm` takes its breathing room vertically, where `py-2 → py-3` is a 50% gain.

### The collection strip is filled, not outlined

```
border-line bg-white px-4 py-2
→ border-gold/45 bg-gold/10 px-6 py-3 shadow-card
```

A 10% `gold` tint on white lands near `#F9F5EC` — enough to separate the pill from the
section ground, nowhere near a coloured button. The border does the real work at `gold/45`.
Hover keeps the existing charcoal fill, which is where the contrast is: `text-ivory` on
`#1C1C1C` rather than ivory on gold, which would have been about 2.3:1 and unreadable at
12px.

`bg-gold` as a resting state was rejected for the same reason — a filled gold pill can only
carry dark text, and dark-on-gold at this size fights the charcoal primary button for
emphasis. The tint reads as "also clickable, secondary", which is what the second tier is.

### The category tile scrim is anchored to the label

```
inset-0 from-charcoal/75 via-charcoal/15 to-transparent
→ inset-x-0 bottom-0 h-1/2 from-charcoal/90 via-charcoal/55 to-transparent
```

The old gradient ran the full tile height, so its midpoint sat at 50% and the label at
`bottom-0` was reading against something much weaker than the 75% stop suggested. Confining
it to the bottom half puts the label inside the dense end. Against these images that matters
more than it did against the placeholders — the placeholders had a per-category tint, the
real photographs are all near-white cream, and ivory text on cream is nothing.

The tile keeps `alt=""`. The image is decorative *relative to the link*, whose text already
says "Rings"; giving it an alt would announce the category twice.

### Every em dash is out of what home renders

The em dash is a house tic, not a house style, and it reads as machine-written. Removed from
every string the home page puts on screen or in its `<head>`:

| Surface | Before | After |
| --- | --- | --- |
| Hero lede | "…kind to skin — finished by hand…" | rewritten whole (above) |
| `SITE_CONFIG.title` | `Morchadi Gems — Artificial Jewellery Online` | `Morchadi Gems · Artificial Jewellery Online` |
| `SITE_CONFIG.description` | "…from Morchadi Gems — hand-finished, quality-checked…" | "…from Morchadi Gems. Hand-finished, quality-checked…" |
| `SITE_CONFIG.ogImage.alt` | `Morchadi Gems — anti-tarnish…` | `Morchadi Gems: anti-tarnish…` |
| `Wordmark` accessible name | `Morchadi Gems — home` | `Morchadi Gems, home` |

The title takes `·` rather than a comma because that is already the separator in the layout's
`"%s · Morchadi Gems"` template — the default title now matches every other title on the
site instead of being the one that uses a different mark.

**What was deliberately left alone.** Hyphens inside compounds (`anti-tarnish`,
`gold-plated`, `hand-finished`, `7-day`) are not dashes and are untouched. The en dashes in
`CONTACT_CONFIG.hours` (`10:00 – 18:00`) and `LEGAL_CONFIG.refundProcessingWindow`
(`7–10 business days`) are numeric ranges, which is what an en dash is *for*, and neither
renders on home. JSDoc blocks keep theirs — they are source, not content. **The rest of the
site keeps its em dashes**; `/terms`, `/refund` and `/about` were not in this prompt's scope
and changing prose there without reading it is how a policy sentence quietly changes meaning.

### The hero placeholder loses a claim it should never have had

`scripts/generate-placeholders.mjs` drew a `FINE JEWELLERY` eyebrow on the hero placeholder.
[ADR-018](ADR-018-honest-product-description.md) established that "fine jewellery" is a term
of art for precious metal and genuine stones and removed it from `SITE_CONFIG` — but the
generator was not on that sweep's list, because the string is drawn into an image rather
than rendered as text. It survived a grep of the rendered output for a year of prompts.
The `<text>` element is gone; the hero placeholder is now genuinely wordless.

It is dormant either way — the generator only writes where no file exists and a real hero is
now committed — but a fallback that reintroduces a false claim the moment someone deletes a
file is a live defect, not a dead one.

## Consequences

- The home hero renders a real photograph at every breakpoint, and the copy sits in the
  space the photograph was composed to leave.
- One `<Image>` element serves both layouts, so the hero cannot drift between breakpoints
  and only one file is preloaded.
- Every button on the site is roomier, `md` more than `sm`, from one edit in
  `lib/button-styles.ts`. No call site changed.
- The collection strip is a visible second tier rather than a hairline.
- Home renders zero em dashes and no product count. Both are verified against the built HTML
  in `.next/server/app/index.html`, not against the source.
- `lib/wordmark.test.tsx` moves with the accessible name; no other test asserted any of the
  changed copy.
- The rest of the site still uses em dashes freely. If that becomes a site-wide rule it needs
  its own prompt and a read of every policy sentence it would touch.
