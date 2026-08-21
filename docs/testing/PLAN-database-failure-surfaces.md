# Test Plan: Database health and per-surface failure behaviour

- **Scope:** what every surface that touches Postgres does when Postgres does not answer, and
  whether the new `/api/health` route tells the truth about it. Six surfaces are in scope: the
  health route, the three admin order-action endpoints, the admin login route and its expiry
  sweep, `/track`, the two admin pages plus the protected layout that renders before them, and
  the receipt writer's concurrency guard. The decisions being tested are recorded in
  [ADR-048](../decisions/ADR-048-database-health-and-failure-surfaces.md).

  Explicitly **not** covered here: the checkout path, which
  [`lib/checkout-database-failure.test.ts`](../../lib/checkout-database-failure.test.ts) already
  holds to the opposite contract and which this work does not touch; whether Coolify's health
  check is in fact configured with `/`, which is a dashboard setting no test can read
  (**[VERIFY WITH OWNER]**, §5b of [DEPLOY.md](../../DEPLOY.md)); and whether production
  migrations have been applied, which is the thing `/api/health` exists to let somebody check by
  hand.

- **Prerequisites:** none for the failure cases. Postgres is **mocked at the module boundary**
  rather than stopped, the way `checkout-database-failure.test.ts` does it, so the real handlers
  and page components run against a client that refuses everything — exactly as they would
  against a database that is down, out of connections or mid-migration. The two live-database
  cases (TC-01, TC-02) need a reachable `DATABASE_URL` and **skip with a printed reason** when
  there is none.

## Cases

### The health route tells the truth about the database

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | A healthy database | `checkDatabaseHealth(prisma)` against local Postgres | `healthy` / `reachable`, and `checkedAt` parses as a date | Automated |
| TC-02 | `GET /api/health` on a healthy deployment | Call the real route handler | `200`, `Cache-Control: no-store`, `{status:"healthy",database:"reachable"}` | Automated |
| TC-03 | A refused connection | Stub client rejecting `SELECT 1` with `PrismaClientInitializationError` | `unhealthy` / `unreachable`, returned rather than thrown | Automated |
| TC-04 | **Postgres up, migrations not applied** | Stub whose `SELECT 1` succeeds and whose `order.findFirst` rejects with `P2022` | `unhealthy` / `schema-mismatch` — the failure the old healthcheck could not see at all | Automated |
| TC-05 | A database that accepts the connection and never answers | Stub returning promises that never settle; 25 ms bound | `unhealthy` / `unreachable` in well under the bound, rather than hanging | Automated |
| TC-06 | The report discloses nothing | Assert the report's key set and search it for host, port and driver name | Exactly `checkedAt, database, status`; no `localhost`, no `5432`, no `Prisma`; the reason is in the `[health]` log | Automated |
| TC-07 | `GET /api/health` with Postgres refused | Module-level mock rejecting everything | `503`, `no-store`, `{status:"unhealthy",database:"unreachable"}` | Automated |
| TC-08 | The route disagrees with the homepage, deliberately | Same mock; render the storefront home component | Health is `503` **while the homepage renders fine** — the reason this route had to be added rather than the container check tightened | Automated |
| TC-09 | No connection detail in the body | Read the raw 503 body as text | No `localhost`, `5432`, `prisma` or `Postgres`; `[health]` log names `SELECT 1` | Automated |

### The three admin order actions fail loudly, in their documented shape

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-10 | Each endpoint with Postgres unreachable | POST to status, address and receipt with a session cookie present and every Prisma call rejecting `PrismaClientInitializationError` | `503`, `no-store`, `{status:"REJECTED",error:"DATABASE_UNAVAILABLE"}`, message promising nothing was changed. **Not** an unhandled rejection | Automated |
| TC-11 | The session read is inside the boundary | Same as TC-10 — the cookie resolves against Postgres, so the failure happens *before* any handler body | All three still answer TC-10's shape | Automated |
| TC-12 | A failure that is not the database | Same three, rejecting a `TypeError` | `500`, `error: "SERVER_ERROR"`, and the message does **not** say "database" | Automated |
| TC-13 | The panel can render the message | Drive `submitAdminOrderAction` against the real 503 | `ok: false` with the endpoint's own sentence, not the "did not say why" fallback | Automated |
| TC-14 | The exception goes to the log | Inspect `console.error` | `[admin-order-action]`, naming the action and the order id; nothing of it in the body | Automated |

### Signing in

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-20 | Login with Postgres unreachable | POST correct-looking credentials, everything rejecting | `503`, `status: "UNAVAILABLE"`, a message saying it is not the password. No `Set-Cookie` | Automated |
| TC-21 | **The expiry sweep fails during a correct login** | `admin.findUnique` resolves a real bcrypt hash; `adminSession.deleteMany` throws; `adminSession.create` succeeds | `200 SIGNED_IN` **with** the session cookie. The sweep was attempted and the session was created | Automated |
| TC-22 | The sweep's failure is invisible to the client | Read the raw body | No `deadlock`, no `admin_sessions`; `[admin-session]` log says the login continues regardless | Automated |
| TC-23 | The sweep was never the credential check | Same mock, wrong password | `401`, no cookie — degrading the sweep did not soften the gate | Automated |

### `/track` degrades to the copy it already has

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-30 | A well-formed order number, database down | Render the real page component with `order.findUnique` rejecting | `ORDER_NOT_FOUND_MESSAGE`, the page's own copy — not an error screen | Automated |
| TC-31 | The shopper still has something to do | Same render | The heading and the form, with the typed number still in it | Automated |
| TC-32 | Nothing about the database reaches the customer | Same render | No `localhost:5432`, `Postgres` or `prisma` in the HTML; `[order-tracking]` log names the id | Automated |
| TC-33 | The outage is not an oracle | Render a malformed id and a well-formed one | Both answer with the same message, so a failing database has not made them distinguishable | Automated |

### The admin panel says so, in its own words

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-40 | The protected layout with Postgres unreachable | Render the real layout with the session lookup rejecting | The panel's error state — "The order database did not answer" — and the sentence that orders are still arriving unrecorded. Not Next's generic 500 | Automated |
| TC-41 | It fails closed, and does not blame the session | Same render | No nav rendered, and `redirect()` **not** called: an outage must not read as "your session expired" | Automated |
| TC-42 | The order list with Postgres unreachable | Render the real page | The error state, and **neither** "No active orders yet" **nor** "No orders match these filters" — the most dangerous possible screen | Automated |
| TC-43 | What the list logs, and what it does not render | Same render | `[admin-panel] the order list could not be read from Postgres`; no connection string on the page | Automated |
| TC-44 | One order's detail page with Postgres unreachable | Render the real page for a valid-looking id | The error state naming that order, and `notFound()` **not** called — a dead database is not a missing order | Automated |

### The receipt write loses a race

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-50 | The row moved between the read and the write | Stub client whose `findUnique` returns an `rto` order and whose `updateMany` reports `count: 0` | `REJECTED` / `CONCURRENT_CHANGE` with the same sentence its two siblings use — never an unhandled `P2025` | Automated |
| TC-51 | The guard is the status the preconditions were read from | Same stub reporting `count: 1`; capture the `where` | `{ id, status: "rto" }`, and the outcome is `UPDATED` | Automated |
