# Test Result: Mobile layout round two, plus a pre-existing overflow — 2026-08-19

- **Plan:** none. A layout change with one latent bug fixed inside it; the suite guards
  [ADR-033](../decisions/ADR-033-mobile-layout-round-two.md).
- **Commit:** `8ab7525` plus prompts 30 and 32's working tree
- **Environment:** local — Vitest 4.1.10 on Node, Next 14.2.35 production build.
- **Not verified in a browser.** No Chromium here. Everything below is proved from the
  emitted stylesheet, the prerendered HTML, the font metrics, and box-model arithmetic. See
  *Limits*.

## Suites

| Suite | Tests | Covers |
| --- | --- | --- |
| `lib/mobile-layout.test.tsx` | 13 (new) | `mobileLimit` behaviour; the mobile call to action; the hero's `sizes` hint and `hidden sm:block`; every carousel property and its `sm:` restore; footer spans and touch targets; that neither carousel carries a flat `-mr-6` |
| `lib/responsive-scale.test.ts` | 24 (was 23) | ADR-031's pairs, updated for the hero's `py-12` and extended with the hidden photograph |
| Full suite | 690 (was 677) | Unchanged elsewhere |

## Results

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | All 8 products stay in the markup; only items 5–8 carry `hidden sm:list-item` |
| TC-02 | Pass | Restore is `sm:list-item`, not `sm:block` — an `li`'s real default |
| TC-03 | Pass | No limit, or a limit covering the set, hides nothing |
| TC-04 | Pass | Both strips get a `sm:hidden` full-width `ButtonLink` to the collection |
| TC-05 | Pass | Hero is `hidden aspect-[2/1] w-full sm:block` |
| TC-06 | Pass | Hero `sizes` is `(min-width: 640px) 100vw, 1vw` |
| TC-07 | Pass | Carousel carries all 7 mobile properties and all 7 `sm:` restores |
| TC-08 | Pass | Both carousels pair the bleed (`-mr-5` + `sm:mr-0` / `sm:-mr-6`); no flat `-mr-6` |
| TC-09 | Pass | Footer is `grid-cols-2` with brand and payments `col-span-2 sm:col-span-1` |
| TC-10 | Pass | Footer links are `block py-1 … sm:inline sm:py-0` |
| TC-11 | Pass | Gate: typecheck, lint, 690 tests, `validate:products`, build (70 static pages) |

## Desktop invariance

Same method as [ADR-031](../decisions/ADR-031-mobile-scale.md): only unprefixed utilities
changed, and anything an unprefixed utility used to carry at ≥640px is restated at `sm:`.

Across all **7 changed code files** the `md:` / `lg:` / `xl:` class multiset is **identical**,
with no exception this time, and **no `sm:` class was removed without being re-added**. The
desktop grid, the desktop hero and the desktop footer therefore cannot have moved.

## Verified against the emitted CSS

| Class | Layer | Rule |
| --- | --- | --- |
| `-mr-5` | base | `margin-right:-1.25rem` |
| `flex` / `snap-x` / `snap-mandatory` / `overflow-x-auto` | base | as expected |
| `w-[40%]` | base | `width:40%` |
| `shrink-0` / `snap-start` / `hidden` / `grid-cols-2` / `block` / `py-1` / `gap-1.5` / `col-span-2` / `py-12` | base | as expected |
| `sm:mr-0` / `sm:-mr-6` / `sm:grid` / `sm:snap-none` / `sm:overflow-x-visible` | `(min-width:640px)` | as expected |
| `sm:w-auto` / `sm:shrink` / `sm:snap-align-none` / `sm:block` / `sm:list-item` / `sm:inline` / `sm:py-0` / `sm:gap-2.5` / `sm:col-span-1` | `(min-width:640px)` | as expected |

Every mobile utility is in the base layer and every restore is inside the 640px query.

## The hero preload — first attempt was wrong

The first fix used `sizes="(min-width: 640px) 100vw, 1px"`. It was checked against the
prerendered HTML rather than assumed, and the check found it **did not work**: the preload's
candidate widths still started at 640w, so a phone would have downloaded the 640w source for
an image it never displays.

The cause is that Next derives the source set from the `vw` values it parses out of `sizes`;
a `px` fallback contributes none, so the smallest candidate stayed at `deviceSizes[0]`.
Changing the fallback to `1vw` pulls the small widths in:

| | Preload candidate widths |
| --- | --- |
| `…, 1px` | 640, 750, 828, 1080, 1200, 1920, 2048, 3840 |
| `…, 1vw` | **16, 32, 48, 64, 96, 128, 256, 384**, 640, 750, … 3840 |

Measured with sharp at q75 from the 1024×572 source: the 16w candidate is **0.1KB** against
**8.8KB** for 640w. Above the breakpoint the hint still resolves to `100vw`, so desktop
selects what it always did.

## Carousel geometry and page overflow

Container padding is 20px below `sm` (confirmed from the compiled `.container` rule), and the
track bleeds `-mr-5` = 20px, so the track's right edge lands exactly on the viewport edge.

| Viewport | Track | Tile (40%) | Tiles visible | Peek of 3rd | Label inner width | Track right edge |
| --- | --- | --- | --- | --- | --- | --- |
| 360px | 340px | 136.0px | 2.30 | 44px | 120.0px | 360px — flush |
| 390px | 370px | 148.0px | 2.31 | 50px | 132.0px | 390px — flush |
| 414px | 394px | 157.6px | 2.32 | 55px | 141.6px | 414px — flush |

**No page overflow at any of the three**, and the peek is a real affordance at all of them.

Label fit (Jost, 11px, 0.14em): `HAIR ACCESSORIES` is 122.0px, so it is one line at 390 and
414 and wraps at the space to two lines at 360, where the inner width is 120.0px. The
governing figure is the longest *word*, `ACCESSORIES` at 87.0px, which clears every width by
33px or more — so the wrap is clean and the ADR-031 mid-word break cannot recur. Two lines is
2×16 + 24 = 56px inside a 64–72px scrim. Every other label is one line everywhere (longest:
`NECKLACES`, 74.0px).

## The pre-existing overflow

`TestimonialCarousel` has bled `-mr-6` (−24px) since it shipped, against a base container
padding of 20px:

| Bleed | 360px | 390px | 414px |
| --- | --- | --- | --- |
| `-mr-6` (before) | overflows 4px | overflows 4px | overflows 4px |
| `-mr-5 sm:-mr-6` (after) | flush | flush | flush |

Nothing in the tree clipped it — neither `globals.css`, `layout.tsx`, `TestimonialBand` nor
the home page sets `overflow-x`. So every phone page carrying the testimonial band had a
horizontal scrollbar. ADR-031's overflow scan missed this because it looked at `w-[…]`,
`min-w-[…]`, `max-w-[…]` and `grid-cols-[…]` and did not consider negative margins; the scan
in this pass covers them, and `lib/mobile-layout.test.tsx` asserts neither carousel carries a
flat `-mr-6` again.

## Limits

Needs a browser, and is not covered here:

- That the snap feel is right — snap points are asserted present, not exercised.
- Whether hiding the hero photograph is the right *call* aesthetically. The mobile hero is
  now typographic; that it is shorter is proved, that it is better is a judgement on a device.
- Real scroll behaviour of the carousel with momentum, and whether 2.3 tiles reads as
  "swipe me" to an actual user rather than in arithmetic.
- Confirmation that no *other* horizontal overflow exists from a source this scan does not
  model (transforms, `position:absolute` children, shadows). The negative-margin class is now
  covered; the general problem is only ever settled by measuring `document.scrollWidth`.
