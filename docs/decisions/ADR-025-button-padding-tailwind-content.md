# ADR-025 — Button padding never rendered: `lib/` was outside Tailwind's content globs

**Status:** Accepted
**Date:** 2026-08-18
**Prompt:** 24
**Amends:** the button spacing set in [ADR-023](ADR-023-home-polish.md) and re-set in
[ADR-024](ADR-024-funnel-ui-polish.md), and the `content` array established in
[ADR-004](ADR-004-design-system.md)

## Context

Three prompts in a row changed the button's padding. Each one changed the class string in
`lib/button-styles.ts`, verified the new string in the rendered markup, and reported the
change as shipped. The buttons kept looking like thin labels with the text hugged against
the top and bottom edges, and the third report was contradicted by what was on screen.

The class strings were landing. The CSS was not.

`tailwind.config.ts` scanned `./pages`, `./components` and `./app`. It did not scan
`./lib`, and `lib/button-styles.ts` is the only file in the repository that declares Tailwind
classes outside a component — which is exactly the arrangement
[ADR-004](ADR-004-design-system.md) chose so that `Button` and `ButtonLink` could not drift
apart. Tailwind therefore never saw those class names and generated no rules for them.

The button still got *some* padding, which is what made this survive three passes: a utility
appeared in the bundle only if some file under `app/` or `components/` happened to use the
same one. Read out of the previous build's CSS:

| Class | In the bundle | Why |
| --- | --- | --- |
| `py-[1.375rem]` | **absent** | Arbitrary value, used nowhere else. **Zero vertical padding.** |
| `px-12` | **absent** | Used nowhere else. **Zero horizontal padding.** |
| `text-[0.6875rem]` | **absent** | Card button text never shrank |
| `leading-4` | **absent** | The line box it was supposed to pin was never pinned |
| `py-4` (ADR-023's value) | present | Coincidence — other components use `py-4` |
| `py-2.5`, `px-5`, `py-3` | present | Coincidence — same |

So the reported "64px button" was a 20px button: an 18px line box, a 1px border, and no
padding at all. Every measurement in
[ADR-024](ADR-024-funnel-ui-polish.md) and its test result was arithmetic on a declared class
that had no rule behind it. The markup was verified; the stylesheet was not.

## Decision

### `./lib/**/*.{js,ts,jsx,tsx,mdx}` joins the content globs

This is the fix. Everything else here is consequence.

A class string that lives outside the content globs is not a smaller version of a styling bug
— it is a silent one. It type-checks, it lints, it appears in the HTML, and it survives every
grep of rendered output, which is the check the last three prompts ran. Adding the glob is
what makes `lib/button-styles.ts` a real style declaration rather than a string that happens
to look like one.

`lib/button-styles.ts` is currently the only file under `lib/` declaring classes, so the glob
costs one directory of scanning and closes the whole category.

### The padding, in plain scale values

| Size | Padding | Type | Line box | Rendered height |
| --- | --- | --- | --- | --- |
| `md` | `px-8 py-5` | `text-label` (12px) | 18px | **60px** |
| `sm` | `px-5 py-2.5` | `text-[0.6875rem]` (11px) | ~16px | **~38px** |

`md` is 20px above and below an 18px line box, so the label occupies about 30% of the button's
height and the rest is space. `sm` is the in-card scale and stays compact: a product card
should read as a product first and a button second.

Both are ordinary Tailwind scale values rather than arbitrary ones. That is deliberate after
this bug: an arbitrary value is generated only if the file declaring it is scanned, so it is
the value most likely to vanish silently, and it is worth the 2px of imprecision to use a
class that dozens of other files would also pull into the bundle.

### Padding alone decides the height

No `h-*`, `min-h-*`, `max-h-*` or `leading-*` appears in `buttonClasses()`. The line box comes
from `text-label`'s own definition in the theme, so the height is exactly padding plus line
box plus border, and changing the two padding numbers is the only way to change it. A test
asserts the absence, because a fixed height capping a button below what its padding implies is
the same class of defect as the one this ADR is about: it looks set, and it isn't.

### Nothing can override it at a call site

`Button` declares its props as `Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">`
and `ButtonLink` has no `className` prop at all, so passing padding to a button is a type
error rather than a convention. All 44 call sites were audited: none passes a spacing or
height class, because none can.

The raw `<button>` elements in `MobileNav`, `PrimaryNav`, `ShopFilterDrawer`,
`QuantityStepper`, `ProductOptionSelector` and `WhatsAppButton` do carry their own padding.
They are separate controls — nav triggers, a drawer close, stepper increments, option chips, a
floating action button — and none of them renders the shared component, so none overrides it.

## Alternatives considered

**Move the class strings into `components/Button.tsx`.** Rejected. It would have fixed the
symptom by putting the strings inside a scanned directory, and broken what
[ADR-004](ADR-004-design-system.md) built: `Button` and `ButtonLink` share `buttonClasses()`
precisely so a variant cannot look one way as a button and another as a link. The shared
module is correct; the config was wrong.

**Add only `./lib/button-styles.ts` to the content array.** Rejected. It fixes today's file
and leaves the next one to fail the same way.

**Safelist the button utilities.** Rejected. A safelist is for classes composed at runtime
from data. These are static strings in a source file, which is the case content scanning
exists to handle.

**Keep `py-[1.375rem]` now that it would generate.** Rejected. It was a fair value and it is
not worth the property that made this bug invisible for three prompts.

## Consequences

**Makes easy.** Any future file under `lib/` can declare classes and have them work. The
button's height is two numbers on the Tailwind scale that a reader can convert to pixels
without opening the theme.

**Makes hard.** Nothing meaningfully. The content glob adds one directory to the scan.

**Changes how this gets verified.** Checking a class name in rendered HTML is no longer
evidence that a style applied — this ADR exists because that check passed three times while
the style was absent. Grep the emitted CSS for the rule, not the markup for the class.

**Would force a revisit.** Declaring classes in a directory outside the globs again — `config/`
and `types/` are both currently unscanned and currently class-free.
