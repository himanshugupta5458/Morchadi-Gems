# Test Result: Checkout flow polish — 2026-08-31

- **Plan:** [PLAN-checkout-flow-polish.md](PLAN-checkout-flow-polish.md)
- **Commit:** working tree on `bb4b4b1`
- **Environment:** local `next dev` on `:3001`, local Postgres 16 in Docker, **Cashfree
  sandbox with real credentials**. `RESEND_API_KEY` is not set here, which is why TC-50's
  wording is what it is rather than a claim the send succeeded.
- **Browser:** Chromium Headless Shell 131 driven by Playwright, 1440 × 1000 and 375 × 720.

## Automated

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 – TC-05 | Pass | `lib/free-shipping-gap.test.ts`. TC-04 and TC-05 are the two that matter: the gap is unchanged by a `plan.onlineDiscount` of ₹40 on a ₹799 cart, and a gap read on the discounted total would have told a shopper who *had* earned free shipping that they were still short |
| TC-06 | Pass | `lib/free-shipping-threshold-propagation.test.tsx`, rewritten: the case that used to assert the nudge from `OrderTotals` now asserts it from `FreeShippingProgress`, in its sentence and in `aria-valuenow` |
| TC-07 – TC-16 | Pass | `lib/cart-page-copy.test.tsx` (11 cases) |
| TC-17 – TC-20 | Pass | `lib/cart-undo.test.tsx`. TC-20 uses `vi.useFakeTimers({ shouldAdvanceTime: true })` and asserts against `localStorage`, not only against the DOM |
| TC-21 | Pass | `lib/cart.test.ts`, five new cases on `restoreCartItem` |
| TC-22 – TC-28 | Pass | `lib/checkout-chrome.test.tsx` (9 cases). TC-23 builds its marker list from `CATEGORY_MENU`/`COLLECTION_MENU`/`COMPANY_LINKS` rather than typing the labels, so renaming a menu cannot make the test pass by accident |
| TC-29 – TC-33 | Pass | `lib/payment-checkout.test.tsx`, new "what the payment step tells a shopper" block |
| TC-34 – TC-36 | Pass | `lib/payment-checkout.test.tsx`, new "the gift note" block |
| TC-37 | Pass | `lib/gift-message.test.ts` |
| TC-38 – TC-43 | Pass | `lib/checkout-gift-message.test.ts`, against a real Postgres row through the real route on the cash-on-delivery path |
| TC-45 – TC-56 | Pass | `lib/confirmation-fine-print.test.tsx` (15 cases). TC-45 and TC-47 are asserted in one file on purpose: the risk this change carried was removing the wrong reference, or both |
| TC-57 – TC-59 | Pass | `lib/catalogue-client-boundary.test.ts` |
| TC-60 | Pass | `lib/product-repository-boundary.test.ts`, which reads real build output — see the gate note below |
| TC-61 – TC-67 | Pass | `lib/cross-sell.test.ts` (14 cases), run against `data/products.json` rather than fixtures |

## Manual

### TC-68 — the full browser walk

A scripted Playwright walk from a product page to a placed cash-on-delivery order, asserting
**46 conditions**. All 46 passed on the final run. The piece is P002 — ₹450 against a ₹999 MRP,
which is the shape that makes the free-shipping gap interesting: the selling price is ₹349 short
of the threshold while the compare-at price clears it by ₹200.

| Screen | What was verified |
| --- | --- |
| `/cart` | MRP row ₹999, saving −₹549, total ₹549; **"Add ₹349 for free shipping"** — the selling-price figure, not the MRP one; progress bar at `aria-valuenow=56`; four cross-sell cards from `necklaces`; the COD sentence; the delivery estimate; the trust strip; the old catalogue-pricing line gone; Continue shopping carrying no primary-button classes; shop chrome still present |
| Undo | The toast and its Undo appeared on removal, and the line came back |
| `/address` | No shop nav, **no `wa.me` anywhere in the document**, logo + step indicator + Back to cart, the COD sentence before payment, the support address, no free-shipping nudge |
| `/payment` | Trimmed security sentence; the removed explanation absent; no nudge; "Online payment discount (5%) −₹23" and "You are saving ₹23 on this order by paying online." — the same figure; the gift field; UPI / Cards / Net banking / Wallets; "Pay ₹526 with Cashfree"; selecting cash on delivery withdrew the saving line and moved the button to "Place order and pay ₹549 on delivery" |
| Confirmation | "Your order is placed"; **`COD_1788167889646_tdmohhtl` appears nowhere in the document**; the order-number callout and its Copy button; "Our courier will call before delivery. Please keep ₹549 in cash ready, and exact change helps."; "A copy of this order is on its way to walk@example.com"; no nudge; four cross-sell cards |

Screenshots at `shots/cart.png`, `shots/address.png`, `shots/payment.png`,
`shots/confirmation-cod.png` (session scratchpad; not committed).

### TC-69 / TC-70 — the summary, and the bar under it

