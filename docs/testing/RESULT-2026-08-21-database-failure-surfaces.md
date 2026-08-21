# Test Result: Database health and per-surface failure behaviour — 2026-08-21

- **Plan:** [PLAN-database-failure-surfaces.md](PLAN-database-failure-surfaces.md)
- **Commit:** `cc865b9` plus the working tree of prompt 56
- **Environment:** local, Node 20, Vitest 4.1.10, Docker Postgres healthy at `DATABASE_URL`,
  Cashfree not involved

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | `lib/health.test.ts` — against the live Docker Postgres |
| TC-02 | Pass | `lib/health.test.ts` — the real route handler, 200 and `no-store` |
| TC-03 | Pass | `lib/health.test.ts` |
| TC-04 | Pass | `lib/health.test.ts` — `schema-mismatch`, distinct from `unreachable` |
| TC-05 | Pass | `lib/health.test.ts` — resolved in ~25 ms against a 25 ms bound |
| TC-06 | Pass | `lib/health.test.ts` — key set is exactly `checkedAt, database, status` |
| TC-07 | Pass | `lib/health-database-failure.test.ts` |
| TC-08 | Pass | `lib/health-database-failure.test.ts` — 503 while the homepage renders |
| TC-09 | Pass | `lib/health-database-failure.test.ts` |
| TC-10 | Pass | `lib/admin-order-database-failure.test.ts` — all three endpoints |
| TC-11 | Pass | Same file; the session read is what fails, and is inside the boundary |
| TC-12 | Pass | `lib/admin-order-database-failure.test.ts` — 500 `SERVER_ERROR` |
| TC-13 | Pass | Same file, driving the real `submitAdminOrderAction` |
| TC-14 | Pass | Same file |
| TC-20 | Pass | `lib/admin-order-database-failure.test.ts` — 503 `UNAVAILABLE`, no cookie |
| TC-21 | Pass | `lib/admin-login-sweep.test.ts` — 200 and a `Set-Cookie` despite the sweep throwing |
| TC-22 | Pass | `lib/admin-login-sweep.test.ts` |
| TC-23 | Pass | `lib/admin-login-sweep.test.ts` — 401 still 401 |
| TC-30 | Pass | `lib/tracking-database-failure.test.tsx` |
| TC-31 | Pass | `lib/tracking-database-failure.test.tsx` |
| TC-32 | Pass | `lib/tracking-database-failure.test.tsx` |
| TC-33 | Pass | `lib/tracking-database-failure.test.tsx` |
| TC-40 | Pass | `lib/admin-page-database-failure.test.tsx` |
| TC-41 | Pass | Same file — `redirect()` call count unchanged |
| TC-42 | Pass | Same file — neither empty-state sentence present |
| TC-43 | Pass | Same file |
| TC-44 | Pass | Same file — `notFound()` call count unchanged |
| TC-50 | Pass | `lib/admin-order-updates.test.ts` |
| TC-51 | Pass | `lib/admin-order-updates.test.ts` — `where` is `{ id, status: "rto" }` |

## What was verified beyond the assertions

**One thing the plan asserts about Prisma was checked against Postgres rather than assumed.**
The schema probe is `prisma.order.findFirst({ where: { id: "" } })`, and the whole claim rests on
Prisma emitting the model's full column list even for a `WHERE` that matches nothing. Query
logging was switched on and the emitted SQL read:

```sql
SELECT "public"."orders"."id", "public"."orders"."created_at", … "public"."orders"."refund_amount"
FROM "public"."orders" WHERE "public"."orders"."id" = $1 LIMIT $2 OFFSET $3
```

All twenty-five columns, both enum casts, zero rows. A database missing any of them fails at
parse time, which is what makes TC-04 a real check on an unapplied migration and not a
plausible-sounding one.

**Seven mutations, each confirming the tests fail on the code as it was.** A test that passes
against the bug it describes is decoration.

| Mutation | Cases that failed |
| --- | --- |
| `updateAdminOrderReceipt` back to an unguarded `order.update` | TC-50, TC-51 |
| `findPublicOrderTracking`'s catch rethrows | TC-30 – TC-33 |
| The order list's catch rethrows | TC-42, TC-43 |
| `runAdminOrderAction`'s catch rethrows | TC-10, TC-12, TC-13, TC-14 |
| Login calls `deleteExpiredAdminSessions()` bare again | TC-21, TC-22 |
| The health probe's second probe removed | TC-04 |
| The protected layout throws instead of rendering its error state | TC-40, TC-41 |

What survived each mutated run is as informative as what fell. The action-boundary mutation left
only the login case standing, because login carries its own catch; the sweep mutation left only
TC-23, because a wrong password never reaches the sweep; and the two page mutations left the
surfaces they did not touch, because each of the three admin screens catches for itself rather
than relying on a neighbour.

## The outage, run for real

Mocking Postgres at the module boundary is what makes the cases above deterministic, but it
proves the handlers behave — not that the deployment does. So the whole thing was also run
against a **production build with the database genuinely stopped**: `next start` on port 3100,
then `docker compose stop postgres`, then the same commands `DEPLOY.md` §5 tells an operator to
run.

| Request | Postgres up | Postgres **stopped** |
| --- | --- | --- |
| `GET /api/health` | `200` `{"status":"healthy","database":"reachable"}` | **`503`** `{"status":"unhealthy","database":"unreachable"}` |
| `GET /` | `200` | `200` |
| `GET /shop` | `200` | `200` |
| `GET /product/P001` | `200` | `200` |
| `GET /track?order_id=…` | `200` | `200`, rendering `ORDER_NOT_FOUND_MESSAGE` verbatim |
| `GET /admin/orders` | order list | `200` rendering **"The order database did not answer"** and "not being recorded"; zero occurrences of "No active orders yet" |
| `POST /admin/api/login` | `401`/`200` | **`503`** `{"status":"UNAVAILABLE","error":"…It is not your password…"}` |
| `POST /admin/api/orders/{id}/status` | `401` | **`503`** `{"status":"REJECTED","error":"DATABASE_UNAVAILABLE","message":"…nothing about this order was changed…"}` |

The middle four rows are the argument of §2 of ADR-048 in one table: **every shopper-facing page
served normally throughout an outage that `/api/health` reported as a 503.** A container health
check wired to the new route would have killed that container.

`docker compose start postgres` and the route returned `200` again **within about two seconds
and with no restart** — Prisma reconnects on its own, which is the other half of why an outage
must not be allowed to recycle the container. With the database back, the same bogus session
cookie that had rendered the error state went back to a `307` to the login page: an unresolvable
session and an invalid one are told apart again the moment the database can tell them apart.

## Failures

None.

## Summary

**29 of 29 cases pass, 0 fail, 0 skip** for this plan, carried by **28 new test functions** —
26 in six new files, plus two added to `lib/admin-order-updates.test.ts`. The counts differ
by exactly one: TC-10 and TC-11 are the same loop over the three endpoints, since the session
read failing *is* what TC-10 exercises. Full suite **1261/1261** across 75 files, up from 1233 across 69; no
existing test was edited, skipped or deleted.

`npm run typecheck`, `npm run lint`, `npm run validate:products` and `npm run build` all green;
the build emits 75/75 static pages, unchanged, since `/api/health` is dynamic by declaration.

Shippable. The one thing this cannot verify from inside the repository is that Coolify's own
health-check path is set to `/` rather than to the new route — a dashboard setting, documented
as a manual step in §5b of `DEPLOY.md` and carried on the **[VERIFY WITH OWNER]** list.
