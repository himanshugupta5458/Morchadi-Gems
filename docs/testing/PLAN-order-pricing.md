# Test Plan: Order pricing and creation

- **Scope:** the server-side pricing core (`buildOrderFromCart`, `parseOrderItems` in
  `lib/order.ts`) and the request-validation behaviour of `POST /api/create-order`. This is
  the money path — every case here exists because getting it wrong charges someone the wrong
  amount, or charges them for something they cannot receive.

  **Not covered:** a real Cashfree payment (needs sandbox credentials and a browser),
  payment verification and the confirmation page (they do not exist yet — the next prompt),
  and the Cashfree browser SDK's own redirect behaviour. Cart arithmetic has its own plan
  ([PLAN-cart-logic.md](PLAN-cart-logic.md)); address validation has
  [PLAN-address-validation.md](PLAN-address-validation.md), and this plan only checks that
  the route reuses it rather than re-testing the rules.

- **Prerequisites:** none for the automated cases — `buildOrderFromCart` is pure and takes its
  catalogue as an argument. The route cases need a running build; the ones that reach Cashfree
  need `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` set, and dummy values are enough to prove
  the failure path.

## Cases

### The pricing core — a valid order

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | Multi-item order priced from the catalogue | Two products, qty 2 and 3, against a known catalogue | `valid`, subtotal is the sum of `catalogue.price × qty`, shipping is `FLAT_SHIPPING_RATE`, total is their sum | Automated |
| TC-02 | Line items echo catalogue values | One product, qty 4 | Line item carries the catalogue's id, name, unit price, qty and `price × qty` | Automated |
| TC-03 | Shipping is per order, not per line | One-line order vs two-line order | Both charge shipping exactly once | Automated |
| TC-04 | Quantity bounds are inclusive | qty at `MIN_QUANTITY` and at `MAX_QUANTITY` | Both valid; the max-quantity order prices at `10 × price` | Automated |

### The pricing core — the server is the only source of prices

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-05 | A client-supplied amount is irrelevant | Items carrying `price: 1`, `lineTotal: 1`, `total: 1`, `price: 0` | Total is computed from the catalogue and the supplied amounts change nothing | Automated |
| TC-06 | `mrp` never becomes a charge | Catalogue entry with `price: 500` and `mrp: 250000`, qty 2 | Subtotal is 1000 | Automated |
| TC-07 | Client-supplied names and prices are stripped | Item carrying `name: "Free Necklace"`, `price: 0` | Line item carries the catalogue's name and price | Automated |

### The pricing core — refusals

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-08 | Empty order | `items: []` | Invalid, one `EMPTY_CART` error with a null `productId` | Automated |
| TC-09 | Unknown product id | An id not in the catalogue | Invalid, `UNKNOWN_PRODUCT` | Automated |
| TC-10 | Sold-out product | A product with `inStock: false` | Invalid, `OUT_OF_STOCK` | Automated |
| TC-11 | The sold-out error names the piece | Same as TC-10 | Error message contains the product name; `productId` identifies it | Automated |
| TC-12 | Quantity 0 | qty 0 | Invalid, `INVALID_QUANTITY` | Automated |
| TC-13 | Quantity above the maximum | qty 11 | Invalid, `INVALID_QUANTITY` | Automated |
| TC-14 | Negative quantity | qty −3 | Invalid, `INVALID_QUANTITY` | Automated |
| TC-15 | Fractional quantity | qty 1.5 | Invalid, `INVALID_QUANTITY` | Automated |
| TC-16 | `NaN` quantity | qty `NaN` | Invalid, `INVALID_QUANTITY` | Automated |
| TC-17 | Infinite quantity | qty `Infinity` | Invalid, `INVALID_QUANTITY` | Automated |
| TC-18 | Repeated product id | The same id twice, each at the maximum quantity | Invalid, `DUPLICATE_PRODUCT` — not merged into 20 | Automated |
| TC-19 | Mixed order collects every fault | One good line, one unknown id, one sold out, one over-quantity | Invalid with all three errors, in request order, each attributed to its product | Automated |
| TC-20 | A refusal carries no money | An order with one good and one sold-out line | `lineItems` empty; subtotal, shipping and total all 0 | Automated |
| TC-21 | Empty catalogue | A valid-looking item against `[]` | Invalid | Automated |

### Untrusted input parsing

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-22 | Extra fields are dropped | `{ productId, qty, price, name }` | Only `productId` and `qty` survive | Automated |
| TC-23 | Structurally wrong payloads | Not an array; null; a string; array of strings; missing `productId`; empty `productId`; numeric `productId` | Each returns null so the route answers `REQUEST_MALFORMED` | Automated |
| TC-24 | Non-numeric quantity | `qty: "10"` | Becomes `NaN` and is refused as `INVALID_QUANTITY` against that product, not as a malformed request | Automated |
| TC-25 | Empty array | `[]` | Parses to `[]` — an empty order, not a malformed one | Automated |

### The route

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-26 | Unparseable body | POST `not json` | 400 `REQUEST_MALFORMED`, `retryable: false` | Manual |
| TC-27 | Bad items surface as structured detail | POST an unknown id and a qty of 0 with a valid address | 400 `ITEMS_INVALID` with one `details` entry per fault | Manual |
| TC-28 | A genuinely sold-out catalogue product | POST the real sold-out id from `data/products.json` | 400 `ITEMS_INVALID`, `OUT_OF_STOCK`, naming the piece | Manual |
| TC-29 | Invalid address is caught server-side | POST valid items with a 3-digit phone, a bogus state, a PIN starting with 0 | 400 `ADDRESS_INVALID` with per-field messages identical to `/address`'s | Manual |
| TC-30 | Missing address entirely | POST valid items with no `address` key | 400 `ADDRESS_INVALID` with the "enter a…" messages for every field | Manual |
| TC-31 | Missing credentials | POST a valid order with `CASHFREE_APP_ID` unset | 503 `PAYMENT_NOT_CONFIGURED`, `retryable: false`, no Cashfree call attempted | Manual |
| TC-32 | Cashfree rejects the request | POST a valid order with deliberately wrong credentials | 502 `PAYMENT_GATEWAY_UNAVAILABLE`, `retryable: true`; the upstream 401 body appears in the **server log only** | Manual |
| TC-33 | Caching | Inspect response headers | `Cache-Control: no-store` on every response | Manual |

### Secret containment and the payment page

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-34 | No secret in the client bundle | Grep `.next/static` for `CASHFREE_`, `X-Client-Secret`, and the Cashfree API hosts | No match | Manual |
| TC-35 | `server-only` is enforced, not decorative | Import `lib/cashfree-config.ts` into a `"use client"` component and build | Build fails with the server-only error | Manual |
| TC-36 | No payment UI before hydration | Fetch `/payment` from the production build and read the served HTML | Contains the loading line and no amount, no Pay button | Manual |
