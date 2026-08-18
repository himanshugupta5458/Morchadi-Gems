# Test Plan: Cart line keys and product options

- **Scope:** the identity of a cart line once a product can be bought in more than one
  configuration — `lineKey`, the selection helpers in `lib/options.ts`, the option paths
  through `lib/cart.ts`, the checkout bundle, and the order-side validation and metadata in
  `lib/order-options.ts`. It also covers the *absence* of an effect: that no amount anywhere
  changes because of a selection.

  Covers the rendered behaviour of the selectors, the cart line echo and the personalized
  note, at the level of what a shopper can see and click.

  **Not covered:** the appearance of the chips and select (that is `/style-guide`'s job, by
  eye), the live Cashfree round trip with `order_tags` attached (sandbox, manual), and the
  fulfilment message that will read the recorded choices — that does not exist yet.
- **Prerequisites:** none. Every case is a unit or component test against fixtures; no
  network, no credentials, no seed data.

Decisions under test: [ADR-019](../decisions/ADR-019-product-options.md).

## Cases

### Line identity — `lineKey`

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | No selection | `lineKey("P001")` | The product id alone | Automated |
| TC-02 | Empty selection | `lineKey("P001", {})` | The product id alone — indistinguishable from TC-01 | Automated |
| TC-03 | Two values of one group | Key `{Letter:"A"}` against `{Letter:"B"}` | Different keys | Automated |
| TC-04 | Record order | Key `{Letter,Colour}` against `{Colour,Letter}` | Same key | Automated |
| TC-05 | Two products, one choice | Key `P001 {Letter:"A"}` against `P005 {Letter:"A"}` | Different keys | Automated |
| TC-06 | Separator injection | Value `"A\|Colour=Golden"` against two real groups | Different keys — the key is injective | Automated |

### Selection resolution and staleness

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-07 | Defaults | `defaultSelectedOptions` on a two-group product | First value of each group | Automated |
| TC-08 | No options | `defaultSelectedOptions(undefined)` and `([])` | `undefined`, never `{}` | Automated |
| TC-09 | Valid request kept | Resolve `{Letter:"C",Colour:"Golden"}` | Unchanged | Automated |
| TC-10 | Missing group filled | Resolve `{Letter:"B"}` on a two-group product | `Colour` takes its default | Automated |
| TC-11 | Unoffered value | Resolve `{Letter:"Z"}` | Falls back to the default | Automated |
| TC-12 | Unknown group | Resolve `{Letter:"B",Size:"Large"}` | `Size` dropped | Automated |
| TC-13 | Catalogue order | Resolve a reversed record | Keys come back in catalogue order | Automated |
| TC-14 | Stale value | `isSelectionStale` after a value is withdrawn | `true` | Automated |
| TC-15 | Stale group | `isSelectionStale` after a group is renamed | `true` | Automated |
| TC-16 | Options removed entirely | `isSelectionStale(undefined, {Letter:"A"})` | `true` | Automated |
| TC-17 | Incomplete is not stale | `isSelectionStale` with one of two groups | `false` — a default waits to be filled | Automated |
| TC-18 | Hostile stored selection | `parseSelectedOptions` on a string, an array, `null`, mixed types | Only string→string pairs survive; `undefined` when none do | Automated |

### Cart behaviour

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-19 | Add without touching a selector | `addProductToCart(entry)` on an optioned product | Line carries the defaults | Automated |
| TC-20 | Multi-group defaults | Same, two groups | Both groups defaulted | Automated |
| TC-21 | Option-less product untouched | Add a plain product | No `selectedOptions` key at all | Automated |
| TC-22 | Two selections | Add `Letter:A` then `Letter:B` | Two lines | Automated |
| TC-23 | Same selection | Add `Letter:B` ×2 then ×3 | One line, qty 5 | Automated |
| TC-24 | Defaults merge with explicit equal selection | Add default, then add `{Letter:"A"}` | One line, qty 2 | Automated |
| TC-25 | Clamp on merge | Add `MAX_QUANTITY` twice, same selection | Clamped at `MAX_QUANTITY` | Automated |
| TC-26 | Unoffered value at add time | Add `{Letter:"Z"}` | Recorded as the default | Automated |
| TC-27 | Key stability through the cart | Add the same selection two key orders | Identical `cartItemKey` | Automated |
| TC-28 | Remove one line | Remove by the `Letter:A` key | Only that line goes | Automated |
| TC-29 | Set quantity on one line | Set qty on the `Letter:B` key | Only that line changes | Automated |
| TC-30 | Lines carry their key and selection | `buildCartLines` on a two-selection cart | `key` and `selectedOptions` on each line | Automated |

### The money is untouched

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-31 | Two selections vs two of one | Totals for `A×1 + B×1` against one line of qty 2 | Identical subtotal, shipping, total | Automated |
| TC-32 | Value does not price | Totals for `A×3` against `C×3` | Identical, and `price × 3` | Automated |
| TC-33 | Badge count | `countCartItems` across two selections | Sum of quantities | Automated |
| TC-34 | Line pricing source | `unitPrice` / `lineTotal` on a personalized line | Straight from the catalogue entry | Automated |
| TC-35 | Bundle totals | `buildCheckoutData` for two selections against one merged line | Identical amounts | Automated |
| TC-36 | Merged order pricing | `buildOrderFromCart` on merged lines against one line of the summed qty | Identical total | Automated |

