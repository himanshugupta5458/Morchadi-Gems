# API Contracts

## Purpose

One file per API route handler — those under `app/api/`, and the admin panel's own under
`app/admin/api/` — documenting the contract that route promises: its method, its request shape, every response it can return, and the server-side
validation it performs.

These files are the reference the frontend is written against. If the route and the
document disagree, that is a bug in one of them — fix it in the same change.

The server's authority over money comes from `data/products.json`, not from a database — that
did not change when Postgres arrived for orders and admins
([ADR-040](../decisions/ADR-040-postgres-for-orders.md)). Every contract that touches money must
state explicitly which values are recomputed server-side and which client-supplied values are
ignored.

## Naming convention

Mirror the route path, kebab-cased, dropping the `route.ts` filename and the `app/api/` prefix.
Route handlers that live outside `app/api/` — the admin panel keeps its own under
`app/admin/api/` so the subdomain rewrite can reach them — drop `app/` and `api/` instead,
keeping the segment that says which surface they belong to. A dynamic segment keeps its name
and loses its brackets:

| Route handler | Doc file |
| --- | --- |
| `app/api/checkout/route.ts` | `checkout.md` |
| `app/api/orders/verify/route.ts` | `orders-verify.md` |
| `app/api/webhooks/cashfree/route.ts` | `webhooks-cashfree.md` |
| `app/admin/api/login/route.ts` | `admin-login.md` |
| `app/admin/api/orders/[id]/status/route.ts` | `admin-orders-id-status.md` |
| `app/admin/api/products/[id]/route.ts` | `admin-products-id.md` |

## Required structure

```markdown
# POST /api/route-path

One-line summary.

## Request
Headers, and the request body as a TypeScript type with field-level notes.

## Server-side validation
Every check performed, in order, and what each rejects. State which client-supplied
values are recomputed or discarded.

## Responses
### 200 OK
Body shape and an example.
### 4xx / 5xx
One subsection per error, with its code, when it fires, and its body.

## Side effects
External calls made, in order (e.g. Cashfree order creation).

## Security notes
Which secrets this route reads and why they cannot leak to the client.
```

## Response headers

Every response this site serves — page, asset and API route alike — carries the six security
headers defined in `config/security-headers.mjs` and applied by `next.config.mjs` at
`/:path*`. They are not restated per route because no route varies them. The policy, and the
five Cashfree origins the Content-Security-Policy has to allow for checkout to work, are in
[ADR-034](../decisions/ADR-034-seo-audit-remediation.md).

## Index

| Route | Contract |
| --- | --- |
| `POST /api/create-order` | [create-order.md](create-order.md) |
| `GET /api/verify-order` | [verify-order.md](verify-order.md) |
| `GET /api/cod-order` | [cod-order.md](cod-order.md) |
| `GET /api/health` | [health.md](health.md) |
| `POST /api/notify-admin` | [notify-admin.md](notify-admin.md) |
| `POST /admin/api/login` | [admin-login.md](admin-login.md) |
| `POST /admin/api/logout` | [admin-logout.md](admin-logout.md) |
| `POST /admin/api/orders/{id}/status` | [admin-orders-id-status.md](admin-orders-id-status.md) |
| `POST /admin/api/orders/{id}/address` | [admin-orders-id-address.md](admin-orders-id-address.md) |
| `POST /admin/api/orders/{id}/receipt` | [admin-orders-id-receipt.md](admin-orders-id-receipt.md) |
| `PATCH /admin/api/products/{id}` | [admin-products-id.md](admin-products-id.md) |

Every route handler in the repository is documented — the five under `app/api/` and the six
under `app/admin/api/`. `verify-order` is the only one without a backing ADR — payment
verification shipped in prompt 13, which produced no decision record — so its contract file
carries the reasoning that would otherwise live in an ADR.

**`verify-order` and `cod-order` are siblings, told apart by a prefix.** Both answer about one
order named by its payment reference in `?order_id=`; the first asks Cashfree because there was
a payment, the second reads Postgres because there was not. `MG_…` belongs to the first and
`COD_…` to the second, the two patterns are disjoint, and each route refuses the other's
references without making any outbound call
([ADR-059](../decisions/ADR-059-checkout-payment-paths.md)).

**Every admin route has a second public URL.** They are served on the admin subdomain with the
`/admin` prefix removed by a middleware rewrite, so `POST /admin/api/login` is
`POST https://admin.morchadigems.com/api/login` in production. Each contract states both
addresses; the mechanism is [ADR-041](../decisions/ADR-041-admin-subdomain-and-auth.md).

**Login and logout are public paths; the three order actions are not.** Middleware lets a
request with no session cookie reach the first two — a login has to be reachable, and a stale
cookie has to be clearable — and redirects it away from the others before a handler runs. That
gate is not the authentication: every one of the five resolves the session itself, on the Node
runtime, against Postgres. See
[ADR-044](../decisions/ADR-044-admin-order-detail-and-layout-split.md).
