# Test Result: Mobile scale pass, desktop invariance proved mechanically — 2026-08-19

- **Plan:** none. A scale change with one defect fix inside it; the suite is a guard for
  [ADR-031](../decisions/ADR-031-mobile-scale.md).
- **Commit:** `8ab7525` plus prompt 30's working tree
- **Environment:** local — Vitest 4.1.10 on Node, Next 14.2.35 production build.
- **Not verified in a browser.** No Chromium is available in this environment, so nothing
  here rests on a screenshot. The claims below are proved from the emitted stylesheet, from
  the font metrics, and from arithmetic on the box model — see *Limits* at the end for what
  that does and does not cover.

## Suites

| Suite | Tests | Covers |
| --- | --- | --- |
| `lib/responsive-scale.test.ts` | 23 (new) | Every mobile value is paired with the `sm:` restatement of the desktop value it replaced; the WhatsApp button's reserved lane; the footer's longhand padding; the category label's size and inset |
| Full suite | 676 (was 653) | Unchanged elsewhere — no existing test asserted a spacing or type value that moved |

## Results

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | 20 mobile/desktop pairs each present in the same file |
| TC-02 | Pass | `main` carries `pb-16 sm:pb-0`, footer carries `pb-24` |
| TC-03 | Pass | Footer keeps `sm:pt-14 sm:pb-14 lg:pt-16 lg:pb-16` through the longhand split |
| TC-04 | Pass | Category label is `text-eyebrow` / `px-2` and is not `px-4` |
| TC-05 | Pass | Gate: typecheck, lint, 676 tests, `validate:products`, production build (70 static pages) |

## Desktop invariance, proved by class multiset

The prompt's binding constraint was that the desktop layout must not move. Rather than
inspect it, the property was made checkable: **only unprefixed utilities were changed, and
every desktop value that an unprefixed utility used to carry was restated at `sm:`.** If
that holds, nothing at 640px or above can differ, because no rule that applies at those
widths was touched.

Comparing `HEAD` to the working tree, the `md:` / `lg:` / `xl:` class multiset of all 25
changed files is identical, with one deliberate exception:

| File | Before | After | Equivalent? |
| --- | --- | --- | --- |
| `components/Footer.tsx` | `lg:py-16` | `lg:pt-16 lg:pb-16` | Yes — same two declarations |

Everything else added `sm:` classes only. 38 were added; all 38 restate a value that was
previously unprefixed.

## Verified against the emitted CSS

The class strings being present is not proof Tailwind emitted rules for them, which is the
trap [ADR-025](../decisions/ADR-025-button-padding-tailwind-content.md) was written about.
Checked in `.next/static/css`:

| Class | Emitted | Layer |
| --- | --- | --- |
| `.aspect-[2/1]`, `.aspect-[5/4]`, `.text-display-sm`, `.pb-24`, `.pb-16` | Yes | base, no media query |
| `.sm:aspect-square`, `.sm:aspect-[4/5]`, `.sm:aspect-[16/7]`, `.sm:text-label`, `.sm:py-14`, `.sm:gap-y-8`, `.sm:text-display-lg`, `.sm:text-heading-lg` | Yes | `@media (min-width:640px)` |
| `.lg:pt-16`, `.lg:pb-16`, `.lg:aspect-auto` | Yes | `@media (min-width:1024px)` |

`text-display-sm` resolves to `font-size:2.25rem; line-height:2.375rem; letter-spacing:-.02em`,
so the new token reached the stylesheet rather than being dropped as an unknown class.

## The category label, measured rather than estimated

The reported symptom was `HAIR ACCESSORIES` rendering as `HAIR ACCESSORIE`. Measured from
the Jost subset Next emitted (`.next/static/media/9dd75fadc5b3df29-s.p.woff2`, full Latin
coverage — two other Jost subsets in that directory lack the uppercase and give a wrong
answer if picked by accident), summing `hmtx` advances and adding tracking:

| | Width needed | Room at 360px | Room at 390px | Room at 414px |
| --- | --- | --- | --- | --- |
| Before — `text-label` 12px, `px-4`, `gap-4` | 133.1px | **120px — overflows** | 135px | 147px |
| After — `text-eyebrow` 11px, `px-2`, `gap-3` | 122.0px | 138px | 153px | 165px |

This is the root cause and it explains the intermittency: at 390px the old label cleared by
2px, so the clip appeared only on narrower phones.

## Horizontal overflow

Scanned every `w-[…]`, `min-w-[…]`, `max-w-[…]` and `grid-cols-[…]` in `app/` and
`components/`. The only unprefixed arbitrary width is `max-w-[20ch]` on the about page, and
a `max-width` cannot force overflow. Every fixed-minimum track — `sm:grid-cols-[repeat(2,minmax(17rem,1fr))]`,
`lg:grid-cols-[15rem_1fr]`, `lg:grid-cols-[1fr_22rem]` — is behind `sm:` or `lg:` and so is
inert below 640px; the tightest of them, the hero CTA pair, needs 560px inside a 592px
content box at exactly 640px. No unprefixed rule can exceed a 360px viewport.

## Limits

What is **not** covered here, and would need a browser:

- Actual rendered line counts. Heights quoted in ADR-031 are computed from aspect ratios,
  padding and line-height, with wrapped-line counts assumed; the deterministic parts (image
  boxes, padding, gaps) are exact, the text parts are estimates.
- Whether the compacted spacing still *looks* premium. That is a judgement call on a real
  device, and it is the one thing worth re-checking by hand before shipping.
- Real scroll behaviour of the fixed WhatsApp button mid-scroll. The reserved lane is proved
  present in the markup; that it resolves the reported overlaps at rest follows from the
  geometry, but the feel of it has not been observed.
