# Test Plan: Product schema migration, option controls, and per-variant media

- **Scope:** the grouped `Product` record and its accessors, the four per-type option
  controls, the multi-image gallery, the per-variant image swap, the cart line's variant
  thumbnail, and the money path's isolation from every one of them. **Not** covered: visual
  appearance (no browser in this environment — assertions are on rendered HTML), and the
  Cashfree round trip, which `PLAN-order-pricing.md` already owns.
- **Prerequisites:** none. Everything runs against the committed `data/products.json` and the
  files in `public/products/`; no env vars and no network.

## Cases

### The migrated catalogue

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | The catalogue is still all-real and complete | Read `getAllProducts()` | 49 products, every id matches `^P\d{3}$`, ids unique | Automated |
| TC-02 | Money is grouped and whole | For each product, read `pricing` | `price` and `mrp` are positive integers, `mrp >= price` | Automated |
| TC-03 | Pictures are grouped and id-keyed | For each product, read `media.images` | `images[0]` is `/products/{id}.webp`; every later image is `/products/{id}-*.webp` | Automated |
| TC-04 | Specs are open and non-empty | For each product, read `specs` | At least one entry; every key lower-case; every value a non-empty string | Automated |
| TC-05 | Reception, stock and flags are grouped | For each product | `rating.average` in 3.5–5, `rating.count` an integer, `stock.inStock` / `flags.*` booleans | Automated |
| TC-06 | The old flat keys are gone | For each product | No `price`, `images`, `details`, or `shortDescription` key survives | Automated |
| TC-07 | Slugs still resolve | For each product | `category` is a known slug; every `collections` entry is a known tag | Automated |
| TC-08 | The validator accepts the migrated file | `node scripts/validate-products.mjs` | Exit 0, `PASS — all checks green` | Automated |

### Option groups and their controls

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-09 | Every group names a renderable control | Read every `options[].type` | One of `dropdown`, `swatch`, `pills`, `chips` | Automated |
| TC-10 | Every group's default is offered | Read every `options[]` | `values` contains `default` | Automated |
| TC-11 | The catalogue's control assignments are the intended ones | Read P001, P005, P006, P010, P048 | `Letter:dropdown` ×2, `Shape:chips`, `Colour:swatch` ×2 | Automated |
| TC-12 | `dropdown` renders a labelled select | Render with the 25-letter group | A `<select>` labelled `Letter`, 25 `<option>`s, value `A` | Automated |
| TC-13 | `swatch` names every finish in text | Render the Colour group | A radio per value, each with the finish's name as its accessible name | Automated |
| TC-14 | `pills` respects a default that is not the first value | Render a Size group defaulting to `M` | `M` checked, `XS` unchecked | Automated |
| TC-15 | `chips` reports a change | Render the Shape group, click `Heart` | `onChange("Heart")` | Automated |
| TC-16 | Every group has an accessible name | Render each of the four | Dropdown reachable by label; the three radio groups expose `role="group"` named by the option | Automated |
| TC-17 | Every control is keyboard operable | Focus a non-default radio, activate it | It takes focus and reports its value | Automated |
| TC-18 | A sold-out piece renders inert controls | Render each with `disabled` | Every radio and the select are disabled | Automated |
| TC-19 | Defaults come from `default`, not `values[0]` | Resolve a group whose default is its second value | Both `defaultSelectedOptions` and `resolveSelectedOptions` return the stated default | Automated |

### The gallery and the per-variant image

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-20 | A second image produces a thumbnail strip | Render the gallery for P002's two images | Two thumbnails; main image is `P002.webp` | Automated |
| TC-21 | A thumbnail swaps the main image | Click the second thumbnail | Main image becomes `P002-2.webp` | Automated |
| TC-22 | Exactly one thumbnail is current | Click through the strip | `aria-current="true"` on the shown one and only that one | Automated |
| TC-23 | A single image gets no fake strip | Render the gallery for a one-image product | No thumbnail buttons at all | Automated |
| TC-24 | Thumbnails are keyboard reachable and labelled | Focus the second thumbnail | It takes focus; label reads `Show image 2 of 2` | Automated |
| TC-25 | Choosing a mapped value swaps the main image | Choose `Golden` on P010 | Main image becomes `P010-golden.webp` | Automated |
| TC-26 | An unmapped value falls back | Choose `Golden`, then `Silver` | Main image returns to `P010.webp` | Automated |
| TC-27 | A choice overrides a clicked thumbnail | Click thumbnail 2, then choose `Golden` | The variant image wins | Automated |
| TC-28 | A thumbnail wins again after the choice | Choose `Golden`, then click thumbnail 1 | The clicked image wins | Automated |
| TC-29 | The resolver is null-safe | Call `resolveVariantImage` with no map, no selection, and an unmapped value | `null` in all three | Automated |

### The cart line's thumbnail

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-30 | A line shows its variant's photograph | Build lines for `Colour: Golden` and `Colour: Silver` | `P010-golden.webp` and `P010.webp` respectively | Automated |
| TC-31 | An unmapped product shows its own | Build a line for P002 | `P002.webp` | Automated |
| TC-32 | It reaches the rendered cart | Add both finishes from the product page | Two lines, two different `<img src>` | Automated |
| TC-33 | It survives persistence | Add `Golden`, read `localStorage` | The stored line's `image` is `P010-golden.webp` | Automated |

### The money path — adversarial

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-34 | The pricing catalogue carries nothing but a price | Inspect `getOrderPricingCatalogue()` | Keys are exactly `id`, `name`, `price`, `inStock` | Automated |
| TC-35 | `mrp` is absent, not merely untyped | Serialise the pricing catalogue | The string `mrp` does not appear | Automated |
| TC-36 | Media, options, specs and reviews never reach pricing | Serialise the pricing catalogue | None of `variantImages`, `options`, `specs`, `reviews` appear | Automated |
| TC-37 | The fulfilment catalogue carries no amount | Serialise `getOrderOptionCatalogue()` | Neither `price` nor `mrp` nor `pricing` appears | Automated |
| TC-38 | A tampered request is priced from the catalogue | Send `price: 1, mrp: 1, lineTotal: 1, total: 1` | Parsed to `{ productId, qty }`; total equals the untampered total | Automated |
| TC-39 | A marked-down piece cannot be charged its mrp | Price P010 | `unitPrice` and `subtotal` are `pricing.price`, never `pricing.mrp` | Automated |
| TC-40 | A choice costs nothing | Price P001 with no choice, `Letter: A`, `Letter: Z` | All three totals identical | Automated |
| TC-41 | Two choices cost what two of one cost | Price two lines of P001 vs. `qty: 2` | Identical totals | Automated |
| TC-42 | A per-variant image costs nothing | Price P010 as `Silver` and as `Golden` | Identical subtotals, both `pricing.price` | Automated |
| TC-43 | A second gallery image costs nothing | Price P002 | Subtotal is `pricing.price` | Automated |
| TC-44 | The 47 untouched products price as before | Price every single-image, no-variant, in-stock product | Subtotal equals `pricing.price` in every case | Automated |

### Regression

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-45 | The full suite is green | `npm run test:run` | All files pass | Automated |
| TC-46 | Types and lint are clean | `npm run typecheck && npm run lint` | No errors | Automated |
| TC-47 | The site still builds every page | `npm run build` from a cleared `.next` | 68/68 static pages | Automated |
| TC-48 | The generator stays idempotent | `npm run generate:placeholders` twice | Second run writes nothing and skips every file | Automated |
| TC-49 | No em dash reaches a shopper | `lib/copy-dashes.test.ts` against `description`, `specs`, reviews and options | None found | Automated |
