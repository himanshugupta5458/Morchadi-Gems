# POST /admin/api/orders/{id}/status

Moves one order along its lifecycle, records why, and settles the refund — in one request and
one database transaction.

**Two public URLs, one handler.** On the admin subdomain this route is reached at
`https://admin.morchadigems.com/api/orders/{id}/status`, which `middleware.ts` rewrites to
`/admin/api/orders/{id}/status`. In local development it is reached by its internal path.
Neither address is written down in a component: the page resolves it from the request's
hostname with `resolveAdminOrderActionHref`. See
[ADR-041](../decisions/ADR-041-admin-subdomain-and-auth.md) and
[ADR-044](../decisions/ADR-044-admin-order-detail-and-layout-split.md).

## Request

| | |
| --- | --- |
| Method | `POST` |
| Runtime | `nodejs` — opens a Postgres transaction |
| Caching | `dynamic = "force-dynamic"`; every response carries `Cache-Control: no-store` |
| Auth | A live admin session, resolved against Postgres inside the handler |

`{id}` is `orders.id` — the ten-character order number
([ADR-043](../decisions/ADR-043-order-id-as-primary-identifier.md)), the same value the order
list links each row with. It is upper-cased before lookup, so a lowercased copy from a chat
client still resolves. It is never `cashfree_order_id`.

```ts
interface AdminOrderStatusRequestBody {
  /** One of the seven OrderStatus values. Trimmed. */
  status: string;
  /** Required when status is rto, returned or cancelled. Max 300 characters. */
  reason?: string;
  /** Rupees, up to two decimals, as a string. Required for prepaid and partial_cod. */
  refundAmount?: string;
  /** The COD path's replacement for an amount: an explicit "nothing goes back". */
  refundAcknowledged?: boolean;
}
```

`Content-Type: application/json` is required in practice. A body that is not a JSON object is
treated as `{}` and fails validation like any other empty submission — never a 500. That is also
the CSRF property `/admin/api/login` relies on: a cross-site `<form>` cannot send JSON without a
preflight the browser will not grant, and the session cookie is `SameSite=Lax`, which does not
ride a cross-site POST at all.

**`changedBy` is not in the body and cannot be.** The audit row names the session's admin.

## Server-side validation

In order. Every check below is also performed by the browser before the request is sent — the
status dropdown offers only valid next steps — and every one of them is repeated here, because
the form is HTML and the operator holds a cookie.

1. **Session.** No live `admin_sessions` row for the cookie → `401`. Middleware has already
   turned away a request with no cookie at all; a forged cookie reaches this check.
2. **Order exists.** `orders.id` not found → `404`.
3. **Status is one of the seven.** Otherwise `UNKNOWN_STATUS`.
4. **The transition is in `ORDER_STATUS_TRANSITIONS`.** `placed → delivered`,
   `cancelled → packed` and every other absent edge → `INVALID_TRANSITION`. The table is in
   `lib/order-transitions.ts` and is the same one the dropdown reads.
5. **Reason.** Longer than 300 characters → `REASON_TOO_LONG`. Empty, when the new status is
   `rto`, `returned` or `cancelled` → `REASON_REQUIRED`. Optional otherwise, and kept if given.
6. **Refund**, only when the new status is `rto`, `returned` or `cancelled`:
   - `paymentType = "cod"` → `refundAcknowledged` must be `true`, else
     `REFUND_NOT_ACKNOWLEDGED`. Any `refundAmount` sent is ignored.
   - otherwise → `refundAmount` must be present (`REFUND_AMOUNT_REQUIRED`), must parse as
     rupees to at most two decimals (`REFUND_AMOUNT_INVALID`), and must not exceed
     `orders.amount_prepaid` (`REFUND_AMOUNT_TOO_HIGH`). The ceiling is what was *collected*,
     not the order total, which is the distinction that matters on a `partial_cod` order.
7. **The order has not moved.** The `UPDATE` is guarded on the status the plan was made
   against; a concurrent change matches nothing and returns `CONCURRENT_CHANGE`. No history row
   is written in that case.

## Side effects

Both writes happen inside one `prisma.$transaction`, or neither does.

1. `orders.status` is set to the new status. When the status carries a refund question,
   `is_refunded`, `refund_amount` and `refunded_at` are set with it; otherwise those three
   columns are **not touched**.
2. One `order_status_history` row: the new status, the moment, the session admin's username,
   and the reason if there is one.

`is_refunded` is derived, never submitted: `refund_amount > 0`. `refunded_at` is stamped only
when `is_refunded` is true, so the invariant `is_refunded ≡ refunded_at IS NOT NULL` recorded in
[ADR-040](../decisions/ADR-040-postgres-for-orders.md) holds. A refund of `0` is still recorded
as a decision — `refund_amount = 0` is distinct from the `null` of an order nobody has decided
about.

## Responses

### 200 OK

```json
{ "status": "UPDATED" }
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

Every validation failure, each with a sentence the panel shows verbatim.

| `error` | Fires when |
| --- | --- |
| `UNKNOWN_STATUS` | `status` is not one of the seven |
| `INVALID_TRANSITION` | the lifecycle has no edge from the current status to the requested one |
| `REASON_REQUIRED` | `rto`, `returned` or `cancelled` with no reason |
| `REASON_TOO_LONG` | reason over 300 characters |
| `REFUND_AMOUNT_REQUIRED` | prepaid or partial COD, no amount given |
| `REFUND_AMOUNT_INVALID` | the amount is not rupees to at most two decimals |
| `REFUND_AMOUNT_TOO_HIGH` | the amount exceeds `amount_prepaid` |
| `REFUND_NOT_ACKNOWLEDGED` | a COD order whose no-refund state was not confirmed |

```json
{
  "status": "REJECTED",
  "error": "INVALID_TRANSITION",
  "message": "An order that is Placed cannot become Delivered."
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

- **Reads no secret from the environment.** Its only credential path is `DATABASE_URL`, which is
  server-only.
- **The session is resolved against Postgres here**, not inherited from middleware. Middleware
  runs on the Edge runtime and can only see that *a* cookie was sent.
- **`changedBy` comes from the session**, never from the body, so the audit trail cannot be
  written in somebody else's name.
- **The refund ceiling is read from the order**, never from the request.
