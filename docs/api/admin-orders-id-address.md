# POST /admin/api/orders/{id}/address

Corrects one order's shipping address, while the parcel has not left.

**Two public URLs, one handler**, exactly as
[admin-orders-id-status.md](admin-orders-id-status.md) describes: the admin subdomain reaches
this at `/api/orders/{id}/address` and a development machine at
`/admin/api/orders/{id}/address`.

## Request

| | |
| --- | --- |
| Method | `POST` |
| Runtime | `nodejs` |
| Caching | `dynamic = "force-dynamic"`; `Cache-Control: no-store` |
| Auth | A live admin session, resolved against Postgres inside the handler |

`{id}` is `orders.id`, upper-cased before lookup.

```ts
interface AdminOrderAddressRequestBody {
  name: string;
  phone: string;
  email: string;
  line1: string;
  /** The one optional field. Send "" to clear it. */
  line2: string;
  city: string;
  /** Must be one of the 36 values in INDIAN_STATES. */
  state: string;
  pincode: string;
}
```

Any missing field is read as the empty string and fails validation as an empty field would.

## Server-side validation

1. **Session.** No live session → `401`.
2. **Order exists.** → `404` otherwise.
3. **The parcel has not left.** `orders.status` must be `placed` or `packed`. Anything from
   `shipped` onwards, and every terminal state, → `ADDRESS_LOCKED`. The panel already renders
   the address as plain text in those states; this is the check that makes it a rule about the
   data rather than about the screen.
4. **The address is valid.** `validateAddressForm` from `lib/address.ts` — the same validator
   the storefront's checkout uses, so a corrected address is held to exactly the standard the
   original was: a ten-digit Indian mobile, a PIN code that does not start with zero, a state
   from the list. The first failing field's message is returned as `ADDRESS_INVALID`.
5. **Something actually changed.** A submission identical to what is stored writes nothing and
   returns `UNCHANGED`.

## Side effects

Inside one `prisma.$transaction`:

1. `orders.shipping_address` is replaced with the validated, trimmed address.
2. One `order_status_history` row carrying the order's **unchanged** status, the moment, the
   session admin's username, and a reason naming the fields that moved —
   `Address updated (line1, pincode)`.

An address edit is not a status change and the order's `status` is not touched.
[ADR-044](../decisions/ADR-044-admin-order-detail-and-layout-split.md) records why
`order_status_history` is the right home for the audit row rather than a new column or a new
table.

## Responses

### 200 OK

```json
{ "status": "UPDATED" }
```

```json
{ "status": "UNCHANGED" }
```

`UNCHANGED` means the submission matched what was stored. Nothing was written, including no
audit row.

### 401 Unauthorized

```json
{ "status": "REJECTED", "error": "UNAUTHENTICATED", "message": "Sign in again to make changes." }
```

### 404 Not Found

```json
{ "status": "REJECTED", "error": "NOT_FOUND", "message": "That order no longer exists." }
```

### 409 Conflict

`CONCURRENT_CHANGE`, if the order's status moved between the read and the write.

### 422 Unprocessable Entity

| `error` | Fires when |
| --- | --- |
| `ADDRESS_LOCKED` | the order is `shipped` or later |
| `ADDRESS_INVALID` | any field fails the storefront's address validator |

```json
{
  "status": "REJECTED",
  "error": "ADDRESS_LOCKED",
  "message": "The parcel has already left, so this address can no longer be changed. Contact the courier instead."
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
- **The session is resolved against Postgres here**, and `changedBy` comes from it.
- **The editable window is read from the order**, never from the request. A body claiming the
  order is still `placed` changes nothing.
- **Customer data is overwritten in place**, which is why this endpoint is the one non-status
  action that writes an audit row: the previous value is gone, and the timeline is the only
  record that it was ever different.
