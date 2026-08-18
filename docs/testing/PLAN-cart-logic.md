# Test Plan: Cart logic

- **Scope:** the pure cart functions in `lib/cart.ts` (add, increment, clamp, merge, remove,
  set quantity, prune, parse, totals), and the hydration and persistence behaviour of
  `CartProvider` including the header badge and the `/cart` view.

  Explicitly **not** covered here: server-side price validation and the Cashfree order
  lifecycle, which have no code yet and get their own plan. Visual appearance is not covered —
  no browser is available in this environment.
- **Prerequisites:** none. No env vars, no credentials, no network. `lib/cart.ts` imports no
  product data, so the unit cases run against fixtures rather than the real catalogue; the
  hydration cases run under jsdom.

## Cases

### Adding and merging

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | Add a new product | `addProductToCart([], necklace, 2)` | One line, qty 2, snapshot taken from the catalogue entry | Automated |
| TC-02 | Default quantity | `addProductToCart([], necklace)` | qty 1 | Automated |
| TC-03 | Add an existing product | Add qty 2, then qty 3 | One line at qty 5 — never a second line for the same id | Automated |
| TC-04 | Other lines untouched | Add A, add B(4), add A again | Order preserved, A at 2, B still at 4 | Automated |
| TC-05 | Increment clamps at max | Add at `MAX_QUANTITY`, add 5 more | qty stays at `MAX_QUANTITY` | Automated |
| TC-06 | Single oversized add clamps | `addProductToCart([], necklace, 99)` | qty `MAX_QUANTITY` | Automated |
| TC-07 | Zero / negative quantity | Add with 0, add with -3 | qty `MIN_QUANTITY` in both cases | Automated |
| TC-08 | Out-of-stock refused | `addProductToCart([], soldOutRing, 1)` | Cart unchanged — empty | Automated |
| TC-09 | Snapshot refreshed on increment | Increment a line holding a stale name and price | Name, price and image replaced from the catalogue | Automated |
| TC-10 | Purity | Call add twice against the same array | Input array unmodified | Automated |

### Removing and setting quantity

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-11 | Remove one line | Remove A from a two-line cart | Only B remains | Automated |
| TC-12 | Remove an unknown id | Remove `does-not-exist` | Cart unchanged | Automated |
| TC-13 | Remove the last line | Remove from a one-line cart | Empty cart | Automated |
| TC-14 | Set quantity | `setCartItemQuantity(items, id, 7)` | qty 7 | Automated |
| TC-15 | Set quantity clamps both ends | Set to 50, set to 0 | `MAX_QUANTITY`, then `MIN_QUANTITY` | Automated |
| TC-16 | Set quantity on an unknown id | Set a quantity for an id not in the cart | Cart unchanged | Automated |
| TC-17 | Purity | Set a quantity | Input array unmodified | Automated |
| TC-18 | Item count sums quantities | 3 + 2 across two lines | 5, not 2 | Automated |
| TC-19 | Item count of an empty cart | `countCartItems([])` | 0 | Automated |
| TC-20 | Out-of-stock line still counted | One sold-out line at qty 2 | 2 — the badge reflects what is in the cart | Automated |

### Money

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-21 | Empty cart charges no shipping | Totals for `[]` | subtotal 0, **shipping 0**, total 0 | Automated |
| TC-22 | Single item | One line at ₹1,000 × 1 | subtotal 1000, shipping 99, total 1099 | Automated |
| TC-23 | Quantity multiplies | One line at ₹1,000 × 3 | subtotal 3000 | Automated |
| TC-24 | Shipping charged once across lines | Two payable lines | shipping 99 exactly once | Automated |
| TC-25 | Out-of-stock excluded from totals | One payable + one sold-out line | Sold-out line contributes 0 to subtotal | Automated |
| TC-26 | Cart of only sold-out lines | One sold-out line | subtotal 0, **shipping 0**, total 0 | Automated |
| TC-27 | Price comes from the catalogue | Item whose stored `price` is tampered to 1 | Subtotal uses the catalogue price, not the snapshot | Automated |
| TC-28 | `mrp` never reaches a total | Totals for an item with `mrp` ≠ `price` | Total is derived from `price` only | Automated |
| TC-29 | Orphan item priced at nothing | Item whose id is absent from the catalogue | No line built, totals all 0 | Automated |
| TC-30 | Line shape | Build a line for a payable item | `unitPrice`, `lineTotal`, `isPayable: true` | Automated |
| TC-31 | Unavailable line still has a total | Build a line for a sold-out item | `isPayable: false`, `lineTotal` still computed | Automated |
| TC-32 | Line quantity clamped defensively | Build a line from an unclamped qty 40 | quantity and `lineTotal` clamped | Automated |
| TC-33 | Payable / unavailable split | Mixed cart | `selectPayableLines` and `hasUnavailableLine` agree | Automated |

