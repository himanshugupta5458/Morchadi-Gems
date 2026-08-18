# Test Result: Button padding, verified against the stylesheet — 2026-08-18

- **Plan:** none. A targeted regression fix; the suite is a guard for
  [ADR-025](../decisions/ADR-025-button-padding-tailwind-content.md).
- **Commit:** `9d21a8e` plus prompts 23 and 24's working tree
- **Environment:** local — Vitest 4.1.10 on Node.
- **Supersedes** the button rows of
  [RESULT-2026-08-18-funnel-ui-polish](RESULT-2026-08-18-funnel-ui-polish.md), which checked
  the class strings in the rendered HTML and found them, but did not check whether Tailwind
  had emitted the corresponding rules. It had not. Everything else in that result stands.

## Suites

| Suite | Tests | Covers |
| --- | --- | --- |
| `lib/button-styles.test.ts` | 5 (was 4) | Both scales by their literal padding and type classes; that only the box differs; and, new, that no `h-*` / `min-h-*` / `max-h-*` / `leading-*` appears in either size |

## Results

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | `md` is `px-8 py-5 text-label` |
| TC-02 | Pass | `sm` is `px-5 py-2.5 text-[0.6875rem]` |
| TC-03 | Pass | Both scales carry the same border, fill, case and tracking; only the box differs |
| TC-04 | Pass | `w-full` only when `fullWidth` |
| TC-05 | Pass | **New.** Neither size carries a height or line-height class, so padding alone defines the height |

## Verified against the emitted CSS, not the markup

This is the check that was missing, and the one that would have caught the defect three
prompts ago.

```
$ grep -oE '\.(px-8|py-5|px-5|py-2\\\.5)\{[^}]*\}' .next/static/css/*.css
.px-8{padding-left:2rem;padding-right:2rem}
.py-5{padding-top:1.25rem;padding-bottom:1.25rem}
.px-5{padding-left:1.25rem;padding-right:1.25rem}
.py-2\.5{padding-top:.625rem;padding-bottom:.625rem}

$ grep -oF '.text-\[0\.6875rem\]{' .next/static/css/*.css
.text-\[0\.6875rem\]{        → font-size:.6875rem
```

Before the fix, `py-[1.375rem]`, `px-12`, `text-[0.6875rem]` and `leading-4` were **all
absent** from the bundle.

| Check | Result |
| --- | --- |
| Hero CTA rendered classes | `px-8 py-5 text-label` |
| Card button rendered classes | `px-5 py-2.5 text-[0.6875rem] w-full` |
| `h-*` / `leading-*` on any shared button in the built HTML | None. The two `leading-none` hits are `Wordmark`'s link, not a button |
| Call sites passing spacing or height | None across all 44. `Button` omits `className`; `ButtonLink` has no such prop |

## Failures

None. The defect this result records was found before the run, not by it — see
[the diagnosis log](../logs/2026-08-18-buttons-render-with-no-padding.md).

## Not covered

**No browser.** 60px and ~38px are arithmetic on padding, the theme's line box and the border.
Unlike the previous result, the padding declarations behind them are now confirmed present in
the shipped stylesheet.

## Summary

481 passed, 0 failed, 0 skipped. Shippable.
