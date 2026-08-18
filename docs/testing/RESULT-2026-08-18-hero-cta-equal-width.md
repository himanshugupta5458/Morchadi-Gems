# Test Result: Hero paired calls to action, equal width — 2026-08-18

- **Plan:** *(no plan — regression guard for [ADR-026](../decisions/ADR-026-paired-cta-equal-width.md))*
- **Commit:** working tree on `main`, after prompt 25
- **Environment:** local — `npm run typecheck`, `npm run lint`, `npm run test:run`,
  `node scripts/validate-products.mjs`, `npm run build` from a cleared `.next`

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | Both hero buttons share one parent, and that parent carries `sm:grid-cols-[repeat(2,minmax(17rem,1fr))]` |
| TC-02 | Pass | Both carry `w-full`, so each spans its column rather than shrink-wrapping inside it |
| TC-03 | Pass | Both carry `px-10 py-5 text-label` — one box, differing only in `bg-charcoal` vs `bg-transparent` |
| TC-04 | Pass | The container carries `gap-4` — 16px between the two at every width, and between the stacked pair below `sm` |
| TC-05 | Pass | `buttonClasses({})` contains `px-10`; `py-5` unchanged, so the 60px height is unchanged |
| TC-06 | Pass | `buttonClasses({ size: "sm" })` untouched at `px-5 py-2.5` — the card scale did not move |
| TC-07 | Pass | No `h-*`, `min-h-*`, `max-h-*` or `leading-*` at either scale (the ADR-025 guard still holds) |

## Emitted CSS, not just markup

[ADR-025](../decisions/ADR-025-button-padding-tailwind-content.md) requires that a spacing
change be verified in the built stylesheet rather than in the rendered class attribute. Read
out of `.next/static/css/8e7524c928856488.css` after a build from a cleared `.next`:

| Class | Rule in the bundle |
| --- | --- |
| `px-10` | `padding-left:2.5rem;padding-right:2.5rem` |
| `py-5` | `padding-top:1.25rem;padding-bottom:1.25rem` |
| `gap-4` | `gap:1rem` |
| `w-full` | `width:100%` |
| `sm:grid-cols-[repeat(2,minmax(17rem,1fr))]` | `grid-template-columns:repeat(2,minmax(17rem,1fr))`, emitted among the other `.sm\:` rules |

The last row is the one that could have silently vanished. It is an arbitrary value, but it
is declared in `components/Hero.tsx`, which Tailwind has always scanned.

`.next/server/app/index.html` renders both anchors with
`... px-10 py-5 text-label w-full`, inside a `<div>` carrying the grid classes.

## Why the two widths are equal

Layout is not measurable in jsdom, so the tests assert the declarations and the geometry is
argued from them. The container is `sm:w-auto` inside a `flex-col items-start` column, so it
shrink-wraps; each `1fr` track resolves to at least its 272px floor, and the longer label
`EXPLORE CATEGORIES` measures about 260px at `text-label` with `px-10`, so the floor is what
binds and both columns are 272px. Both buttons are `w-full`, so both render at 272px. The
pair totals 560px against the `max-w-xl` (576px) copy column, so it does not wrap or overflow
at the `sm` breakpoint. Below `sm` the grid is one full-width column and equality is trivial.

## Failures

None.

## Summary

7 passed, 0 failed, 0 skipped. Full suite: **485 passing across 20 files** (was 481 across
19 — `lib/hero-cta.test.tsx` adds 4). `validate:products` green, build green at 68/68 static
pages. Shippable.
