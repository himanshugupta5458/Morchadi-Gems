# Test Plan: Checkout flow polish — cart, address, payment, confirmation

- **Scope:** the four screens that carry an order from a basket to a placed order. The
  free-shipping gap's arithmetic; the cart's savings breakdown, progress bar, cross-sell rail,
  cash-on-delivery line and undo toast; the stripped `/address` and `/payment` shell; the payment
  step's copy, saving line and gift note; the confirmation screens' two fine-print lines, copy
  button, email note and receipt total.
- **Not in scope:** discount codes (parked), international pricing (its own prompt), the shop,
  home, product and `/track` pages (prompts 114 and 115), and any real courier integration —
  the delivery estimate is static text from `DELIVERY_ESTIMATE_LINE`.
- **Prerequisites:** Postgres at `DATABASE_URL` (`docker compose up -d`) for the capture and
  admin cases; `CASHFREE_APP_ID`/`CASHFREE_SECRET_KEY` in sandbox and `ADMIN_USERNAME`/
  `ADMIN_PASSWORD` for the manual pass. `RESEND_API_KEY` is **not** set in this environment,
  which is itself one of the cases (TC-33).

## Cases

### The free-shipping gap — the reported defect

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | The gap is read against the selling price, not the compare-at price | A ₹400/₹900 line; compare `amountToFreeShipping(subtotal)` with `amountToFreeShipping(mrpSubtotal)` | The gap is `799 − 400`; the two differ | Automated |
| TC-02 | A cart whose MRP already clears the threshold still pays shipping and is still asked for the shortfall | Same cart | `shipping === FLAT_SHIPPING_RATE`, gap `> 0` | Automated |
| TC-03 | The gap is the exact complement of what shipping charges | Sweep 0, 1, 100, threshold−1, threshold, 5000 | `gap === 0` exactly when `shipping === 0`; otherwise `subtotal + gap === threshold` | Automated |
| TC-04 | The gap does **not** move when the online-payment discount applies | Resolve a `full` plan on a COD-eligible cart | `plan.onlineDiscount > 0`, `plan.total` reduced, gap unchanged | Automated |
| TC-05 | Reading the gap against the discounted total would over-promise | A cart at exactly the threshold | Shipping is free and the gap is 0, while a gap on the discounted total would be `> 0` | Automated |
| TC-06 | Changing the threshold at source moves the progress bar's words and its bar together | Mock `config/site-facts.mjs` to 1499 | Both the sentence and `aria-valuenow` move | Automated |

### The cart page

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-07 | The savings breakdown states MRP and the saving | One ₹400/₹900 line | "Subtotal (MRP) ₹900", "You save −₹500" | Automated |
| TC-08 | The saving sums across lines and does not touch the total | Two discounted + one full-price line | MRP ₹2,050, saving −₹1,000, total ₹1,050, shipping FREE | Automated |
| TC-09 | An undiscounted cart shows one plain subtotal row | One full-price line | "Subtotal" only; no MRP row, no saving row | Automated |
| TC-10 | The old trust line is gone and the strip replaces it | Render the cart | No "Prices are confirmed against the catalogue"; gateway, returns window and coverage all from config | Automated |
| TC-11 | The delivery estimate is the same one the rest of checkout states | Render the cart | `DELIVERY_ESTIMATE_LINE` present | Automated |
| TC-12 | Continue shopping is demoted | Render the cart | It is a link to `/shop` carrying no primary-button classes; Proceed to checkout carries them | Automated |
| TC-13 | Cash on delivery is offered when every piece qualifies | `codCatalogue` all zero floors | The COD-available sentence | Automated |
| TC-14 | It is withdrawn for the whole order when one piece requires prepayment | One floor raised | The paid-online sentence | Automated |
| TC-15 | The progress bar draws against the charged subtotal | ₹400 line | `aria-valuenow = round(400/799 × 100)`; the shortfall named | Automated |
| TC-16 | It says so plainly once the threshold is reached | ₹1,050 cart | "Free shipping unlocked."; no "for free shipping." | Automated |

