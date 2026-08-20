# Test Plan: order capture in Postgres

- **Scope:** the Postgres write added to `/api/create-order` and `/api/verify-order` by
  [ADR-042](../decisions/ADR-042-order-capture-in-postgres.md) — the schema's payment-type
  fields, the uniqueness of `cashfree_order_id`, the 10-character order id, the capture itself,
  and the property that none of it can affect a shopper. **Not covered:** pricing arithmetic
  (see [PLAN-order-pricing.md](PLAN-order-pricing.md), unchanged by this work), the admin UI
  that will read these rows, any COD or partial-COD flow, and production Postgres.
- **Prerequisites:** local Postgres healthy (`docker compose up -d`), `DATABASE_URL` in `.env`
  and `.env.local`, migrations applied, and for the end-to-end cases real Cashfree **sandbox**
  credentials in `.env.local`.

## Cases

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | The payment-type columns exist with the intended defaults | Write an order supplying only `amountPrepaid` | `payment_type = prepaid`, `amount_due = 0`, both COD flags false, both timestamps null | Automated |
| TC-02 | `cod` and `partial_cod` are writable and round-trip | Write one of each with COD and item-received-back fields set | Values return as written | Automated |
| TC-03 | `amount_prepaid` is required | Omit it from a create | Type error at compile time; insert refused at runtime | Automated |
| TC-04 | Two orders cannot claim one Cashfree payment | Create two orders with one `cashfreeOrderId` | Second fails with Prisma `P2002` | Automated |
| TC-05 | The order-id alphabet is exactly the 31 unambiguous characters | Inspect the exported constant | `23456789ABCDEFGHJKMNPQRSTUVWXYZ`; `0`, `O`, `1`, `I`, `L` absent | Automated |
| TC-06 | No generated id ever contains an ambiguous character | Generate 5,000 ids | Every id matches `/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/` | Automated |
| TC-07 | Length is always 10 | Same sample | Every id is 10 characters | Automated |
| TC-08 | The generator reaches the whole alphabet and nothing outside it | Same sample | Set of characters drawn equals the alphabet exactly | Automated |
| TC-09 | A collision is retried, not returned | Force the uniqueness check to answer "taken" once, then "free" | Two draws; the second is returned | Automated |
| TC-10 | Several collisions in a row are survived | Force three | Four draws; a valid id returned | Automated |
| TC-11 | A permanently-failing check terminates | Force "taken" always | Throws after `MAX_ORDER_ID_ATTEMPTS`, does not hang | Automated |
| TC-12 | Capture writes all four row types | Capture one order | `Customer`, `Order`, `OrderLineItem`, `OrderStatusHistory` present with the expected values | Automated |
| TC-13 | The first status-history row is a system row | Inspect it | `status = placed`, `changed_by = "system"`, `reason = null` | Automated |
| TC-14 | A repeat phone number reuses one customer | Capture twice with one phone | One `customers` row; two orders against it | Automated |
| TC-15 | First-touch attribution is never overwritten | Capture with campaign A, then campaign B | Customer keeps A; the second order records B | Automated |
| TC-16 | A first order with no campaign leaves the customer's first touch null forever | Capture without `utm`, then with one | `first_utm_source` stays null | Automated |
| TC-17 | Line items snapshot the name and photograph | Capture, then mutate the catalogue copy | Row holds the values read at capture time | Automated |
| TC-18 | Two engravings of one product are two rows | Capture `Letter: A` ×1 and `Letter: B` ×2 | Two rows, quantities 1 and 2 | Automated |
| TC-19 | Two identical lines collapse into one row | Capture `Letter: A` twice | One row, quantity summed | Automated |
| TC-20 | A fractional quantity that the pricing core tolerated is still recorded | Capture two lines of `qty: 1.5` | One row of quantity 3, integer, options dropped rather than the order lost | Automated |
| TC-21 | **A dead database does not break create-order** | Mock the Prisma client to reject everything; POST a valid order | 200 with the same three-field body, `Cache-Control: no-store`, one Cashfree call | Automated |
| TC-22 | No database detail reaches the client | Same | Response body mentions neither the database, Postgres, Prisma, nor the host; the failure is in the `[order-capture]` log | Automated |
| TC-23 | Pricing is unaffected by the write failing | Same | `order_amount` and `order_tags` identical to the healthy path | Automated |
| TC-24 | **A dead database does not break verify-order** | Same mock; GET a paid order | 200 `{orderId, status, amount}` unchanged; failure logged | Automated |
| TC-25 | Verification updates payment, not fulfilment | Capture, then verify as `PAID` | `cashfree_payment_status = PAID`, `status` still `placed` | Automated |
| TC-26 | Polling does not rewrite the row | Verify twice with the same status | Second call reports `UNCHANGED`, no write | Automated |
| TC-27 | An unknown Cashfree order is a silent no-op | Verify an id with no row | `UNCHANGED`, no error | Automated |
| TC-28 | The route writes the row it claims to | POST through the real route against real Postgres | Row found by `cashfree_order_id`; every column as specified | Automated |
| TC-29 | **A real sandbox order, paid, lands correctly** | Cart → create-order → Cashfree sandbox simulator (SUCCESS) → `/order-confirmation` → verify-order | All four row types written; amounts match the catalogue; status moves to `PAID` while `status` stays `placed` | Manual |
| TC-30 | A repeat shopper in the live flow reuses one customer | Second real order, same phone, different campaign | One customer row, first touch unchanged, second order carries its own campaign | Manual |
| TC-31 | `pricing.cost` still never reaches the browser | Production build, then grep `.next/static` | `cost`, `pricing`, `unitCost`, `totalCost` match zero files; controls `mrp`, `price`, `inStock` match | Manual |
| TC-32 | The money path is unchanged | `lib/money-path.test.ts` unedited | Passes as written | Automated |
