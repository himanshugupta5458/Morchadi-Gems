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
keeping the segment that says which surface they belong to:

| Route handler | Doc file |
| --- | --- |
| `app/api/checkout/route.ts` | `checkout.md` |
| `app/api/orders/verify/route.ts` | `orders-verify.md` |
| `app/api/webhooks/cashfree/route.ts` | `webhooks-cashfree.md` |
| `app/admin/api/login/route.ts` | `admin-login.md` |

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
| `POST /api/notify-admin` | [notify-admin.md](notify-admin.md) |
| `POST /admin/api/login` | [admin-login.md](admin-login.md) |
| `POST /admin/api/logout` | [admin-logout.md](admin-logout.md) |

Every route handler in the repository is documented — the three under `app/api/` and the two
under `app/admin/api/`. `verify-order` is the only one without a backing ADR — payment
verification shipped in prompt 13, which produced no decision record — so its contract file
carries the reasoning that would otherwise live in an ADR.

**The two admin routes have a second public URL each.** They are served on the admin subdomain
with the `/admin` prefix removed by a middleware rewrite, so `POST /admin/api/login` is
`POST https://admin.morchadigems.com/api/login` in production. Both contracts state both
addresses; the mechanism is [ADR-041](../decisions/ADR-041-admin-subdomain-and-auth.md).