### The undo toast

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-17 | Removing a line offers a way back | Click × on a personalised line | The line goes; a toast with an Undo button appears | Automated |
| TC-18 | Undo restores the exact line | Click Undo | Same quantity (3), same choices (`Letter: B`), same position (first) | Automated |
| TC-19 | Taking the offer dismisses the toast | Click Undo | No toast, no Undo button | Automated |
| TC-20 | Letting it expire genuinely removes the line | Advance past `TOAST_ACTION_DURATION_MS` | The line is gone from state *and* from `localStorage` | Automated |
| TC-21 | `restoreCartItem`'s own rules | Unit: position, quantity, choices, append past the end, merge into a re-added line, clamp | All six | Automated |

### The stripped checkout shell

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-22 | `/address` and `/payment` are served from the checkout group at the same URLs | File existence + a real `GET` | Present under `app/(checkout)`, absent under `app/(storefront)`, both `200` | Automated + Manual |
| TC-23 | The checkout shell renders no shop chrome | Render the layout | No `wa.me`, no category menu, no collections menu, no About, no Contact | Automated |
| TC-24 | It still offers the policies and a person to reach | Render the layout | `/shipping`, `/refund`, the support address | Automated |
| TC-25 | The header carries the logo, the step indicator and one link back | Render at steps 1 and 2 | All three, `aria-current="step"` set | Automated |
| TC-26 | It offers no other way out of the funnel | Collect every `href` in the header | Exactly `/` and `/cart` | Automated |
| TC-27 | Both shells share the providers rather than restating them | Read both layouts | Each names `ShopProviders`, neither names `CartProvider` | Automated |
| TC-28 | The confirmation screen keeps the full shop chrome | `GET /order-confirmation` | Shop nav and WhatsApp present | Automated + Manual |

### The payment step

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-29 | The security sentence is trimmed | Render | The short sentence present; "every amount below is confirmed by our server" absent | Automated |
| TC-30 | No free-shipping nudge, this late | Render | No "for free shipping" | Automated |
| TC-31 | The saving line uses the same figure as the discount row | Render a COD-eligible cart | "Online payment discount (5%) −₹50" and "You are saving ₹50 … by paying online." | Automated |
| TC-32 | It is withdrawn on cash on delivery, and absent on a cart that earns none | Select COD; then a prepayment-floor cart | No "by paying online" in either | Automated |
| TC-33 | The trust content states the methods and names no logo it does not have | Render | UPI / Cards / Net banking / Wallets as text, "Processed by Cashfree Payments", the delivery estimate, the trust strip | Automated |

### The gift note

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-34 | The field is capped at the length the column holds | Render | `maxLength === 300`, "300 characters left" | Automated |
| TC-35 | It travels in the create-order request and names no amount | Type a note, pay | `giftMessage` in the body; no `total`, `subtotal` or `amount` anywhere in it | Automated |
| TC-36 | It is omitted entirely when nothing was typed | Pay without typing | No `giftMessage` key | Automated |
| TC-37 | `parseGiftMessage`'s own rules | Unit: kept as written, newlines survive, control characters dropped, trimmed, whitespace → null, truncated at 300, non-strings → null | All seven | Automated |
| TC-38 | It is written to the order and read back on the admin detail | Real COD order through the route | `orders.gift_message` matches; `findAdminOrderDetail().giftMessage` matches | Automated |
| TC-39 | An order placed without one leaves the column null | Real COD order | `NULL` in the row and on the detail | Automated |
| TC-40 | It charges exactly the same with a note as without | Two real orders | Identical subtotal, shipping, total, amount due | Automated |
| TC-41 | **A hostile note cannot move the total** | Real orders with a 10,000-char note, a JSON-shaped note, an object, a number and `null` | Every row's total identical to the plain order's | Automated |
| TC-42 | An oversized note truncates rather than failing the order | 10,000 characters | Order placed; column holds exactly 300 | Automated |
| TC-43 | A whitespace-only note is no note | `"    \n  "` | `NULL` | Automated |
| TC-44 | An operator can see it while packing | Log in, open the order detail | The "Gift message" panel, newline preserved | Manual |

