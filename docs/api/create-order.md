# POST /api/create-order

Prices a cart server-side and places one order by one of three payment paths. Two of them
create a Cashfree payment session and return the `payment_session_id` the browser SDK needs to
redirect to hosted checkout; the third — cash on delivery — never contacts Cashfree at all.

Handler: `app/api/create-order/route.ts`. Runtime: **Node** (`export const runtime = "nodejs"`).
Rationale and trade-offs: [ADR-013](../decisions/ADR-013-order-creation-and-payment.md), for
the option fields [ADR-019](../decisions/ADR-019-product-options.md), for the `utm` field
[ADR-039](../decisions/ADR-039-analytics-and-utm-attribution.md), and for the Postgres write
[ADR-042](../decisions/ADR-042-order-capture-in-postgres.md).

**Nothing in the request changed when order capture was added, and nothing in it has changed
since.** The body this route accepts, every validation below and the amount sent to Cashfree
are exactly what they were.

**The 200 response shape changed in prompt 49**
([ADR-043](../decisions/ADR-043-order-id-as-primary-identifier.md)) and again in prompt 100
([ADR-059](../decisions/ADR-059-checkout-payment-paths.md)), which made it a union of two
shapes and added `paymentType`, `amountPrepaid` and `amountDue`. See [200 OK](#200-ok).

**Prompt 100 also added the one new request field this contract has ever taken**,
`paymentPath`, and two error codes. **A body that omits `paymentPath` behaves exactly as it
always has** — same validation, same amount to Cashfree, same `prepaid` row — which is what
every browser deployed before that prompt sends.

## Request

```
POST /api/create-order
Content-Type: application/json
```

```ts
interface CreateOrderRequest {
  items: {
    productId: string;
    qty: number;
    selectedOptions?: Record<string, string>;   // { "Letter": "A" } — recorded, never priced
  }[];
  paymentPath?: "cod" | "partial" | "full";   // absent means "full" — see below
  address: {
    name: string;
    phone: string;      // 10 digits, no country code — the server prefixes +91
    email: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;      // must be one of INDIAN_STATES
    pincode: string;    // 6 digits, first digit not 0
  };
  utm?: {               // optional, absent on most orders — recorded, never priced
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}
```

One entry per **cart line**, not per product: a product with options can appear more than
once with different `selectedOptions`, and both entries are recorded. They are summed into a
single priced item before pricing, so the per-product quantity cap applies to the total across
a product's lines.

### `paymentPath` — a word, never an amount

Which of the three paths the shopper chose. It is the **whole** of what a client may say about
how an order is paid for: it names no figure and asserts no eligibility, and the server decides
what each word costs from its own read of `data/products.json`.

| Value | Meaning |
| --- | --- |
| `"full"` | Charge the whole order total now. The only behaviour this route had before prompt 100 |
| `"cod"` | Take nothing now; the whole total is due at the door |
| `"partial"` | Charge Σ `minPrepaidAmount × qty`; the remainder is due at the door |

**Absent, or any unrecognised value, reads as `"full"`.** `parsePaymentPath` falls that way
deliberately: the safe reading of a path this server does not know is the one that collects all
of the money up front, and it is what every pre-existing client body means.

A path the cart does not permit is **refused** with `400 PAYMENT_PATH_UNAVAILABLE`, never
downgraded — see check 11 below. Eligibility is a property of which pieces are in the basket and
never of what it is worth ([ADR-058](../decisions/ADR-058-cod-eligibility-and-min-prepaid-amount.md)).

### `utm` — optional, and never a pricing input

The campaign the browser recorded as its first touch, read from `localStorage` by
`getStoredUtmParams()` in `lib/utm.ts` and sent only when there is one. Most orders carry none,
and an order without it produces the byte-identical Cashfree request it produced before this
field existed.

It is validated for **shape only**, by `parseUtmParams`: every field must be a usable string or
it is dropped, each surviving value is stripped of control characters, whitespace-collapsed and
truncated at 120 characters, and an object with nothing usable left in it becomes `null`. A
malformed or hostile `utm` therefore costs the order its attribution, never the order itself —
there is no validation failure it can cause and no error code it can produce.

`utm_source`, `utm_medium` and `utm_campaign` are written onto the Cashfree order as
`order_tags`, merged into the same map that already carries the recorded option choices
(at most six tags, against Cashfree's ten). `term` and `content` are accepted and stored in the
browser but not tagged; GA4 reports on them natively. Nothing in the pricing path can read any
of it. See [ADR-039](../decisions/ADR-039-analytics-and-utm-attribution.md).

There is **no amount field, and adding one has no effect**. `price`, `mrp`, `lineTotal`,
`subtotal`, `shipping` and `total` are all discarded by `parseOrderItems` before the body
reaches the pricing core, which has no parameter that could receive one. See
[what the server recomputes](#what-the-server-recomputes-and-what-it-ignores).

## Server-side validation

In order. The first failing group returns; nothing further runs.

| # | Check | Failure |
| --- | --- | --- |
| 1 | Body parses as JSON and is an object | `400 REQUEST_MALFORMED` |
| 2 | `items` is an array of objects each with a non-empty string `productId` | `400 REQUEST_MALFORMED` |
| 3 | `items` is non-empty | `400 ITEMS_INVALID` (`EMPTY_CART`) |
| 4 | Every `productId` exists in `data/products.json` | `400 ITEMS_INVALID` (`UNKNOWN_PRODUCT`) |
| 5 | No `productId` appears twice **after lines are merged** | `400 ITEMS_INVALID` (`DUPLICATE_PRODUCT`) |
| 6 | Every product is `inStock` | `400 ITEMS_INVALID` (`OUT_OF_STOCK`) |
| 7 | Every merged `qty` is an integer in `[1, 10]` | `400 ITEMS_INVALID` (`INVALID_QUANTITY`) |
| 8 | Every `selectedOptions` names a group and value the catalogue still offers | `400 ITEMS_INVALID` (`INVALID_OPTION`) |
| 9 | The address passes `validateAddressForm` — the same validator `/address` uses | `400 ADDRESS_INVALID` |
| 10 | The computed `total` is greater than zero | `400 ORDER_TOTAL_INVALID` |
| 11 | The cart permits the requested `paymentPath` | `400 PAYMENT_PATH_UNAVAILABLE` |
| 12 | **cash on delivery only** — the order was written to Postgres | `503 ORDER_NOT_RECORDED` |
| 13 | **the two online paths only** — `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` are set | `503 PAYMENT_NOT_CONFIGURED` |
| 14 | **the two online paths only** — Cashfree returns 2xx with a `payment_session_id` | `502 PAYMENT_GATEWAY_UNAVAILABLE` |

Check 11 runs `summariseCartPrepayment` over the priced lines against
`getCodEligibilityCatalogue()` and hands the result to `resolvePaymentPlan`. It refuses:

- `"cod"` when any line reads `minPrepaidAmount > 0` — ADR-058's unanimity rule;
- `"partial"` when the floor is zero (nothing to part-pay) or has reached the total (the two
  options would charge the same amount and neither would leave a balance);
- either, on a cart naming a product the eligibility catalogue does not hold — impossible past
  check 4, and it fails towards collecting the money rather than towards sending goods out on a
  rule that could not be evaluated.

**Check 11 runs before the credentials check**, so a cash-on-delivery order succeeds on a
deployment with no Cashfree credentials configured at all. That is not a loophole — it is the
point: the path reads no credential and makes no request.

Checks 13 and 14 do not exist on the cash-on-delivery path. It never reaches them.

Checks 3–7 are collected, not short-circuited: one response reports every bad line. Check 8 is
collected the same way, but it runs as its own pass after pricing, so an order with both a
pricing fault and an option fault reports the pricing faults first.

Because check 5 runs on the *merged* items, two lines of one product are a valid order — that
is the whole point of options — but their quantities add up against check 7. Five of `Letter:
A` and six of `Letter: B` is eleven Wave Band Initial Rings and is refused.

A `selectedOptions` naming a group the product does not have — including any selection at all
on a product with no options — fails check 8. A selection that is merely *incomplete* does
not: the missing groups take their default values, the same as for a shopper who never opened
a selector.

Items are checked before the address so that a shopper with two problems is sent to `/cart`
first, where the fix is.

The address is re-validated even though `/address` already validated it. "The client said it
was valid" is not a fact the server has.

### What the server recomputes, and what it ignores

| Value | Source |
| --- | --- |
| Unit price | `data/products.json` → `product.price`, at request time |
| Line total | `product.price × qty`, computed here |
| Subtotal | Sum of the computed line totals |
| Shipping | `calculateShipping(subtotal)` from `lib/config.ts` — once per order, never per line. Zero at or above `FREE_SHIPPING_THRESHOLD` (₹799, inclusive) and on an empty order, `FLAT_SHIPPING_RATE` (₹99) otherwise. Derived from the catalogue-priced subtotal, so a client cannot claim to have qualified |
| Total | `subtotal + shipping` |
| Prepayment floor | Σ `minPrepaidAmount × qty` over the priced lines, from `getCodEligibilityCatalogue()` — a fourth accessor that carries no price, so this figure cannot come to depend on what the cart is worth |
| `amountPrepaid` / `amountDue` | `resolvePaymentPlan`, from the computed total and that floor. `amountPrepaid + amountDue = total` holds on all three paths by construction and is re-checked by `captureOrder` before the insert |
| `order_amount` sent to Cashfree | The computed `amountPrepaid` — the total on `full`, the floor on `partial`, and nothing at all on `cod` because no request is made |

| Client-supplied value | Treatment |
| --- | --- |
| Any `price`, `mrp`, `lineTotal`, `subtotal`, `shipping`, `total` | Discarded before validation; unreachable from the pricing core |
| `name`, `image` on an item | Discarded; line item names come from the catalogue |
| `productId`, `qty` | The only pricing inputs, and both are validated above |
| `paymentPath` | A word only. It selects among three server-computed splits and can name no figure; a path the cart does not permit is refused rather than honoured |
| Any `amountPrepaid`, `amountDue`, `minPrepaidAmount` in the body | Discarded; no field of the body is read as one, and the plan is built from the server's own figures |
| Any claim that the cart is COD-eligible | Never read. Eligibility is recomputed here from the catalogue on every call |
| `selectedOptions` | Validated against the catalogue and written to `order_tags`. Not an input to any amount — the module that handles it is typed without a `price` field |
| `utm` | Validated for shape, bounded, and written to `order_tags` alongside the options. Not an input to any amount; `buildOrderTags` has no access to one |
| The `sessionStorage` checkout bundle's amounts | Never sent, and would be ignored if they were |

`mrp` is never read on any path. The `catalogue` parameter of `buildOrderFromCart` is typed
without an `mrp` field, so reading one is a type error rather than a review catch
([ADR-003](../decisions/ADR-003-discount-display-pricing.md),
[ADR-013](../decisions/ADR-013-order-creation-and-payment.md)).

## Responses

Every response, success or failure, is sent with `Cache-Control: no-store`.

### 200 OK

Two shapes, discriminated on `paymentType`. They are genuinely different bodies rather than one
body with fields nulled out: a cash-on-delivery order has no payment session and no environment
to initialise an SDK against, so it carries neither key.

```ts
type CreateOrderSuccess = CreateOrderOnlineSuccess | CreateOrderCodSuccess;

interface CreateOrderOnlineSuccess {
  paymentType: "prepaid" | "partial_cod";
  cashfreeOrderId: string;      // MG_{epoch ms}_{8 base36} — the payment's reference
  trackingId: string | null;    // orders.id, the 10-char customer-facing order number
  paymentSessionId: string;
  amountPrepaid: number;        // what Cashfree is being asked for
  amountDue: number;            // what is left owing; 0 on a prepaid order
  mode: "sandbox" | "production";
}

interface CreateOrderCodSuccess {
  paymentType: "cod";
  codOrderReference: string;    // COD_{epoch ms}_{8 base36} — ours, not a gateway's
  trackingId: string;           // never null on this path; see below
  amountPrepaid: number;        // always 0
  amountDue: number;            // the whole order total
}
```

A full prepayment, which is what a body naming no `paymentPath` produces:

```json
{
  "paymentType": "prepaid",
  "cashfreeOrderId": "MG_1786968394909_v8j3wggq",
  "trackingId": "W2ACEHACUU",
  "paymentSessionId": "session_xxxxxxxxxxxxxxxxxxxxx",
  "amountPrepaid": 309,
  "amountDue": 0,
  "mode": "sandbox"
}
```

A cash-on-delivery order:

```json
{
  "paymentType": "cod",
  "codOrderReference": "COD_1787933768463_huepbvf6",
  "trackingId": "NEW9QRV2QJ",
  "amountPrepaid": 0,
  "amountDue": 309
}
```

#### `trackingId` is nullable on one shape and not the other

On the online paths it may be null: the Postgres capture is allowed to fail without failing the
checkout, because the money is at Cashfree and the order is recoverable from their dashboard
([ADR-042](../decisions/ADR-042-order-capture-in-postgres.md)).

On the cash-on-delivery path it may not. There is no second copy of a COD order, so a failed
write means it exists in no system at all — the route answers `503 ORDER_NOT_RECORDED` and
places nothing, and this body is never produced without a row behind it.
`isCreateOrderCodSuccess` in `lib/payment.ts` rejects a null order number, holding the server to
that. See [ADR-059](../decisions/ADR-059-checkout-payment-paths.md) §5.

#### `codOrderReference` is deliberately not in Cashfree's shape

`orders.cashfree_order_id` is unique and non-null, and a COD order still needs a payment
reference to occupy it, so this route mints one. The `COD_` prefix rather than `MG_` is
load-bearing: `isMorchadiOrderId` rejects it, so `/api/verify-order` cannot be led into asking
Cashfree about a payment that never existed and rendering the inevitable 404 as *"nothing has
been charged"* over a real order. The row's `cashfree_payment_status` reads `NOT_APPLICABLE`, a
value `normaliseCashfreeOrderStatus` cannot produce.

The confirmation page reads it back through [`/api/cod-order`](cod-order.md).

#### Two ids, and neither is called `orderId`

| Field | What it is | Who uses it |
| --- | --- | --- |
| `cashfreeOrderId` | Cashfree's own `order_id`, as returned, falling back to the one sent | The return URL, [`/api/verify-order`](verify-order.md), `orders.cashfree_order_id`, a refund |
| `trackingId` | `orders.id` — ten characters over the unambiguous alphabet of [ADR-040](../decisions/ADR-040-postgres-for-orders.md) | The confirmation page, the admin order list, WhatsApp, the future tracking page |

**Breaking change, prompt 49.** Through prompt 48 the Cashfree id was returned as `orderId`
with nothing beside it. It is now `cashfreeOrderId`, and `trackingId` is new. Both names are
qualified so that no reader has to guess which id it is holding — see
[ADR-043](../decisions/ADR-043-order-id-as-primary-identifier.md) for why the rename was
preferred to adding a second key next to `orderId`.

| Prompt 48 | Prompt 49 |
| --- | --- |
| `orderId` | `cashfreeOrderId` — same value |
| — | `trackingId` |
| `paymentSessionId` | unchanged |
| `mode` | unchanged |

**Additive change, prompt 100.** The online body gained `paymentType`, `amountPrepaid` and
`amountDue`, and the cash-on-delivery body is new. Nothing was removed or renamed, and a client
reading only the four prompt-49 keys off an online response still works.

**`trackingId` is null when the Postgres capture failed.** That write is deliberately allowed
to fail without failing the checkout ([ADR-042](../decisions/ADR-042-order-capture-in-postgres.md)),
so an order can have a payment session and no row — and therefore no order number. Every
consumer handles the null; `isCreateOrderSuccess` in `lib/payment.ts` accepts `null` and rejects
a missing key or an empty string.

`mode` is echoed because the browser SDK must be initialised against the same environment the
session was minted in, and the client cannot read `CASHFREE_ENV`.

#### What the client does with each

`/payment` stamps **both** ids onto the `sessionStorage` checkout bundle immediately before
handing the browser to Cashfree. `/order-confirmation` is returned by Cashfree with only
`cashfreeOrderId` in the URL, matches it against the bundle's stamp, and on a match shows the
bundle's `trackingId` as "Your order number". The Cashfree id stays on the page as "Payment
reference" in fine print. A bundle that is missing, corrupt, or stamped with a different order
falls back to showing the Cashfree reference — the known limitation recorded in ADR-043.

### Error body

Every non-200 shares one shape:

```ts
interface CreateOrderErrorBody {
  error: string;        // the code, from the table below
  message: string;      // safe to render to a shopper as-is
  retryable: boolean;   // whether pressing Pay again could succeed unchanged
  details?: { productId: string | null; code: string; message: string }[];
  fields?: Record<string, string>;   // keyed by address field name
}
```

`message` never contains a status code, an upstream error, a stack, or anything about
credentials.

### 400 REQUEST_MALFORMED

Body is not JSON, is not an object, or `items` is not a list of `{ productId, qty }`.
`retryable: false`.

### 400 ITEMS_INVALID

One or more lines cannot be ordered. `details` carries one entry per fault, in request order,
with `productId` (null for `EMPTY_CART`) and a `code` of `EMPTY_CART`, `UNKNOWN_PRODUCT`,
`DUPLICATE_PRODUCT`, `OUT_OF_STOCK`, `INVALID_QUANTITY` or `INVALID_OPTION`.
`retryable: false` — the fix is on `/cart`.

```json
{
  "error": "ITEMS_INVALID",
  "message": "Something in your cart can no longer be ordered.",
  "retryable": false,
  "details": [
    { "productId": "ghost-999", "code": "UNKNOWN_PRODUCT", "message": "This piece is no longer in our catalogue." },
    { "productId": "nk-001", "code": "INVALID_QUANTITY", "message": "Choose between 1 and 10 of Kundan Rani Haar." }
  ]
}
```

### 400 ADDRESS_INVALID

`fields` maps each failing address field to its message — the same strings `/address` shows,
because it is the same validator. `retryable: false` — the fix is on `/address`.

```json
{
  "error": "ADDRESS_INVALID",
  "message": "Please check your delivery details.",
  "retryable": false,
  "fields": {
    "phone": "Enter a 10-digit mobile number",
    "state": "Select a state from the list"
  }
}
```

### 400 ORDER_TOTAL_INVALID

The order validated but priced at zero or less. Unreachable with the current catalogue; it is
a backstop so a zero-amount order can never be sent to Cashfree. `retryable: false`.

### 400 PAYMENT_PATH_UNAVAILABLE

The cart does not permit the `paymentPath` the request named — cash on delivery on a cart holding
a piece that requires prepayment, or a part payment on a cart with no floor to part-pay or whose
floor has reached the total.

Not retryable: pressing the same button again asks for the same refused thing, and the way
forward is another path or a different cart. No Cashfree request is made and nothing is written.

```json
{
  "error": "PAYMENT_PATH_UNAVAILABLE",
  "message": "That payment option is not available for what is in your cart. Go back a step and choose another one.",
  "retryable": false
}
```

### 503 ORDER_NOT_RECORDED

**Cash on delivery only.** The order could not be written to Postgres, so it was not placed.

This is the one place a capture failure is fatal, and the asymmetry with the online paths is
deliberate: those are recoverable from the Cashfree dashboard and this is not. **Retryable** —
the database being back is all this needs — and the message says plainly that nothing was placed
and nothing is owed. It names no database and no exception
([ADR-048](../decisions/ADR-048-database-health-and-failure-surfaces.md)).

```json
{
  "error": "ORDER_NOT_RECORDED",
  "message": "We could not record your order just now, so nothing has been placed and nothing is owed. Your cart and details are safe, so please try again in a moment.",
  "retryable": true
}
```

### 503 PAYMENT_NOT_CONFIGURED

`CASHFREE_APP_ID` or `CASHFREE_SECRET_KEY` is missing. Distinct from 502 because retrying
cannot fix it — the fix is a deployment change. Logged server-side; the response says only
that online payment is unavailable. `retryable: false`.

### 502 PAYMENT_GATEWAY_UNAVAILABLE

Cashfree could not be reached, timed out after 15s, returned a non-2xx, or returned a body
with no `payment_session_id`. All four collapse into one response because the shopper's
action is the same in every case. `retryable: true`.

The status and the full upstream body **are** logged server-side against the order id; they
are never returned.

```json
{
  "error": "PAYMENT_GATEWAY_UNAVAILABLE",
  "message": "We could not reach the payment gateway just now. Your cart and details are safe, so please try again in a moment.",
  "retryable": true
}
```

## Side effects

### Nothing goes to Cashfree on the cash-on-delivery path

This bears stating as a side effect precisely because it is an *absence*. On `paymentPath: "cod"`
this route makes **no request to the gateway whatsoever**: no `fetch` to Cashfree's orders
endpoint, no `payment_session_id`, and no read of `CASHFREE_APP_ID` or `CASHFREE_SECRET_KEY`. It
mints a `COD_…` reference locally, writes the order, and answers. The Cashfree section below
applies to `"full"` and `"partial"` only.

### One WhatsApp notification on the cash-on-delivery path, and only that path

```
GET https://api.callmebot.com/whatsapp.php?phone=…&text=…&apikey=…
```

**5s timeout, no retry, not awaited, and fired only after `captureOrder` returned `CAPTURED`.**
It is skipped silently when `CALLMEBOT_PHONE` or `CALLMEBOT_APIKEY` is unset.

A cash-on-delivery order has no payment for [`/api/notify-admin`](notify-admin.md) to re-verify
with Cashfree, so this is the one path whose notification is sent from the server rather than
fired by `/order-confirmation`. The warrant is the row this request just wrote:
`notifyOwnerOfCodOrder` in `lib/notify-cod.ts` is called by the branch that captured the order,
with the order number Postgres assigned and the amounts this route computed. Nothing outside
this server can reach it, and no endpoint was added.

**Neither online path sends anything here.** A `full` or `partial_cod` order still notifies the
way it always has, from the confirmation page once `/api/verify-order` has said `PAID`, through
the unchanged Cashfree-verified route.

The message states the amount **due at delivery** and never an amount paid; it names the
`trackingId` and the `COD_…` reference; and it carries the items, their chosen options and the
delivery address. Nothing about it can affect this route's response: the send is not awaited and
every fault it can suffer is a logged outcome. See
[ADR-060](../decisions/ADR-060-cod-order-notification.md).

### One outbound call to Cashfree on the two online paths

Made only after every check above has passed:

```
POST {base}/pg/orders
X-Client-Id:     $CASHFREE_APP_ID
X-Client-Secret: $CASHFREE_SECRET_KEY
x-api-version:   2025-01-01
Content-Type:    application/json
Accept:          application/json
```

`{base}` is `https://sandbox.cashfree.com` unless `CASHFREE_ENV` is exactly `production`, in
which case `https://api.cashfree.com`. Timeout `CASHFREE_TIMEOUT_MS` (15s), defined once in
`lib/cashfree-config.ts` and shared with the read-back call
[`/api/verify-order`](verify-order.md) makes. `cache: "no-store"`.

```json
{
  "order_id": "MG_1786968394909_v8j3wggq",
  "order_amount": 2099,
  "order_currency": "INR",
  "customer_details": {
    "customer_id": "guest_a7f2k9m3x1qd",
    "customer_name": "Ananya Iyer",
    "customer_email": "ananya@example.com",
    "customer_phone": "+919876543210"
  },
  "order_meta": {
    "return_url": "https://www.morchadigems.com/order-confirmation?order_id=MG_1786968394909_v8j3wggq"
  },
  "order_tags": {
    "options": "P001:Letter=A; P001:Letter=B; P010:Colour=Golden"
  }
}
```

`order_tags` is present **only when something in the order has options**; an order of the
forty-four plain products sends exactly the body it sent before ADR-019. It is the fulfilment
record — with no database, the payment record is the order record, and this is where a packer
reads what to engrave. Values are capped at 255 characters, so a long summary is split across
`options`, `options_2` and `options_3` rather than truncated, and if even three values are not
enough the last one ends `; +N more`. No amount is ever written to it.

`order_amount` is the server's computed `amountPrepaid` — the whole total on `"full"`, and the
prepayment floor on `"partial"`, which is the one case where the amount the shopper is charged is
deliberately not what their cart is worth. It is never a figure from the request.
`customer_id` is generated fresh per order and links to nothing — there are no accounts. The return URL origin comes from `APP_BASE_URL`,
then `NEXT_PUBLIC_BASE_URL`, then the request's own origin.

### The Postgres write

On the two online paths, once Cashfree has returned a `payment_session_id` and only then, the
order is captured in Postgres by `captureOrder` in `lib/order-capture.ts`. On the
cash-on-delivery path the same function runs with no gateway call before it. One `Customer`
(found or created by phone), one `Order`, one `OrderLineItem` per distinct product-and-choice,
and the first `OrderStatusHistory` row.

| Column | Value |
| --- | --- |
| `orders.id` | A fresh 10-character code from `lib/order-id.ts` — **not** the `MG_` id in the response |
| `orders.status` | `placed` |
| `orders.payment_type` | `prepaid`, `partial_cod` or `cod`, from `resolvePaymentPlan` — never from the request |
| `orders.amount_prepaid` / `amount_due` | The plan's two figures. `amount_prepaid + amount_due = total` holds on all three paths and is re-checked by `isBalancedOrderPayment` immediately before the insert; a row that failed it is not written |
| `orders.subtotal`, `shipping_fee`, `total` | The server's own computed amounts, never the client's |
| `orders.total_cost` | Σ `pricing.cost × quantity`, from `getOrderCaptureCatalogue()`. Margin data; never in any response |
| `orders.cashfree_order_id` | The `order_id` Cashfree returned, falling back to the one that was sent — or, on `cod`, the locally minted `COD_…` reference. **Unique**, and non-null on every path |
| `orders.cashfree_payment_status` | Cashfree's `order_status` through `normaliseCashfreeOrderStatus` — `PENDING` for a newly-minted session — or `NOT_APPLICABLE` on `cod`, a value that normalisation cannot produce |
| `orders.utm_*` | The same validated `utm` written to `order_tags` |
| `orders.shipping_address` | The validated address, as JSON |
| `order_line_items.product_name` / `product_image` | **Snapshotted from the catalogue at this moment**, not referenced |
| `order_status_history` | One row: `placed`, `changed_by = "system"`, `reason = null` |

`customers` is keyed on phone. A repeat shopper reuses their row, and
`first_utm_source`/`_medium`/`_campaign` are written **only when the row is created** — a later
order records its own campaign on the order and never rewrites the customer's first touch.

**On the two online paths this write can fail without the shopper noticing, by design.**
`captureOrder` never throws. A database that is down, slow, or refusing a constraint produces a
server-side log line prefixed `[order-capture]` and nothing else: the 200 above is returned
unchanged with `trackingId: null`, the Cashfree session is unaffected, and no error body ever
mentions the database. This mirrors `/api/notify-admin`, and the trade-off — a paid order with no
row, recoverable only from the Cashfree dashboard — is argued in
[ADR-042](../decisions/ADR-042-order-capture-in-postgres.md).

**On the cash-on-delivery path the same failure is fatal**, and answers `503 ORDER_NOT_RECORDED`
above. ADR-042's rule rests on the order being recoverable from Cashfree, and a COD order is not
recoverable from anywhere: an unwritten one exists in no system at all. See
[ADR-059](../decisions/ADR-059-checkout-payment-paths.md) §5.

> **Two ids per order.** The payment reference — `cashfreeOrderId` on an online order and
> `codOrderReference` on a cash-on-delivery one — is what the confirmation URL carries and what
> `/api/verify-order` or [`/api/cod-order`](cod-order.md) is keyed on. `orders.id` is returned as
> `trackingId` and is the order's public name — shown on
> the confirmation page and used as the primary identifier throughout the admin panel
> ([ADR-043](../decisions/ADR-043-order-id-as-primary-identifier.md)).

## Security notes

| Secret | Where it is read | How it is kept off the client |
| --- | --- | --- |
| `CASHFREE_APP_ID` | `lib/cashfree-config.ts` | `import "server-only"` at the top of that module makes importing it from a `"use client"` file a **build error**, verified by deliberately doing it |
| `CASHFREE_SECRET_KEY` | same | same; never logged, never in any response body |
| `DATABASE_URL` | `lib/prisma.ts` | same — that module opens with `import "server-only"`, and the capture code that uses it is only ever reached from this route handler |
| `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` | `lib/notify.ts`, reached from `lib/notify-cod.ts` on the cash-on-delivery path | Neither carries `NEXT_PUBLIC_`, and `lib/notify-boundary.test.ts` asserts the stronger property: no `"use client"` module reaches `lib/notify.ts` at any import depth |

Neither Cashfree credential is prefixed `NEXT_PUBLIC_`, so Next.js would not inline them into a
client bundle even without the guard, and nor is `DATABASE_URL`. The Cashfree config lives in its own module rather than in
`lib/config.ts` precisely because that file *is* imported by client components.

The payment page holds no credential and knows no Cashfree endpoint. It calls exactly one
URL — this one — and uses the browser SDK only for `checkout()`, which needs nothing but the
`payment_session_id`. Verified against the production build: no client chunk contains
`CASHFREE_`, `X-Client-Secret`, or a Cashfree API host.

The route is `dynamic = "force-dynamic"` and every response carries `Cache-Control: no-store`,
so a payment session cannot be served to a second shopper from a cache.
