# Test Result: Cart line keys and product options — 2026-08-18

- **Plan:** [PLAN-cart-line-keys.md](PLAN-cart-line-keys.md)
- **Commit:** `a7d4697` plus this prompt's working tree
- **Environment:** local — Vitest 4.1.10 on Node, `jsdom` for the three component suites. No
  network, no Cashfree credentials, no live gateway call.

## Suites

| Suite | Tests | Covers |
| --- | --- | --- |
| `lib/options.test.ts` | 30 | `lineKey`, defaults, resolution, staleness, parsing, formatting, the order summary |
| `lib/cart.test.ts` | 77 (was 53) | The 24 new cases are line identity, money-is-untouched, and option-aware pruning |
| `lib/checkout.test.ts` | 24 (was 18) | The 6 new cases are the `sessionStorage` bundle carrying selections |
| `lib/order-options.test.ts` | 20 | Merging for pricing, order-time option validation, Cashfree tag packing |
| `lib/product-options.test.tsx` | 15 | The selectors, the cart line echo, the note, per-line edits |
| `lib/order-confirmation.test.tsx` | 30 (was 29) | The 1 new case is the receipt listing each line's choice |

## Results

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 – TC-06 | Pass | `lineKey`. TC-06 confirms percent-encoding makes the key injective — a value containing `\|` or `=` cannot collide with a real two-group key |
| TC-07 – TC-18 | Pass | Resolution and staleness. TC-17 is the one that keeps a pre-existing line alive when a product gains a group |
| TC-19 – TC-30 | Pass | Cart behaviour. TC-22 and TC-23 are the separate-lines and same-selection-increments rules |
| TC-31 – TC-36 | Pass | Money. Every one compares an optioned cart against the equivalent option-less one and asserts equality, rather than asserting a hard-coded number |
| TC-37 – TC-44 | Pass | Pruning. TC-37 to TC-39 are the three ways a selection can go stale; all three drop the line |
| TC-45 – TC-49 | Pass | The checkout bundle |
| TC-50 – TC-52 | Pass | Merging. TC-52 is the important one: the per-product quantity cap survives the merge |
| TC-53 – TC-62 | Pass | Order-time validation. TC-57 confirms a withdrawn value is refused rather than substituted |
| TC-63 – TC-67 | Pass | Cashfree tag packing. TC-67 confirms an order of plain products sends the body it sent before this feature |
| TC-68 – TC-83 | Pass | Rendered behaviour, driven through the real `CartProvider` and `ProductPurchaseActions` |
| TC-84 | Pass | **All 337 tests written before this prompt pass unmodified.** No existing test was edited to accommodate options |
| TC-85 | Pass | Manual. See below |

**433 passing across 15 files**, up from 337 across 12.

### TC-85 — the built pages

Read out of `.next/server/app/product/*.html` after a clean `npm run build` (117/117 static
pages):

| Page | Control | Note | Default shown |
| --- | --- | --- | --- |
| P001 Wave Band Initial Ring | 1 `<select>` (25 letters) | present | `Letter: A` |
| P005 Silver Initial Signet Ring | 1 `<select>` (22 letters) | present | `Letter: B` |
| P006 Floating Locket Pendant | 4 radios | present | `Shape: Oval` |
| P010 Mini Watch Ring | 2 radios | present | `Colour: Silver` |
| P002 (no options) | none | absent | — |

P005's default is `B` because `B` is the first letter its data offers, which is the rule
working rather than an error.

## Failures

None.

One case failed on first run and was a **defect in the test, not in the code**: the long-summary
tag-packing case (TC-64) asserted two tag values for a 40-line summary that genuinely needs
three. The fixture was reduced to 25 lines, which is what "spans two values" actually looks
like; TC-66 already covered the three-value overflow.

## Summary

83 automated case groups covering 96 new tests, 1 regression case over the pre-existing 337,
and 1 manual case. **All pass. Nothing skipped, nothing failed.** Shippable.

The gate at the end of this prompt: `typecheck`, `lint`, `test:run` (433), `validate:products`
(`PASS — all checks green`) and `build` (117/117 static pages) all green.

### What this does not cover

The `order_tags` field has never been sent to a live Cashfree order — the packing is unit
tested against Cashfree's documented 255-character limit, but no sandbox order has been
created with one attached. That is a manual check for whoever next runs a sandbox payment,
and it is worth doing before production: a gateway that rejected the field would fail
checkout for the four personalized products only.
