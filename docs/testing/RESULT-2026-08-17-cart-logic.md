# Test Result: Cart logic — 2026-08-17

- **Plan:** [PLAN-cart-logic.md](PLAN-cart-logic.md)
- **Commit:** working tree on `main` at `d2f4f96` (prompt 9 changes uncommitted)
- **Environment:** local. `npm run test:run` (Vitest 4.1.10, node + jsdom), `npm run typecheck`,
  `npm run lint`, `npm run validate:products`, `npm run build`, and `next start` on port 3210
  for the served-HTML checks. No Cashfree involvement — there is no payment code yet.

## Automated cases

`lib/cart.test.ts` — **49 passed**, covering TC-01 to TC-49.
`lib/cart-context.test.tsx` — **10 passed**, covering TC-50 to TC-59.

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 – TC-10 | Pass | Add, merge, clamp, out-of-stock refusal, snapshot refresh, purity |
| TC-11 – TC-20 | Pass | Remove, set quantity, unknown ids, item counting |
| TC-21 – TC-33 | Pass | Totals, shipping, out-of-stock exclusion, catalogue-priced lines |
| TC-34 – TC-41 | Pass | Pruning, re-clamping, snapshot refresh, duplicate merge |
| TC-42 – TC-49 | Pass | Hostile persisted data, config-driven shipping rate |
| TC-50 – TC-55 | Pass | Server render, hydration, badge increment, reload survival, toast |
| TC-56 – TC-59 | Pass | Cart page hydration, out-of-stock blocking, stepper |
| TC-60 | Pass | See below |
| TC-61 | Pass | See below |

Two cases are worth stating in full because they are the ones that make the rest credible.

**TC-21 and TC-26 — the empty-shipping cases.** A cart with nothing in it, and a cart holding
only a sold-out line, both total ₹0. Shipping is not charged on an order that has nothing
payable in it.

**TC-27 — the tampered snapshot.** A `CartItem` whose stored `price` is `1` still subtotals at
the catalogue's ₹1,000. This is the assertion behind ADR-010's claim that the snapshot is
never read.

## Adversarial checks

Both were run and both behaved as the plan requires. Neither is in the committed suite.

**TC-60 — is the hydration assertion vacuous?** `expect(consoleError).not.toHaveBeenCalled()`
only means something if a real mismatch would trip it. A throwaway probe hydrated a component
rendering `"zero"` on the server and `"three"` on the client; `console.error` **was** called.
The probe was deleted. The four hydration cases are therefore live assertions, not decoration.

**TC-61 — is the empty-first render load-bearing?** `CartProvider`'s initial state was changed
to read `localStorage` in the `useState` initialiser — the obvious implementation ADR-010
rejects. TC-50 failed immediately: with a cart in storage, the server render no longer emitted
`Cart, empty`. The provider was restored from backup and the suite re-run green.

Note on the limits of TC-61: under jsdom, `renderToString` also sees a `window`, so the
eagerly-read version produced a *consistent* (if wrong) pair of renders and the mismatch
assertions in TC-51/52 did **not** fire — only TC-50 caught it. In a real Node server render
there is no `window` and the mismatch would be genuine. The suite catches this fault, but it
catches it through the server-render case, not the hydration cases.

## Other verification run alongside

| Check | Result |
| --- | --- |
| `npm run test:run` | 118 passed across 4 files |
| `npm run typecheck` | Clean |
| `npm run lint` | No ESLint warnings or errors |
| `npm run validate:products` | PASS — all checks green |
| `npm run build` | 108 static pages; `/cart` prerendered; only `/shop` dynamic |
| Served `/cart` | 200; `<title>Your Cart · Morchadi Gems</title>`; `robots: noindex, follow` |
| Served `/cart` first paint | Contains the loading line and `aria-label="Cart, empty"` — no cart contents in prerendered HTML, as designed |
| Sold-out product pages (`nk-006`, `er-004`, `bn-006`) | 5 disabled controls each; primary relabelled "Sold out" |
| Sold-out card in the `/shop` grid | 12 necklace cards → 11 enabled "Add to cart", 1 disabled "Sold out", 0 miscategorised |
| Client payload leak check | `/`, `/cart` and `/product/nk-001` contain no `shortDescription`, `reviewCount` or `reviews` field |
| Catalogue index footprint | 105 serialised entries on `/product/nk-001` = 14.3 kB raw / 2.2 kB gzipped; First Load JS unchanged at ~106 kB |

## Failures

None.

## Gaps this run does not cover

Stated rather than left implied.

- **No visual verification.** No browser is available in this environment. Everything above is
  asserted on rendered HTML or on a jsdom tree. Layout, the sticky summary, the toast animation
  and the desaturated out-of-stock thumbnail have not been *looked at*.
- **No cross-tab test.** Two tabs sharing one cart is a known gap in the design
  ([ADR-010](../decisions/ADR-010-cart-architecture.md)), not a covered case.
- **No server-side price validation tests**, because there is no server-side price validation
  yet. The client cart is upstream of that requirement and does not satisfy it. This is the
  most important thing still missing before money moves.

## Summary

**118 passed, 0 failed, 0 skipped** — 59 of them new for the cart (49 unit, 10 hydration and
view). Typecheck, lint, product validation and the production build are all green.

Shippable as the cart layer. Not shippable as a checkout: the payment path does not exist yet,
and when it does it must recompute every amount server-side regardless of anything this layer
sends it.
