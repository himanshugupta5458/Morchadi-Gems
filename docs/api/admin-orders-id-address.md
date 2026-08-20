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

## Security notes

- **Reads no secret from the environment.**
- **The session is resolved against Postgres here**, and `changedBy` comes from it.
- **The editable window is read from the order**, never from the request. A body claiming the
  order is still `placed` changes nothing.
- **Customer data is overwritten in place**, which is why this endpoint is the one non-status
  action that writes an audit row: the previous value is gone, and the timeline is the only
  record that it was ever different.
