# Test Result: Universal add-to-cart modal — 2026-09-01

- **Plan:** [PLAN-universal-add-to-cart-modal.md](PLAN-universal-add-to-cart-modal.md)
- **Commit:** `fca97f0` plus the uncommitted working tree this result describes
- **Environment:** local production build (`next build` → `next start`, Next.js 14.2.35, Node
  v24.14.0), headless Chromium via `playwright-core`, viewports 390×844 and 1440×900. No
  database and no Cashfree call is reached by anything below

## Why this file exists at all

The work it covers was finished in a session that a Codespace restart ended before it could
report. The automated gate and the build were on disk; **the manual pass in the plan had not
been run, and this file did not exist.** Everything recorded here was executed fresh against the
working tree, and two of the findings are corrections to documents written by the interrupted
session rather than results of the plan as written.

## Automated gate

| Check | Result |
| --- | --- |
| `vitest run` | **2523 / 2523 pass**, 128 files, exit 0 |
| `tsc --noEmit` | exit 0 |
| `npm run validate:products` | `PASS — all checks green`, 449 products |
| `next build` | 477 pages. Not re-run for this result; `.next/BUILD_ID` predates no source file under `app/ components/ lib/ config/ data/`, so the build on disk corresponds to this tree |

The suite was 2489 before this result's own work; `lib/add-to-cart-modal.test.ts` adds 34.

## Cases

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| TC-01 | Modal pre-selects nothing — one group, 3 values (`P101`) | **Pass** | Nothing checked, confirm disabled, prompt names the group |
| TC-02 | Modal pre-selects nothing — one group, 2 values (`P398`, the birthstone) | **Pass** | The case ADR-067 §2 accepted as residual risk |
| TC-03 | Modal pre-selects nothing — one group, 23 values, dropdown (`P408`) | **Pass** | Select reads `Choose…`, not `B` |
| TC-04 | Modal pre-selects nothing — two groups (`P212`) | **Pass** | Both groups empty, prompt names the first |
| TC-05 | Confirm stays disabled until *every* group is answered | **Pass** | Traced group by group on `P212` |
| TC-06 | The prompt and the button never disagree | **Pass** | Prompt moved to group 2 at the moment the button stayed disabled |
| TC-07 | Dismissing adds nothing | **Pass** | Escape; cart `[]` on all four |
| TC-08 | Reopening forgets a half-made choice | **Pass** | Empty and disabled again on all four |
| TC-09 | Confirming adds exactly what was chosen | **Pass** | Payloads below |
| TC-10 | Card shows the shape of the question, none of its answers | **Pass** | `3 SIZES`, `2 OPTIONS`, `23 OPTIONS`; no chips, no swatches, no dropdown, no "Choose Your Options" |
| TC-11 | Within-row card alignment, three viewports, two pages | **Pass** | 0px spread everywhere |
| TC-12 | The reserved slot is still earning its place | **Pass, on different evidence than the plan predicted** | See "Failures and corrections" |
| TC-13 | Search moved into the persistent header | **Pass** | Present on `/shop` and `/cart` |
| TC-14 | Search absent from the stripped checkout pages | **Pass** | Zero inputs on `/address` and `/payment`, both viewports |

## The four products, walked

One real catalogue product per category ADR-067 split cards into, driven through the built page
rather than through fixtures. Values were chosen by clicking the `<label>`, as a shopper does.

### On open

| Product | Shape | Checked | Select | Confirm | Prompt |
| --- | --- | --- | --- | --- | --- |
| `P101` Maroon Jelly Glass Bangles | 1 group, 3 values, pills | `[]` (3 offered, 0 disabled) | — | **disabled** | "Choose a Size for bangles to continue" |
| `P398` Gold-Toned Birthstone Pendant | 1 group, 2 values, swatch | `[]` | — | **disabled** | "Choose a Stone to continue" |
| `P408` Initial Letter Ring | 1 group, 23 values, dropdown | — | value `""`, displays **`Choose…`**, first option `disabled=true` | **disabled** | "Choose a Letter to continue" |
| `P212` Wavy Glass Kangan | 2 groups, 6 + 2 values, pills | `[]` in both | — | **disabled** | "Choose a Design Number to continue" |

