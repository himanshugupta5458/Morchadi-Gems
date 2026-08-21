# GET /api/health

Whether this deployment can reach and use its Postgres database.

It exists because nothing else in the deployment answers that question. The storefront renders
from `data/products.json` and the order write is off the critical path by design
([ADR-042](../decisions/ADR-042-order-capture-in-postgres.md)), so `/` returns 200 from a
container whose `DATABASE_URL` is wrong, whose Postgres is stopped, or whose migrations were
never applied — while it takes real payments and records none of them. See
[ADR-048](../decisions/ADR-048-database-health-and-failure-surfaces.md).

**It is not a liveness probe and must not be wired up as one.** Pointing the container's health
check here would let a thirty-second Postgres restart take down a shop that is still serving
every page and taking every payment. The container check stays on `/`; §5b of
[DEPLOY.md](../../DEPLOY.md) is the manual Coolify step that keeps it there.

## Request

| | |
| --- | --- |
| Method | `GET` (`HEAD` is answered by Next from the same handler) |
| Runtime | `nodejs` — opens a Postgres connection |
| Caching | `dynamic = "force-dynamic"`; every response carries `Cache-Control: no-store` |
| Auth | **None.** A monitor cannot hold a session, which is why the body says as little as it does |

No parameters, no body, no headers required.

`/api/` is disallowed in `robots.txt` along with every other route handler, so this is not
indexable.

## Server-side validation

None — there is no input. What it performs instead is two probes, in order, stopping at the
first failure.

1. **Connectivity.** `` prisma.$queryRaw`SELECT 1` ``. Failure → `"unreachable"`.
2. **Schema.** `prisma.order.findFirst({ where: { id: "" } })`. Failure → `"schema-mismatch"`.

The second probe catches a forgotten `prisma migrate deploy`, which the first cannot: an
unmigrated database answers `SELECT 1` perfectly. It works because Prisma builds its `SELECT`
list from the model rather than from the row — that call emits all twenty-five `orders` columns
and both enum casts, and Postgres validates the column list at parse time whether or not any row
matches. **No customer row is read**, and none can be: the empty string is not a value
`ORDER_ID_ALPHABET` can mint, so the `WHERE` matches nothing by construction.

Both probes are bounded by `HEALTH_CHECK_TIMEOUT_MS` (5 s). A Postgres that accepts the
connection and then never answers is reported `"unreachable"` rather than left hanging.

The probe never throws. A health route that could fail with an exception would be reporting its
own bug rather than the database's state.

## Responses

Always one of exactly three fields, in both the 200 and the 503 case.

```ts
interface HealthReport {
  status: "healthy" | "unhealthy";
  database: "reachable" | "unreachable" | "schema-mismatch";
  /** ISO 8601, the moment the probe finished. */
  checkedAt: string;
}
```

### 200 OK

```json
{ "status": "healthy", "database": "reachable", "checkedAt": "2026-08-21T10:07:44.812Z" }
```

### 503 Service Unavailable

Both failures use this status, so a monitor reading only the status line still learns the truth.

| `database` | Means | Fix |
| --- | --- | --- |
| `unreachable` | Nothing answered: wrong or missing `DATABASE_URL`, Postgres down, or not on this network | [DEPLOY.md](../../DEPLOY.md) §3 |
| `schema-mismatch` | Postgres answered, but `orders` is not the table this image expects | `prisma migrate deploy` — [DEPLOY.md](../../DEPLOY.md) §5a |

```json
{ "status": "unhealthy", "database": "unreachable", "checkedAt": "2026-08-21T10:07:44.812Z" }
```

## Side effects

None. Both probes are reads, and neither returns a row.

## Security notes

- **The body is deliberately uninformative.** No host, no port, no connection string, no driver
  name, no column name, no exception text. The endpoint is reachable by anyone, and the most an
  unauthenticated caller learns is that this shop's database is or is not currently well.
- **Everything omitted from the body is in the log**, under `[health]`, where the person who can
  act on it is looking.
- **Reads no secret.** Its only credential path is `DATABASE_URL`, which is server-only and never
  echoed.
- **Not reachable on the admin hostname.** Middleware rewrites every path there into `/admin/*`,
  so `admin.morchadigems.com/api/health` resolves to a route that does not exist. Use the
  storefront domain.
