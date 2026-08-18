# Test Result: Order pricing and creation — 2026-08-17

- **Plan:** [PLAN-order-pricing.md](PLAN-order-pricing.md)
- **Commit:** `d2f4f96` plus the prompt-12 working tree (nothing after the initial commit has
  been committed)
- **Environment:** local, `next start` against a production build (Next.js 14.2.35, Node
  runtime). Cashfree **sandbox**, reached with deliberately invalid credentials — no real
  payment was attempted and no valid Cashfree credentials exist in this environment.

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | `2 × ₹1000 + 3 × ₹250 = ₹2750`, `+ ₹99` shipping |
| TC-02 | Pass | Line item deep-equals the expected object; no extra keys |
| TC-03 | Pass | Shipping is `₹99` for both the one-line and the two-line order |
| TC-04 | Pass | qty 1 and qty 10 both valid; qty 10 prices at `₹10,000` |
| TC-05 | Pass | Items carrying `price: 1`, `lineTotal: 1`, `total: 1` priced at `₹1250 + ₹99` |
| TC-06 | Pass | `mrp: 250000` on a `₹500` piece; subtotal `₹1000` |
| TC-07 | Pass | `name: "Free Necklace"`, `price: 0` replaced by the catalogue's values |
| TC-08 | Pass | `EMPTY_CART`, `productId: null` |
| TC-09 | Pass | `UNKNOWN_PRODUCT` |
| TC-10 | Pass | `OUT_OF_STOCK` |
| TC-11 | Pass | Message contains "Temple Gold Ring"; `productId: "rg-001"` |
| TC-12 | Pass | qty 0 → `INVALID_QUANTITY` |
| TC-13 | Pass | qty 11 → `INVALID_QUANTITY` |
| TC-14 | Pass | qty −3 → `INVALID_QUANTITY` |
| TC-15 | Pass | qty 1.5 → `INVALID_QUANTITY` |
| TC-16 | Pass | `NaN` → `INVALID_QUANTITY` |
| TC-17 | Pass | `Infinity` → `INVALID_QUANTITY` |
| TC-18 | Pass | Two lines of the same id at qty 10 → `DUPLICATE_PRODUCT`, not a 20-unit order |
| TC-19 | Pass | Three errors, in request order, each with the right `productId` |
| TC-20 | Pass | `lineItems: []`, subtotal/shipping/total all `0` |
| TC-21 | Pass | Empty catalogue refuses everything |
| TC-22 | Pass | `price` and `name` dropped by `parseOrderItems` |
| TC-23 | Pass | All seven malformed payloads return null |
| TC-24 | Pass | `qty: "10"` → `NaN` → `INVALID_QUANTITY` against that product |
| TC-25 | Pass | `[]` parses to `[]`, then refuses as `EMPTY_CART` |
| TC-26 | Pass | `400 {"error":"REQUEST_MALFORMED",...,"retryable":false}` |
| TC-27 | Pass | `400 ITEMS_INVALID` with `UNKNOWN_PRODUCT` for `ghost-999` and `INVALID_QUANTITY` for `nk-001` |
| TC-28 | Pass | `nk-006` → `OUT_OF_STOCK`, "Jadau Emerald Collar Necklace sold out and cannot be ordered." |
| TC-29 | Pass | Seven field messages returned, character-identical to the `/address` strings |
| TC-30 | Pass | Absent `address` treated as an empty one; every field reports its "enter a…" message |
| TC-31 | Pass | `503 PAYMENT_NOT_CONFIGURED`; no outbound request made |
| TC-32 | Pass | `502 PAYMENT_GATEWAY_UNAVAILABLE`, `retryable: true`. Server log: `[create-order] MG_1786968394909_v8j3wggq rejected by Cashfree with 401: {"message":"authentication Failed",...}`. None of that text is in the response body |
| TC-33 | Pass | `cache-control: no-store` observed on the 503 and on every other response |
| TC-34 | Pass | No match for `CASHFREE_`, `X-Client-Secret`, `CASHFREE_APP_ID`, `sandbox.cashfree.com/pg` or `api.cashfree.com/pg` anywhere in `.next/static`. The only Cashfree string in any client chunk is the public loader URL `https://sdk.cashfree.com/js/v3/cashfree.js`, in the separate chunk created by the dynamic import |
| TC-35 | Pass | Adding `readCashfreeCredentials()` to `PaymentCheckout.tsx` failed the build: *"You're importing a component that needs server-only."* Reverted immediately |
| TC-36 | Pass | Served HTML for `/payment` contains "Loading your order…" and no rupee amount and no Pay button |

## Failures

None.

## Summary

**36 passed, 0 failed, 0 skipped.**

Automated: `lib/order.test.ts` — **31 tests, all passing**. Whole suite:
**260 tests across 10 files**, all passing (229 before this prompt). `npm run validate:products` PASS,
`tsc --noEmit` clean, `next lint` clean, `next build` clean.

Shippable **for what this prompt covers**: the route creates and prices orders correctly and
refuses every hostile input tried. It is *not* a complete checkout — `return_url` points at
`/order-confirmation`, which does not exist, so a sandbox payment completed right now lands
on a 404. That is the intended checkpoint; verification and the confirmation page are the
next prompt.

One thing this run could not check: a real Cashfree session. TC-32 proves the request is
well-formed enough for Cashfree to authenticate it and reject the credentials, which
exercises every line of the route except reading `payment_session_id` out of a success body.
The first real sandbox payment will be the first exercise of that line and of
`cashfree.checkout()`.