`P408` is the row the plan singles out, and it holds: a native select handed an empty value
displays its first option, so "it shows `B`" and "it has `B` selected" are indistinguishable on
screen. The control was read before it was touched. It reads `Choose…`.

### Progressive enablement, `P212`

```
open          -> confirm disabled=true   prompt "Choose a Design Number to continue"
Design Number = "1"
              -> confirm disabled=true   prompt "Choose a Size for bangles to continue"
Size for bangles = "2.6"
              -> confirm disabled=false  prompt gone
```

The button and the sentence agreed at every step. The prompt moved to the second group at
exactly the point the button declined to enable.

### Dismiss and reopen

Escape, on all four: the dialog closed, `localStorage["morchadi-cart-v1"]` stayed `[]`, and
reopening reported `checked=[] selects=[""] confirmDisabled=true`. A half-made choice is
discarded, not resumed.

### Confirmed payloads

What reached the cart, read back out of `localStorage`:

```json
{"productId":"P101","selectedOptions":{"Size for bangles":"2.4"}}
{"productId":"P398","selectedOptions":{"Stone":"February Purple"}}
{"productId":"P408","selectedOptions":{"Letter":"B"}}
{"productId":"P212","selectedOptions":{"Design Number":"1","Size for bangles":"2.6"}}
```

Each holds exactly the groups the product carries and exactly the values that were clicked. Note
`P101` recording `2.4` and `P398` recording `February Purple`: those *are* the catalogue
defaults, and they are here because they were the values chosen, which is the whole distinction
this work exists to make legible. The proof they were chosen rather than assumed is TC-01 and
TC-02 — the same two products showed nothing selected a moment earlier.

### Pixel-level, 390px

The dialog is a bottom sheet: 68px thumbnail, name, price, then one labelled section per group
in letter-spaced caps. Chips render outlined with no fill — **no filled chip appears anywhere in
the empty state**, which is what distinguishes "nothing chosen" from "chosen and styled subtly".
The confirm button renders in muted tan with grey text: visibly inert rather than a live button
that happens to reject the click. `February Purple` and `October Pink` each fit on one line
without wrapping. `P212`'s two sections are separated and both reachable with no scroll at
390px.

## Card heights, measured

`node scripts/measure-card-heights.mjs --counterfactual`, against `npm start`.

**Within-row spread is 0px in every row, at every viewport, on both pages — with the slot and
without it.**

| Page / viewport | As built | Slot removed | Row-to-row Δ |
| --- | --- | --- | --- |
| `/shop` phone 390 | 289.59px, all 6 rows | tagged row 289.59, untagged 265.59 | **24px** |
| `/shop` tablet 768 | 383.33px, all 4 rows | tagged 383.33, untagged 359.33 | **24px** |
| `/shop` desktop 1440 | 362px, all 3 rows | tagged 362, untagged 338 | **24px** |
| `/` phone 390 | 313.59px | tagged 313.59, untagged 289.59 | **24px** |
| `/` tablet 768 | 383.33px | tagged 383.33, untagged 359.33 | **24px** |
| `/` desktop 1440 | 436px | tagged 436, untagged 412 | **24px** |

Every viewport reported at least one mixed row, so TC-11 and TC-12 were measured on rows that
actually contain both kinds of card rather than on uniform ones.

## Header search

Measured on the rendered pages, both viewports:

| Page | `input[type=search]` | Header links | WhatsApp bubble |
| --- | --- | --- | --- |
| `/shop` | 2 — one per breakpoint, one hidden | 5 | yes |
| `/cart` | 2 | 5 | yes |
| `/address` | **0** | 2 | **no** |
| `/payment` | **0** | 2 | **no** |

