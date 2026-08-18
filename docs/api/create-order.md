# POST /api/create-order

Prices a cart server-side and creates a Cashfree payment session for it. Returns the
`payment_session_id` the browser SDK needs to redirect to hosted checkout.

Handler: `app/api/create-order/route.ts`. Runtime: **Node** (`export const runtime = "nodejs"`).
Rationale and trade-offs: [ADR-013](../decisions/ADR-013-order-creation-and-payment.md) and,
for the option fields, [ADR-019](../decisions/ADR-019-product-options.md).

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
}
```

One entry per **cart line**, not per product: a product with options can appear more than
once with different `selectedOptions`, and both entries are recorded. They are summed into a
single priced item before pricing, so the per-product quantity cap applies to the total across
a product's lines.

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
| 11 | `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` are set | `503 PAYMENT_NOT_CONFIGURED` |
| 12 | Cashfree returns 2xx with a `payment_session_id` | `502 PAYMENT_GATEWAY_UNAVAILABLE` |

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
| Shipping | `FLAT_SHIPPING_RATE` from `lib/config.ts` — once per order, never per line |
| Total | `subtotal + shipping` |
| `order_amount` sent to Cashfree | That computed total, and only that |

| Client-supplied value | Treatment |
| --- | --- |
| Any `price`, `mrp`, `lineTotal`, `subtotal`, `shipping`, `total` | Discarded before validation; unreachable from the pricing core |
| `name`, `image` on an item | Discarded; line item names come from the catalogue |
| `productId`, `qty` | The only pricing inputs, and both are validated above |
| `selectedOptions` | Validated against the catalogue and written to `order_tags`. Not an input to any amount — the module that handles it is typed without a `price` field |
| The `sessionStorage` checkout bundle's amounts | Never sent, and would be ignored if they were |

`mrp` is never read on any path. The `catalogue` parameter of `buildOrderFromCart` is typed
without an `mrp` field, so reading one is a type error rather than a review catch
([ADR-003](../decisions/ADR-003-discount-display-pricing.md),
[ADR-013](../decisions/ADR-013-order-creation-and-payment.md)).

## Responses

Every response, success or failure, is sent with `Cache-Control: no-store`.

### 200 OK

```ts
interface CreateOrderSuccess {
  orderId: string;           // MG_{epoch ms}_{8 base36}
  paymentSessionId: string;
  mode: "sandbox" | "production";
}
```

```json
{
  "orderId": "MG_1786968394909_v8j3wggq",
  "paymentSessionId": "session_xxxxxxxxxxxxxxxxxxxxx",
  "mode": "sandbox"
}
```

`mode` is echoed because the browser SDK must be initialised against the same environment the
session was minted in, and the client cannot read `CASHFREE_ENV`.

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
  "message": "We could not reach the payment gateway just now. Your cart and details are safe — please try again in a moment.",
  "retryable": true
}
```

## Side effects

One outbound call, made only after every check above has passed:

```
POST {base}/pg/orders
X-Client-Id:     $CASHFREE_APP_ID
X-Client-Secret: $CASHFREE_SECRET_KEY
x-api-version:   2025-01-01
Content-Type:    application/json
Accept:          application/json
```

`{base}` is `https://sandbox.cashfree.com` unless `CASHFREE_ENV` is exactly `production`, in
which case `https://api.cashfree.com`. Timeout 15s, `cache: "no-store"`.

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
ninety-six plain products sends exactly the body it sent before ADR-019. It is the fulfilment
record — with no database, the payment record is the order record, and this is where a packer
reads what to engrave. Values are capped at 255 characters, so a long summary is split across
`options`, `options_2` and `options_3` rather than truncated, and if even three values are not
enough the last one ends `; +N more`. No amount is ever written to it.

`order_amount` is the server's computed total. `customer_id` is generated fresh per order and
links to nothing — there are no accounts. The return URL origin comes from `APP_BASE_URL`,
then `NEXT_PUBLIC_BASE_URL`, then the request's own origin.

Nothing is persisted. There is no database, so the `order_id` is generated, sent, and
forgotten until Cashfree names it again on the return.

> **`/order-confirmation` does not exist yet.** A completed sandbox payment currently lands on
> a 404. That page and server-side verification are the next prompt's work.

## Security notes

| Secret | Where it is read | How it is kept off the client |
| --- | --- | --- |
| `CASHFREE_APP_ID` | `lib/cashfree-config.ts` | `import "server-only"` at the top of that module makes importing it from a `"use client"` file a **build error**, verified by deliberately doing it |
| `CASHFREE_SECRET_KEY` | same | same; never logged, never in any response body |

Neither is prefixed `NEXT_PUBLIC_`, so Next.js would not inline them into a client bundle
even without the guard. The Cashfree config lives in its own module rather than in
`lib/config.ts` precisely because that file *is* imported by client components.

The payment page holds no credential and knows no Cashfree endpoint. It calls exactly one
URL — this one — and uses the browser SDK only for `checkout()`, which needs nothing but the
`payment_session_id`. Verified against the production build: no client chunk contains
`CASHFREE_`, `X-Client-Secret`, or a Cashfree API host.

The route is `dynamic = "force-dynamic"` and every response carries `Cache-Control: no-store`,
so a payment session cannot be served to a second shopper from a cache.