**TC-69 failed on the first run and is the reason a defect was fixed.** Scrolling the cart 400px
moved the "Order summary" heading from `y = 371` to `y = −29` — off the top of the screen, with
`lg:sticky lg:top-32` on the element. A grid item is stretched to its row's height by default, so
the panel filled its own containing block and had no slack to stick within. `lg:self-start` on
`CartSummary` and `CheckoutSummary` is the fix; the same scroll now leaves the heading at
`y = 153`. Written up in
[the audit log](../logs/2026-08-31-free-shipping-gap-audit.md).

TC-70 passed: at 375 × 720, after a 600px scroll, the pinned Checkout bar sat at `y = 660`.

### TC-71 — a real prepaid sandbox payment

Placed through the browser, paid with Cashfree's own test card `4706 1312 1121 2123`, through
the "Pay without saving the card" interstitial and the sandbox OTP screen.
`GET /api/verify-order` then returned:

```json
{"orderId":"MG_1788168609128_d2i77x96","status":"PAID","amount":526,"trackingId":"WDZPGEQDYH","amountDue":0}
```

₹526 is ₹549 less the 5% rebate on the ₹450 subtotal, rounded — the figure the payment step
previewed. The success screen was then rendered and asserted:

- **"Payment reference MG_1788168729582_ovkhb3b3" present and unchanged** — the line whose
  removal would have been the expensive mistake on this prompt
- the Copy button, the email note naming `prepaid.walk@example.com`, no free-shipping nudge, the
  cross-sell rail

**Caveat, stated because it changes what was proven:** Cashfree's return URL is built from
`APP_BASE_URL`, which in this Codespace is the public forwarded hostname behind a GitHub login,
so the browser could not follow the redirect home. The confirmation screen was opened on
`localhost:3001` **in the same tab**, which still held the `sessionStorage` bundle the real
return would have arrived with. The payment, the verification and the screen are all real; the
redirect hop is the one link that was stepped over, and it is a deployment-configuration
property rather than anything this prompt touched.

### TC-44 — the gift note on the admin detail

A real cash-on-delivery order placed through the route with a two-line note, then
`POST /admin/api/login` and `GET /admin/orders/6NXHY52WJD`:

```
Gift message
Please gift wrap it in the red box.
For Meera, with love.
```

The newline survives (`whitespace-pre-line`), and the row read back as
`'Please gift wrap it in the red box.\nFor Meera, with love.'`.

### The chrome, checked at the document level

`curl` on all four pages, counting markers in the served HTML:

| Page | `wa.me` | Shop by Category | Back to cart | `"cost"` | `migrationProvenance` |
| --- | --- | --- | --- | --- | --- |
| `/cart` | 1 | 1 | 0 | 0 | 0 |
| `/address` | **0** | **0** | 2 | 0 | 0 |
| `/payment` | **0** | **0** | 2 | 0 | 0 |
| `/order-confirmation` | 1 | 1 | 1 | 0 | 0 |

The last two columns are the cross-sell boundary checked in the shipped payload rather than only
in the import graph: no margin figure and no other shop's identifiers reach any of the four
pages. Confirmed again against `.next/static/chunks` after a build — the only chunk naming
`migrationProvenance` is the admin product editor, which is what that screen is for.

## Failures

### TC-69 — the cart summary was never sticky

Fixed, not deferred. Cause and measurements in
[2026-08-31-free-shipping-gap-audit.md](../logs/2026-08-31-free-shipping-gap-audit.md).

### Found outside the plan: the receipt totalled the cart, not the charge

Not a planned case. Seen in the TC-71 screenshot: "Amount paid ₹526" directly above a receipt
totalling ₹549, both true, with nothing explaining the ₹23. `readBundleReceiptTotals` now derives
the receipt's total from the two amounts the server stamped and shows the gap as its own row;
TC-54 – TC-56 were added to the plan afterwards and pass. Same log.

## Gate

Run in the order `typecheck → lint → validate:products → build → test:run`.

| Step | Result |
| --- | --- |
| `npm run typecheck` | Pass, no output |
| `npm run lint` | Pass, no warnings or errors |
| `npm run validate:products` | `PASS — all checks green` (the 404-product amount-in-copy advisory is pre-existing and unchanged) |
| `npm run build` | Pass, 477 static pages, `/address` and `/payment` still at their own URLs |
| `npm run test:run` | **125 files, 2421 tests, 0 failed, 0 skipped** |

**The order matters and is not the order the prompt listed.** `next lint` invalidates part of
`.next`, and `lib/track-build-output.test.ts` (8 cases) plus the repository-boundary scan (TC-60)
skip themselves rather than assert against stale build output. Running `test:run` before `build`
reports `2411 passed | 10 skipped` — green, with the ten cases that read real build output never
executed. Running it last is what makes TC-60 a result rather than a claim.

## Summary

**71 planned cases: 71 passed, 0 failed, 0 skipped.** One planned case (TC-69) failed on first
run and was fixed rather than deferred; one defect outside the plan was found in a screenshot and
fixed, with cases added for it.

Shippable. The one thing a reader should carry away is that the reported free-shipping defect was
not one — the gap was already read against the selling price and is correctly indifferent to the
online-payment discount — and that the two real defects found in its neighbourhood were a sticky
panel that had never stuck and a receipt quoting a total nobody was charged.
