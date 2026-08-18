# ADR-026 — A pair of calls to action is one grid, not two buttons

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 25
**Amends:** the `md` horizontal padding set in
[ADR-025](ADR-025-button-padding-tailwind-content.md)

## Context

The hero renders two calls to action side by side: `Shop Collection` and
`Explore Categories`. Each was an `inline-flex` box sized by its own label, so the two came
out about 30px apart in width — the same style at two different sizes, which reads as a
mistake rather than as a hierarchy. Nothing in `buttonClasses()` could fix it: a button
sized by its own text is exactly what that function is for, and the only thing the two
buttons had in common was that they sat in the same flex row.

The horizontal padding compounded it. `px-8` is 32px against 20px of vertical padding, so
the label sat closer to the left and right borders than to the top and bottom ones on a
control whose whole point is open space around a short uppercase label.

## Decision

### The pair owns the width, the button owns the box

The two buttons sit in a grid of two equal columns and each spans its column with
`fullWidth`. Width is a property of the **set**, declared once on the container, and the
button keeps declaring only padding, type and colour. The columns are
`minmax(17rem, 1fr)` — a 272px floor that comfortably clears the longer label, and `1fr`
above it so the pair grows together rather than one growing alone. Below `sm` the grid is a
single full-width column, which is the same rule at one column wide.

This is why the fix is not "give both buttons a `min-w`": a minimum width on the component
would follow every `md` button to every call site, where nothing else is paired, and two
buttons whose labels both exceeded it would fall out of step again.

### `md` goes to `px-10`

40px either side against 20px above and below. The label now sits nearer the middle of its
box in both axes, and the shorter label of a matched pair has room to be centred in a cell
sized for the longer one.

`px-10` is an ordinary scale value, which
[ADR-025](ADR-025-button-padding-tailwind-content.md) requires of anything declared in
`lib/button-styles.ts`. The grid template is arbitrary, but it lives in `components/Hero.tsx`,
which Tailwind has always scanned.

| Size | Padding | Rendered height |
| --- | --- | --- |
| `md` | `px-10 py-5` | 60px, unchanged |
| `sm` | `px-5 py-2.5` | ~38px, unchanged |

Vertical padding is untouched at both scales, so no button changes height.

## Consequences

- Every `md` button site-wide gets 8px more padding on each side. The affected call sites
  are the hero, the buy panel, the cart and checkout CTAs, `/shop`'s empty state and
  `not-found`; all are short labels in wide containers, and none was near a wrap.
- `lib/hero-cta.test.tsx` pins the pair: same parent, the two-equal-column template, `gap-4`,
  and `w-full` on both buttons. Column equality is not something a jsdom test can measure —
  it asserts the declarations that produce it, and the emitted CSS was checked for the
  generated rules, per ADR-025.
- Any future pair of calls to action should reach for the same container rather than for a
  width on the component.
