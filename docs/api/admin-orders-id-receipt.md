# POST /admin/api/orders/{id}/receipt

Records the two facts that arrive on their own schedule: the parcel physically back on the
shelf, and the courier's cash actually handed over.

**Two public URLs, one handler**, as in
[admin-orders-id-status.md](admin-orders-id-status.md).

## Request

| | |
| --- | --- |
| Method | `POST` |
| Runtime | `nodejs` |
| Caching | `dynamic = "force-dynamic"`; `Cache-Control: no-store` |
| Auth | A live admin session, resolved against Postgres inside the handler |

```ts
interface AdminOrderReceiptRequestBody {
  /** Only meaningful when the order is rto or returned. */
  itemReceivedBack?: boolean;
  /** Only meaningful when the payment type is cod or partial_cod. */
  codAmountCollected?: boolean;
}
```

**Both fields are optional, and a field that is absent is not written.** That is what makes the
two toggles on the detail page independent: each posts only its own field, so ticking one
cannot clear the other. A non-boolean value is treated as absent.

## Server-side validation

1. **Session.** No live session → `401`.
2. **Order exists.** → `404` otherwise.
3. **`itemReceivedBack`**, if present, requires `orders.status` to be `rto` or `returned` →
   `ITEM_RETURN_NOT_EXPECTED` otherwise. Nothing is coming back on an order that has not been
   turned around or returned.
4. **`codAmountCollected`**, if present, requires `orders.payment_type` to be `cod` or
   `partial_cod` → `NO_COD_TO_COLLECT` otherwise. A prepaid order has no cash to collect, which
   is why the toggle is absent from its page rather than merely disabled.
5. **Something was named.** A body naming neither field returns `UNCHANGED`.
6. **The order has not moved.** The `UPDATE` is guarded on the status checks 3 and 4 were made
   against; a concurrent change matches nothing and returns `CONCURRENT_CHANGE`.

Neither flag is tied to the status change that made it relevant. A courier turns a parcel
around on Tuesday and the box reaches the shelf the following Monday; a COD remittance is
reconciled whenever the courier settles.

The status guard in step 6 is not a contradiction of that. The **flags** are independent of
status; the **permission to set them** is not, and steps 3 and 4 read a status another tab can
move in between. The guard makes the check and the write one act, and is the same shape the
status and address endpoints use. See
[ADR-048](../decisions/ADR-048-database-health-and-failure-surfaces.md).

## Side effects

One guarded `UPDATE` on `orders`, and no transaction, because there is no second write to be
atomic with. Each named flag is written with its own timestamp: `itemReceivedBackAt` /
`codCollectedAt` are set to now when the flag becomes `true` and cleared to `null` when it
becomes `false`.

**No `order_status_history` row.** Unlike an address edit, these two carry their own timestamp
on the order row, so the row already records what happened and when; a second copy in the audit
table would be the duplication
[ADR-040's addendum](../decisions/ADR-040-postgres-for-orders.md) argues against.

## Responses

### 200 OK

```json
{ "status": "UPDATED" }
```

```json
{ "status": "UNCHANGED" }
```

### 401 Unauthorized

```json
{ "status": "REJECTED", "error": "UNAUTHENTICATED", "message": "Sign in again to make changes." }
```

### 404 Not Found

```json
{ "status": "REJECTED", "error": "NOT_FOUND", "message": "That order no longer exists." }
```

### 409 Conflict

```json
{
  "status": "REJECTED",
  "error": "CONCURRENT_CHANGE",
  "message": "This order moved while the page was open. Reload it and try again."
}
```

### 422 Unprocessable Entity

| `error` | Fires when |
| --- | --- |
| `ITEM_RETURN_NOT_EXPECTED` | `itemReceivedBack` on an order that is not `rto` or `returned` |
| `NO_COD_TO_COLLECT` | `codAmountCollected` on a `prepaid` order |

```json
{
  "status": "REJECTED",
  "error": "NO_COD_TO_COLLECT",
  "message": "This order was paid up front, so there is no cash to collect on delivery."
}
```

### 503 Service Unavailable

The database could not be reached — a Prisma connectivity, initialisation or pool-timeout
fault. Answered in the same shape as every other rejection rather than as a bare 500, and it
covers the **session read** as well as the write: the cookie is resolved against Postgres, so an
outage fails there before the handler body runs.

```json
{
  "status": "REJECTED",
  "error": "DATABASE_UNAVAILABLE",
  "message": "The order database did not answer, so nothing about this order was changed. Try again in a moment. If it keeps failing, the database itself is down."
}
```

### 500 Internal Server Error

Any other unexpected failure. Kept distinct from the 503 so an operator is not sent to restart a
database that is running.

```json
{
  "status": "REJECTED",
  "error": "SERVER_ERROR",
  "message": "Something went wrong on the server, so nothing about this order was changed. Try again. If it keeps failing, the server log has the detail."
}
```

**"Nothing was changed" is a guarantee, not a reassurance.** The status and address writes run
inside one `prisma.$transaction`, and the receipt write is a single statement. There is no path
here that half-changes an order.

The exception itself is never in the body. It is logged under `[admin-order-action]` with the
action and the order id. See
[ADR-048](../decisions/ADR-048-database-health-and-failure-surfaces.md).

## Security notes

- **Reads no secret from the environment.**
- **The session is resolved against Postgres here.**
- **Both preconditions are read from the order**, never from the request, so a toggle the UI
  never shows is still a toggle the endpoint refuses.
