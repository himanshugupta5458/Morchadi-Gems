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

Neither flag is tied to the status change that made it relevant. A courier turns a parcel
around on Tuesday and the box reaches the shelf the following Monday; a COD remittance is
reconciled whenever the courier settles.

## Side effects

One `UPDATE` on `orders`, and no transaction, because there is no second write to be atomic
with. Each named flag is written with its own timestamp: `itemReceivedBackAt` /
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

## Security notes

- **Reads no secret from the environment.**
- **The session is resolved against Postgres here.**
- **Both preconditions are read from the order**, never from the request, so a toggle the UI
  never shows is still a toggle the endpoint refuses.
