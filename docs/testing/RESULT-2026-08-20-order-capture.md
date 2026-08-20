# Test Result: order capture in Postgres — 2026-08-20

- **Plan:** [PLAN-order-capture.md](PLAN-order-capture.md)
- **Commit:** `475eccc` plus this prompt's working tree
- **Environment:** local dev server (`npm run dev`, Next 14.2.35) against local Postgres
  (`postgres:16-alpine`, `docker compose`, healthy), Cashfree **sandbox**. Production untouched.

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | `lib/prisma-schema.test.ts` — defaults confirmed on a row that supplies only `amountPrepaid` |
| TC-02 | Pass | `partial_cod` with `amount_prepaid 100` / `amount_due 159`, and a `cod` row; both round-tripped including `item_received_back_at` |
| TC-03 | Pass | `tsc` refuses the create without `amountPrepaid`; the column is `NOT NULL` with no default in the applied migration |
| TC-04 | Pass | Second create rejected with `P2002` on `orders_cashfree_order_id_key` |
| TC-05 | Pass | `ORDER_ID_ALPHABET === "23456789ABCDEFGHJKMNPQRSTUVWXYZ"`, 31 characters; each of `0 O 1 I L` asserted absent, and every other uppercase alphanumeric asserted present |
| TC-06 | Pass | 5,000 generations, zero matches for `/[0O1IL]/` |
| TC-07 | Pass | 5,000 generations, all length 10 |
| TC-08 | Pass | Characters drawn across the sample equal the alphabet exactly — no character unreachable, none outside it |
| TC-09 | Pass | Mocked check returns taken-then-free: two calls, the second id returned |
| TC-10 | Pass | Three forced collisions: four calls, valid id returned |
| TC-11 | Pass | Always-taken check throws after 8 attempts rather than hanging |
| TC-12 | Pass | `lib/order-capture.test.ts`, inside a rolled-back transaction |
| TC-13 | Pass | `placed` / `system` / `null` |
| TC-14 | Pass | One `customers` row, two orders |
| TC-15 | Pass | Customer keeps `instagram`/`rakhi_2026`; the second order records `google`/`diwali_2026` |
| TC-16 | Pass | `first_utm_source` still null after a later campaign-carrying order |
| TC-17 | Pass | Row holds the capture-time name and image; a later catalogue rename does not reach it |
| TC-18 | Pass | Two rows, quantities 1 and 2, `total_cost` = cost × 3 |
| TC-19 | Pass | One row, quantity 3 |
| TC-20 | Pass | Two lines of `qty: 1.5` — priced as 3 by the existing core — capture as one row of integer quantity 3 with options dropped, rather than failing the insert |
| TC-21 | Pass | `lib/checkout-database-failure.test.ts`: 200, `{orderId, paymentSessionId, mode}` and nothing else, `Cache-Control: no-store`, exactly one Cashfree call |
| TC-22 | Pass | Body contains none of `database`, `Postgres`, `prisma`, `localhost:5432`; `[order-capture] … could not be written to Postgres` present in the server log |
| TC-23 | Pass | `order_amount` equals `buildOrderFromCart`'s total; `order_tags` carries `options` and `utm_source` as before |
| TC-24 | Pass | 200 `{orderId, status: "PAID", amount: 419}`, `no-store`; `the Postgres update failed` logged |
| TC-25 | Pass | `cashfree_payment_status` `PENDING → PAID`, `status` still `placed` |
| TC-26 | Pass | Second identical verification reports `UNCHANGED`; no write |
| TC-27 | Pass | Unknown `cashfree_order_id` returns `UNCHANGED` |
| TC-28 | Pass | `lib/checkout-capture-route.test.ts` drives the real `POST` handler against real Postgres |
| TC-29 | Pass | Evidence below |
| TC-30 | Pass | Evidence below |
| TC-31 | Pass | Evidence below |
| TC-32 | Pass | `lib/money-path.test.ts` not edited in this prompt and passes unchanged |

## TC-29 — a real sandbox order, end to end

Two rings and a watch ring, with an engraving choice on each, a campaign, and a real Jaipur
address. `/api/create-order` → real Cashfree sandbox session → the sandbox simulator's own
`POST /pg/view/simulate` with `payment_status: SUCCESS` (the action the simulator page's own
Success button performs) → `/order-confirmation` (HTTP 200) → `/api/verify-order`.

```
POST /api/create-order
→ {"orderId":"MG_1787216369300_3u923cgt","paymentSessionId":"session_ZQnydq7KBV…","mode":"sandbox"}

Cashfree sandbox simulator, cf_payment_id 1443889070644310528, amount 718.00
→ {"simulation_id":"sim_111006693IAnquiypXyz7hV0XsRtCl0Wrbm","entity_simulation":{"payment_status":"SUCCESS"}}

GET /order-confirmation?order_id=MG_1787216369300_3u923cgt   → http 200
GET /api/verify-order?order_id=MG_1787216369300_3u923cgt
→ {"orderId":"MG_1787216369300_3u923cgt","status":"PAID","amount":718}
```

