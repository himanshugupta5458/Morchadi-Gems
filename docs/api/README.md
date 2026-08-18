# API Contracts

## Purpose

One file per API route handler under `app/api/`, documenting the contract that route
promises: its method, its request shape, every response it can return, and the server-side
validation it performs.

These files are the reference the frontend is written against. If the route and the
document disagree, that is a bug in one of them — fix it in the same change.

Because this project has no database, the server's authority comes from
`data/products.json`. Every contract that touches money must state explicitly which values
are recomputed server-side and which client-supplied values are ignored.

## Naming convention

Mirror the route path, kebab-cased, dropping the `app/api/` prefix and the `route.ts`
filename:

| Route handler | Doc file |
| --- | --- |
| `app/api/checkout/route.ts` | `checkout.md` |
| `app/api/orders/verify/route.ts` | `orders-verify.md` |
| `app/api/webhooks/cashfree/route.ts` | `webhooks-cashfree.md` |

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

## Index

| Route | Contract |
| --- | --- |
| `POST /api/create-order` | [create-order.md](create-order.md) |
