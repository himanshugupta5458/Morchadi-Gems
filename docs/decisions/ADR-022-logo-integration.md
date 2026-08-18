# ADR-022 — The real logo replaces the text wordmark, except where it cannot be read

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 21
**Builds on:** the design system in [ADR-004](ADR-004-design-system.md), the chrome in
[ADR-005](ADR-005-navigation-and-chrome.md), the image path convention in
[ADR-006](ADR-006-product-image-convention.md), and the metadata discipline in
[ADR-007](ADR-007-home-composition.md)

## Context

The site has been shipping a stand-in: `Morchadi` in uppercase display type beside `Gems`
in gold italic, assembled in the `Wordmark` component. It was never the brand mark — it was
what existed while there was no artwork.

The artwork now exists. `public/logo.png` is 642 × 388 with a transparent ground: a peacock
feather in teal and gold arcing over `Morchadi` in a dark green script, with `GEMS` in gold
capitals beneath.

One thing about it decides most of this ADR. The script is dark — the `Morchadi` glyphs
average `rgb(37, 65, 58)`. Measured against the two grounds the mark has to sit on:

| Surface | Colour | Contrast with the `Morchadi` script |
| --- | --- | --- |
| Header, mobile drawer | white / `ivory` `#FDFBF7` | **10.72 : 1** |
| Footer | `charcoal` `#1C1C1C` | **1.65 : 1** |

WCAG asks 3:1 of a graphic that has to be made out. On charcoal the brand name is not dim,
it is gone; only the feather's lighter plumes and the gold `GEMS` survive, at 3.79:1 and
5.45:1. A logo whose most important element is invisible is worse than no logo.

## Decision

**`Wordmark` renders the logo image by default, and keeps the type lockup as a `text`
variant for dark grounds.**

```tsx
<Wordmark priority />                      // header — the logo
<Wordmark onNavigate={dismiss} />          // mobile drawer — the logo
<Wordmark variant="text" tone="ivory" />   // footer — the type lockup
```

One component, two renderings, so every call site keeps working and the footer's need does
not become a second component to keep in step. `tone` applies only to the text variant; the
image carries its own colour.

### The footer keeps the type

The alternative was the logo on a light panel inset into the charcoal footer. Rejected: it
puts the single brightest element on the page in the footer's top-left corner, where it
pulls the eye past everything above it, and the artwork's transparent margin means the panel
has to be larger than the mark to look deliberate. The type lockup is already tuned for this
ground — ivory roman beside gold italic, the same two-tone treatment `SectionHeading` uses
across the site — and reads at full strength. The header shows the real mark on every route
above the fold; brand recognition does not depend on the footer.

This is the kind of decision that gets quietly undone by someone tidying up, so
`lib/wordmark.test.tsx` asserts the text variant renders no image at all.

### Header sizing: 36px, 48px from `lg`

The header row is a fixed `h-16` / `lg:h-20` — 64px and 80px. A 36px and 48px logo sits
inside that with room to spare, so **the logo cannot be what makes the header taller**, and
`items-center` on the row centres it.

48px is the top of the target range on purpose. The artwork carries about 12% transparent
margin above and below (294px of ink inside 388px), so a 48px box renders a 36px mark — a
44px box would have rendered 33px and read as timid beside the cart link.

**No layout shift.** The import is a static one (`import logo from "@/public/logo.png"`), so
next/image emits `width="642" height="388"`; the browser derives the aspect ratio from those
and resolves the box from `h-9` / `lg:h-12` plus `w-auto` before a single byte of the bitmap
arrives. `priority` on the header instance preloads it. Constraining *both* dimensions in
CSS — a fixed height and an explicit `w-auto` — is also what stops next/image warning that
only one was modified.

`sizes` is set to `(min-width: 1024px) 80px, 60px`. Without it next/image sizes the srcset
off the 642px intrinsic width and the browser pulls a 750px render into an 80px slot; with
it, the candidate list starts at 16px and a 2× display settles on 256px.

### Favicon: the feather's eye, not the lockup

The full lockup is 1.65:1 wide. Reduced to 32px it is an unreadable smear. The icon is a
150 × 140 crop at (240, 60) — the feather's eye, which is the one element of the mark that
is square, self-contained and still recognisable at that size. The bottom edge stops at
y=200 deliberately: below it the crop catches an ascender from the `Morchadi` script, which
survives the downscale as a detached speck.

Three files, all from `scripts/generate-brand-assets.mjs`:

| File | Size | Ground | Why |
| --- | --- | --- | --- |
| `app/icon.png` | 512 × 512 | transparent | Next's file convention; covers high-DPI |
| `app/apple-icon.png` | 180 × 180 | ivory | iOS composites on its own ground, so transparency is not safe here |
| `app/favicon.ico` | 16, 32, 48 | transparent | the `/favicon.ico` request that never goes away |

Sharp cannot write ICO, so the script packs the container by hand — a 6-byte header, a
16-byte directory entry per image, then PNG payloads. PNG-in-ICO is understood by every
browser still shipping. The feather was checked at 32px against both a light and a dark tab
strip before the crop was fixed.

### OG image: the logo on ivory, 1200 × 630

`SITE_CONFIG.ogImage` pointed at `/hero/home-hero.webp` — a 1600 × 1200 wordless placeholder
at the wrong aspect ratio for a share card. It now points at `/og/default.png`: the logo
centred on ivory above a gold rule and the line `ANTI-TARNISH ARTIFICIAL JEWELLERY`, drawn
from `PRODUCT_DESCRIPTOR` so the card cannot claim something the copy does not
([ADR-018](ADR-018-honest-product-description.md)).

Nothing about the full-OG-restate discipline changes. Every page that sets `openGraph`
already restates the whole block and reads `SITE_CONFIG.ogImage` for the image, so the
constant is still the single place the share card is chosen.

### The generator overwrites, unlike the other one

`generate-placeholders.mjs` never clobbers, because a file at one of its paths may be
photography someone added by hand. `generate-brand-assets.mjs` is the opposite case: every
output is derived from `public/logo.png` with no hand-editing in between, so a stale copy is
a bug. Replace the logo, run `npm run generate:brand-assets`, and the icons and the share
card follow.

## Alternatives considered

**Recolour the logo for the footer** — a light or knocked-out variant. The right answer
eventually, and not one to invent here: it means altering supplied brand artwork, which is
the owner's call, not the build's.

**Logo on a light panel in the footer.** See above.

**Full logo squeezed into the favicon square.** Tested at 32px. Illegible.

**Keep `/hero/home-hero.webp` as the OG image.** It is 4:3 against the 1.91:1 that every
social card crops to, and it carries no brand mark at all.

## Consequences

- `Wordmark` now imports an image, so it stays a Server Component and ships no JavaScript.
- The header, the mobile drawer and every share card carry the real mark; the footer carries
  the type lockup, and the two-tone styling stays in the component because of it.
- `app/favicon.ico` is regenerated from the logo, replacing the placeholder icon.
- A new `npm run generate:brand-assets`, documented in [IMAGES.md](../design/IMAGES.md).
- Seven tests in `lib/wordmark.test.tsx` pin the variant split, the sizing classes, the
  priority flag and the accessible name.