### Reconciliation against the catalogue

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-34 | Vanished product pruned | Persisted item whose id has left the catalogue | Dropped; the rest survive | Automated |
| TC-35 | Over-max quantity re-clamped | Persisted qty 250 | `MAX_QUANTITY` | Automated |
| TC-36 | Under-min quantity re-clamped | Persisted qty 0 | `MIN_QUANTITY` | Automated |
| TC-37 | Stale snapshot refreshed | Persisted stale name, price, image | All three replaced from the catalogue | Automated |
| TC-38 | Sold-out item kept | Persisted item now `inStock: false` | Kept, and flagged unavailable | Automated |
| TC-39 | Duplicate lines merged | Two persisted lines for one id, 3 + 9 | One line, clamped to `MAX_QUANTITY` | Automated |
| TC-40 | Empty catalogue | Reconcile against `[]` | Empty cart | Automated |
| TC-41 | Purity | Reconcile | Input array unmodified | Automated |

### Reading hostile persisted data

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-42 | Nothing stored | `parsePersistedCart(null)` | `[]` | Automated |
| TC-43 | Unparseable JSON | `"{not json"` | `[]`, no throw | Automated |
| TC-44 | JSON that is not an array | object, string, `null` | `[]` in all three cases | Automated |
| TC-45 | Well-formed cart | Round-trip a real cart | Read back intact | Automated |
| TC-46 | Malformed entries dropped | Empty id, missing qty, missing id, `null`, a bare string, a string qty | Only the valid entry survives | Automated |
| TC-47 | Tampered quantity clamped on read | qty 9999 and qty -4 | `MAX_QUANTITY`, `MIN_QUANTITY` | Automated |
| TC-48 | End-to-end hostile file | Stored file with an unknown id, a stale price and qty 40 | One line, clamped, priced from the catalogue | Automated |
| TC-49 | Shipping rate is config-driven | `FLAT_SHIPPING_RATE` | 99, read from `lib/config.ts` | Automated |

### Hydration, persistence and the cart page

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-50 | Server render ignores storage | Seed storage with 3 items, `renderToString` the header | HTML contains `Cart, empty` and no count | Automated |
| TC-51 | Hydrating a persisted cart is clean | Seed 3 items (one over-max, one vanished, one sold out), server-render, hydrate | No `console.error`; badge reads 11; storage rewritten reconciled | Automated |
| TC-52 | Hydrating an empty cart is clean | Server-render and hydrate with empty storage | No `console.error`; badge stays empty | Automated |
| TC-53 | Badge increments on add | Click Add to cart twice | Badge 1, then 2; storage holds qty 2 | Automated |
| TC-54 | Toast is raised | Click Add to cart | The live region announces "Added to cart" | Automated |
| TC-55 | Cart survives a reload | Add, unmount, mount fresh | Badge reads 1 from storage alone | Automated |
| TC-56 | Cart page hydrates clean when populated | Seed one line, server-render `/cart`'s view, hydrate | No `console.error`; line, line total and total render; checkout links to `/address` | Automated |
| TC-57 | Cart page hydrates clean when empty | Hydrate with empty storage | No `console.error`; empty state; no checkout link | Automated |
| TC-58 | Out-of-stock line blocks checkout | Seed one payable + one sold-out line | "Out of stock" shown, total excludes it, checkout is a **disabled button**; removing the line restores the checkout link | Automated |
| TC-59 | Stepper updates line and summary | Increase quantity on a cart line | Line total and order total both update; storage follows | Automated |

### Adversarial harness check

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-60 | The hydration assertion can fail | Hydrate a component that deliberately renders different text on client and server | `console.error` **is** called — proving TC-51/52/56/57 are not vacuous | Manual (throwaway probe) |
| TC-61 | The eager-read fault is caught | Change `CartProvider` to read `localStorage` in its `useState` initialiser | TC-50 fails | Manual (injected fault) |
