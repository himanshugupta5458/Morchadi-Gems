# Test Plan: Free-shipping threshold

- **Scope:** the shipping rule introduced in
  [ADR-015](../decisions/ADR-015-business-config-and-shipping-threshold.md) — free at or
  above `FREE_SHIPPING_THRESHOLD` (₹799), `FLAT_SHIPPING_RATE` (₹99) below it — as applied by
  both pricing paths: `calculateCartTotals` in `lib/cart.ts` (what the shopper is shown) and
  `buildOrderFromCart` in `lib/order.ts` (what is charged). The point of the plan is that
  those two must never disagree, and that the inclusive boundary is inclusive in both.

  **Not covered:** the rest of cart arithmetic ([PLAN-cart-logic.md](PLAN-cart-logic.md)) and
  the rest of order pricing ([PLAN-order-pricing.md](PLAN-order-pricing.md)), both of which
  still hold. A real Cashfree payment at each side of the boundary — the amount Cashfree is
  asked for comes from `buildOrderFromCart`, which is covered here, but no sandbox credentials
  exist in this environment.

- **Prerequisites:** none. Both functions are pure and take their catalogue as an argument.
  The boundary amounts are out of reach of the shared fixtures because `MAX_QUANTITY` is 10,
  so the boundary cases price a single piece at the amount under test.

## Cases

### The boundary, in both pricing paths

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | Subtotal ₹798 in the cart | `calculateCartTotals` on one piece priced 798 | `shipping: 99`, `total: 897` | Automated |
| TC-02 | Subtotal ₹799 in the cart | same at 799 | `shipping: 0`, `total: 799` — inclusive | Automated |
| TC-03 | Subtotal ₹800 in the cart | same at 800 | `shipping: 0`, `total: 800` | Automated |
| TC-04 | Subtotal ₹798 on the server | `buildOrderFromCart` on one piece priced 798 | `valid`, `shipping: 99`, `total: 897` | Automated |
| TC-05 | Subtotal ₹799 on the server | same at 799 | `valid`, `shipping: 0`, `total: 799` — inclusive | Automated |
| TC-06 | Subtotal ₹800 on the server | same at 800 | `valid`, `shipping: 0`, `total: 800` | Automated |

### Empty and unpayable carts

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-07 | Empty cart | `calculateCartTotals([])` | `{subtotal: 0, shipping: 0, total: 0}` — not the flat rate | Automated |
| TC-08 | Every line sold out | cart holds only an `inStock: false` piece | `{subtotal: 0, shipping: 0, total: 0}` | Automated |
| TC-09 | Orphaned item | cart holds an id absent from the catalogue | `{subtotal: 0, shipping: 0, total: 0}` | Automated |
| TC-10 | Rejected order | `buildOrderFromCart` with a sold-out line among valid ones | every amount zeroed, `shipping: 0` | Automated |

### Shipping is charged once, and on the payable subtotal only

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-11 | Several below-threshold lines | ₹250 + ₹100 in one order | `shipping: 99` once, not per line | Automated |
| TC-12 | Combined subtotal crosses the threshold | ₹2000 + ₹1000 in one cart | `shipping: 0` — the rule reads the combined subtotal | Automated |
| TC-13 | A sold-out line cannot buy free shipping | ₹250 payable plus 10 × ₹700 sold out | `subtotal: 250`, `shipping: 99` | Automated |
| TC-14 | Line count is irrelevant | two cheap lines vs one expensive line | `99` and `0` respectively | Automated |

### The trust boundary

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-15 | Client-sent amounts | items carrying `price`, `lineTotal`, `total` | ignored; shipping derived from the catalogue subtotal | Automated |
| TC-16 | `mrp` cannot cross the threshold | a ₹500 piece with `mrp: 250000`, qty 2 | `subtotal: 1000`, priced from `price` | Automated |
| TC-17 | One source constant | assert `FLAT_SHIPPING_RATE === 99` and `FREE_SHIPPING_THRESHOLD === 799` | both read from `lib/config.ts`, not written into the math | Automated |

### Display

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-18 | Free shipping on `/cart` | hydrate a cart whose subtotal is ₹2,000 | shipping row reads `FREE`; no `₹2,099` anywhere | Automated |
| TC-19 | Free shipping on `/address` | same cart, address step | summary reads `FREE`; bundle written with `shipping: 0` | Automated |
| TC-20 | Copy is built from the constants | serve the build and read the HTML | `/`, `/shipping`, `/terms`, `/about` all say free over ₹799, ₹99 below, India only | Manual |