`orders`, before and after that verification — the payment moved, the fulfilment did not:

```
     id     | status | payment_type | cashfree_payment_status
------------+--------+--------------+-------------------------
 W2ACEHACUU | placed | prepaid      | PENDING          ← after create-order
 W2ACEHACUU | placed | prepaid      | PAID             ← after verify-order
```

The full row:

```
id                      | W2ACEHACUU
created_at              | 2026-08-20 08:59:29.688
updated_at              | 2026-08-20 09:00:46.764
customer_id             | a63395f5-5a71-4b99-9123-9e86c0afe77b
status                  | placed
subtotal                | 619.00
shipping_fee            | 99.00
total                   | 718.00
total_cost              | 371.00
cashfree_order_id       | MG_1787216369300_3u923cgt
cashfree_payment_status | PAID
utm_source              | instagram
utm_medium              | paid_social
utm_campaign            | rakhi_2026
shipping_address        | {"city": "Jaipur", "name": "Ananya Iyer", "email": "ananya.iyer@example.com",
                        |  "line1": "402 Moti Doongri Apartments", "line2": "Off Tonk Road",
                        |  "phone": "9876543210", "state": "Rajasthan", "pincode": "302015"}
is_refunded             | f
refunded_at             |
refund_amount           |
amount_due              | 0.00
amount_prepaid          | 718.00
cod_amount_collected    | f
cod_collected_at        |
item_received_back      | f
item_received_back_at   |
payment_type            | prepaid
```

```
customers
id                 | a63395f5-5a71-4b99-9123-9e86c0afe77b
phone              | 9876543210
name               | Ananya Iyer
email              | ananya.iyer@example.com
first_utm_source   | instagram
first_utm_medium   | paid_social
first_utm_campaign | rakhi_2026

order_line_items
 product_id | product_name           | product_image       | selected_options     | qty | unit_price | unit_cost
 P001       | Wave Band Initial Ring | /products/P001.webp | {"Letter": "R"}      |  2  | 210.00     | 126.00
 P010       | Mini Watch Ring        | /products/P010.webp | {"Colour": "Golden"} |  1  | 199.00     | 119.00

order_status_history
 status | changed_by | reason | changed_at
 placed | system     |        | 2026-08-20 08:59:29.688
```

Reconciled against `data/products.json`: 210 × 2 + 199 = **619** subtotal; 619 is under the ₹799
free-shipping threshold so **99** shipping; **718** total, which is the `order_amount` Cashfree
charged. Cost 126 × 2 + 119 = **371**, matching `total_cost`. One `order_status_history` row,
written by `system` because a customer checkout and not an admin created it.

## TC-30 — a repeat shopper, live

A second real order from the same phone with a different campaign, through the same route:

```
POST /api/create-order → {"orderId":"MG_1787216471944_mbggjzm1", …}

customer_rows_for_that_phone | 1
first_utm_source | first_utm_campaign
 instagram       | rakhi_2026            ← unchanged by the second order

     id     | utm_source | utm_campaign | total  | total_cost | cashfree_payment_status
 W2ACEHACUU | instagram  | rakhi_2026   | 718.00 |     371.00 | PAID
 2669RD8XFG | google     | diwali_2026  | 549.00 |     270.00 | PENDING
```

## TC-31 — `pricing.cost` after a production build

`npm run build`, then grepped `.next/static` case-insensitively. The controls are the point:
they prove the search is live rather than silently matching nothing.

```
cost           files in .next/static: 0
pricing        files in .next/static: 0
unitCost       files in .next/static: 0
totalCost      files in .next/static: 0
amountPrepaid  files in .next/static: 0
--- controls that must be non-zero ---
mrp            files in .next/static: 1   (.next/static/chunks/app/cart/page-*.js)
price          files in .next/static: 9
inStock        files in .next/static: 4
--- server bundle, where cost is allowed to live ---
cost in .next/server: 5 files
```

Prerendered HTML and RSC payloads separately: `"cost"` in 0 files, `"mrp"` in 62.

## Failures

None.

## Summary

**32 passed, 0 failed, 0 skipped.** Shippable. Full gate green: `typecheck` clean, `lint`
clean, **981 tests across 52 files** (was 945 across 48 — 36 new), `validate:products` PASS, `build`
exit 0.

Two throwaway orders and one customer from TC-29/TC-30 are left in the local development
database as the evidence above. The local database is disposable
([ADR-040](../decisions/ADR-040-postgres-for-orders.md)); `npx prisma migrate reset` clears them.