### Pruning a persisted cart

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-37 | Withdrawn value | Reconcile a `Letter:C` line against a catalogue offering A and B | Line dropped | Automated |
| TC-38 | Removed group | Reconcile against a catalogue whose group was renamed | Line dropped | Automated |
| TC-39 | Options removed entirely | Reconcile against a product that no longer has options | Line dropped | Automated |
| TC-40 | Sibling survives | Two lines, one stale | The valid one is kept, unchanged | Automated |
| TC-41 | Line predating the group | Reconcile a line with no selection against a product that now has one | Kept, defaulted | Automated |
| TC-42 | Duplicate merge by key | Two `Letter:A` lines and one `Letter:B` | Two lines; the `A`s summed | Automated |
| TC-43 | Persisted round trip | Read a stored cart back out of `localStorage` | Selections intact | Automated |
| TC-44 | Unreadable stored selection | Stored `selectedOptions: "Letter=B"` | Line kept without a selection, then defaulted on reconcile | Automated |

### Checkout and order

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-45 | Bundle carries selections | `buildCheckoutData` on two selections | Both recorded | Automated |
| TC-46 | Bundle keeps lines separate | Same | Two entries, one product id | Automated |
| TC-47 | Plain product in the bundle | `buildCheckoutData` on a plain line | No `selectedOptions` | Automated |
| TC-48 | `sessionStorage` round trip | Stringify and `parseCheckoutData` | Selection intact | Automated |
| TC-49 | Tampered stored selection | Replace a selection with a string | Bundle still parses; that line loses its selection | Automated |
| TC-50 | Merge for pricing | `mergeOrderItemsByProduct` on two selections | One item, quantities summed | Automated |
| TC-51 | No options reach the pricing core | Same | Merged item has no `selectedOptions` | Automated |
| TC-52 | Quantity cap survives the merge | `MAX_QUANTITY` + 1 across two lines | `INVALID_QUANTITY`, order refused | Automated |
| TC-53 | Summary of one line | `validateOrderLineOptions` | `P001:Letter=B` | Automated |
| TC-54 | Summary skips plain lines | Mixed cart | Only optioned lines appear, in cart order | Automated |
| TC-55 | Defaulted line summarised | Optioned line sent with no selection | Default recorded | Automated |
| TC-56 | Nothing to record | Order of plain products | Empty summary, no errors | Automated |
| TC-57 | Withdrawn value at order time | Selection the catalogue no longer offers | `INVALID_OPTION`, no summary — never substituted | Automated |
| TC-58 | Selection on a plain product | `{Letter:"A"}` on a product with no options | `INVALID_OPTION` | Automated |
| TC-59 | Unknown product | Option check on an id not in the catalogue | Silent — the pricing core reports it once | Automated |
| TC-60 | Every bad line reported | Two invalid selections | Two errors | Automated |
| TC-61 | Two lines of one product | Both valid | Both in the summary | Automated |
| TC-62 | Untrusted body | `parseOrderItems` then validate | Selection survives parsing and is checked | Automated |
| TC-63 | Short summary | `toOrderOptionTags` | One `options` tag | Automated |
| TC-64 | Long summary | 25 lines | Split across `options` and `options_2`; nothing lost | Automated |
| TC-65 | Tag value limit | 200 lines | Every value ≤ 255 characters | Automated |
| TC-66 | Overflow is admitted | 200 lines | Three tags, the last ending `+N more` | Automated |
| TC-67 | Nothing to tag | Empty summary | `{}` — the request body is unchanged from before options | Automated |

### What a shopper sees

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-68 | Long list layout | Render a product with 8 letters | A `<select>`, defaulted to the first value, with every value as an option | Automated |
| TC-69 | Short list layout | Render a two-value colour group | Radios, the first checked | Automated |
| TC-70 | Default is visible | Render without interacting | `Letter: A` shown next to the buy actions | Automated |
| TC-71 | Changed selection is visible | Change the select to `C` | `Letter: C` shown | Automated |
| TC-72 | Note and policy link | Render an optioned product | The note, and a `Refund policy` link to `/refund` | Automated |
| TC-73 | Plain product unchanged | Render an option-less product | No selector, no radios, no note | Automated |
| TC-74 | Add with defaults | Add without touching the selector | One cart line reading `Letter: A` | Automated |
| TC-75 | Two selections, two lines | Add `A`, change to `D`, add | Two cart lines, each showing its letter | Automated |
| TC-76 | Same selection increments | Add twice | One line, "2 pieces in your cart" | Automated |
| TC-77 | Totals unaffected on screen | Add two different letters | Cart shows the two-piece total | Automated |
| TC-78 | Note on the cart line | Add a personalized piece | The note appears on that line | Automated |
| TC-79 | Remove one line | Remove by the line's accessible name | Only that line goes | Automated |
| TC-80 | Edit one line's quantity | Step up the `Letter: B` line | Only that line's quantity changes | Automated |
| TC-81 | Persistence per line | Add two letters | `localStorage` holds two selections | Automated |
| TC-82 | Plain cart line | Add an option-less product | No choice line, no note | Automated |
| TC-83 | Confirmation receipt | Render a paid confirmation with two personalized lines | Both letters listed under the product name | Automated |

### Regression — the ninety-six unchanged products

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-84 | The pre-existing suite | Run every test written before this feature | All pass unmodified | Automated |
| TC-85 | Rendered product pages | Build and read the static HTML for the four optioned products and a plain one | Selectors and note on the four, nothing on the plain page | Manual |