The checkout header carries only `BACK TO CART` and the `1 ADDRESS · 2 PAYMENT · 3 CONFIRMATION`
indicator. `app/(checkout)/layout.tsx` renders no `Header` at all — the two pages mount
`CheckoutHeader` themselves — so the absence is structural, not a conditional that a future prop
could flip.

The two `ProductSearch` instances are the plan's own noted regression risk. They are distinct
mounts with distinct state; a change that gave them a shared id would show as one box driving the
other's dropdown.

## Failures and corrections

No case failed. Three things were nonetheless wrong, and are recorded as failures of the
documents rather than of the code.

### 1. The plan predicted the wrong number, and the wrong kind of number

[The plan](PLAN-universal-add-to-cart-modal.md) asserted, as `exact`:

> With the empty slot removed, a mixed row's spread is **16px**

Both halves are wrong. The mixed row's spread stays **0px** with the slot removed, and the real
figure is **24px** — the 16px line box plus the 8px `gap-2` — appearing as a **row-to-row**
difference, not a within-row spread. Within-row alignment turns out to be `ProductGrid`'s stretch
plus the action's `mt-auto`, and the card reserves nothing that contributes to it.

The slot is still right to keep, on the corrected evidence: without it a listing's vertical
rhythm depends on which products happen to fall in which row, which changes with the sort order
and the page. ADR-073 §5 already recorded the contradiction correctly and in its own words; the
plan's prediction table was simply never reconciled with it. The plan has been corrected and now
points here.

### 2. The rule module had no direct tests

`lib/add-to-cart-modal.ts` opens by saying its functions live in a module with no React in it
"so they can be asserted directly rather than through a rendered dialog". Nothing asserted them
directly: across the whole suite only `buildUnansweredPrompt` was imported by a test, and
`emptySelection`, `isGroupAnswered`, `firstUnansweredGroup`, `isSelectionComplete`,
`buildGroupLabel` and `toConfirmedSelection` were covered transitively or not at all.

`lib/add-to-cart-modal.test.ts` now covers all seven, 34 cases. It was mutation-checked rather
than merely run: deleting the `option.values.includes(chosen)` clause from `isGroupAnswered`
fails 5 of them.

The gap mattered most for `toConfirmedSelection`, whose doc comment names
`resolveSelectedOptions` as the thing it defends against. Reading the two together shows the
defence is subtler than the comment implies: `resolveSelectedOptions` maps over the *product's*
groups, so a stray key is dropped there too — the narrowing is belt-and-braces on that count.
What is genuinely load-bearing is that `toConfirmedSelection` drops **unanswered** groups and
`resolveSelectedOptions` then fills them with `option.default`. An incomplete draft does not
reach the cart as a gap; it reaches it as a default, indistinguishable from a choice. The only
thing standing between those two functions is the disabled confirm button, and the new file
asserts both directions of that explicitly.

### 3. A harness bug in this session's first measurement pass

Recorded because a wrong number was produced and read before it was corrected. The first
Playwright pass reported `P101` and `P212` as still-disabled after their groups were answered,
which would have been a real defect. It was the harness: the radios are `peer sr-only`, and a
forced click on the input landed on the covering element instead. Clicking the `<label>`, which
is what a person does, works. `P101` was separately confirmed to have **no** disabled values, so
the out-of-stock cascade was not involved.

## Summary

**14 of 14 cases pass. 2523/2523 automated, `validate:products` PASS, typecheck clean.**

Shippable. The no-silent-default property holds unconditionally: routing is asserted across all
449 catalogue products, the modal's behaviour is asserted on one fixture per ADR-067 category and
verified in a browser on one real product per category, and the rules beneath both now have
direct tests.

The two document defects above were introduced by the interrupted session and are fixed in the
same change as this result. Nothing about the running code was found wrong.