### The confirmation screens

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-45 | **The COD screen's internal reference is gone** | A placed COD order | `COD_…` appears nowhere on the placed screen | Automated + Manual |
| TC-46 | It survives where it is the only identifier there is | The still-looking state | "Order reference COD_…" present | Automated |
| TC-47 | **The prepaid screen's payment reference is unchanged** | A PAID order | "Payment reference MG_…" present | Automated + Manual |
| TC-48 | The order number can be copied in one click | Either screen | A "Copy order number …" button | Automated + Manual |
| TC-49 | The COD screen sets the expectation for the door | A COD order owing ₹2,099 | "Our courier will call before delivery. Please keep ₹2,099 in cash ready, and exact change helps." | Automated |
| TC-50 | The email note names the address and claims only an attempt | Bundle with an email | "A copy of this order is on its way to …"; the string "has been sent" appears nowhere | Automated |
| TC-51 | It claims nothing when no address travelled with the order | Bundle with an empty email | The line is absent | Automated |
| TC-52 | No free-shipping nudge post-purchase | Either screen | No "for free shipping" | Automated + Manual |
| TC-53 | A cross-sell rail from the order's own shelf | Either screen | Four cards, same category | Automated + Manual |
| TC-54 | **The receipt totals what was charged** | A discounted PAID order (₹450 + ₹99, charged ₹526) | Receipt total ₹526, not ₹549 | Automated |
| TC-55 | …and shows the rebate as its own row | Same | "Online payment discount −₹23" | Automated |
| TC-56 | An undiscounted receipt is unchanged | ₹2,099 charged | Total ₹2,099, no discount row | Automated |

### The boundary the cross-sell rails created

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-57 | No shopper-facing client module reaches the catalogue | Walk every `"use client"` module's value-import graph | Nothing reaches `lib/products.ts` or `data/products.json` | Automated |
| TC-58 | `ProductCard` imports its projections from the catalogue-free module | Read the source | `@/lib/product-view`, never `@/lib/products` | Automated |
| TC-59 | The shortlists carry nothing a browser may not hold | Serialise them | No `cost`, `migrationProvenance`, `primaryKeyword`, `minPrepaidAmount` or `description` | Automated |
| TC-60 | No built client chunk carries a cost figure | `npm run build`, then the existing repository-boundary scan | Pass | Automated |

### Cross-sell selection

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-61 | An empty basket has no answer | `[]` | `null` | Automated |
| TC-62 | Value per category beats line count | 3 × ₹200 rings vs 1 × ₹1,200 necklace | `necklaces` | Automated |
| TC-63 | …and beats the most expensive single item | ₹700 bangle vs 2 × ₹500 earrings | `earrings` | Automated |
| TC-64 | A tie breaks on the most valuable single line | 2 × ₹300 rings vs 1 × ₹600 pendant | `pendants` | Automated |
| TC-65 | The answer is a function of the basket, not its order | Reverse the lines | Unchanged | Automated |
| TC-66 | Suggestions come from the basket's own category, exclude it, and fill one row | Real catalogue | Same category, no basket ids, ≤ 4 | Automated |
| TC-67 | Nothing relevant means nothing rendered | Empty basket / empty shortlists | `[]` | Automated |

### The full walk

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-68 | A real browser walk-through of the whole funnel with a discounted piece | Add P002 (₹450 / ₹999) → cart → address → payment → COD order → confirmation | Every assertion above that has a visible form | Manual |
| TC-69 | The summary pins rather than scrolling away | Scroll the cart 400px | The heading stays on screen instead of leaving it | Manual |
| TC-70 | A checkout bar stays reachable at phone width | 375 × 720, scroll 600px | The bar is pinned within the viewport | Manual |
| TC-71 | A **real prepaid sandbox payment**, paid with a Cashfree test card | Pay → OTP → return | Verified `PAID`; the success screen renders with its payment reference intact | Manual |

## Gate

`typecheck`, `lint`, `test:run`, `validate:products`, `build`. **`test:run` is run after
`build`**: `lib/track-build-output.test.ts` and the repository-boundary scan read real build
output and skip themselves when `.next` is stale, so running the suite last is what makes TC-60
actually execute rather than report green while skipping.
