# ADR-048: Database health is made visible, and each surface decides for itself how to fail

- **Status:** Accepted
- **Date:** 2026-08-21
- **Prompt:** 56

## Context

[ADR-042](ADR-042-order-capture-in-postgres.md) put the order write off the critical path
deliberately: `captureOrder` never throws, a shopper mid-payment never sees a database error,
and a failed write leaves a `[order-capture]` line in the log and nothing else. That decision
is right and is not reopened here.

What it did not come with was anywhere to look. The container's health check asks for `/`,
which is rendered from `data/products.json` and returns 200 from a container whose
`DATABASE_URL` is wrong, whose Postgres is stopped, or whose migrations were never applied
(ADR-047 left `migrate deploy` explicitly unautomated). Put those two facts together and the
deployment has a failure mode with no symptom: **it takes real payments, writes zero order
rows, and reports itself healthy.** The only evidence is a log line nobody is watching, and the
first human signal is a customer asking where their parcel is.

The consolidation audit of 2026-08-21 found that gap and four more beside it, all variations of
the same question asked in different places. The three admin order-action handlers awaited
Prisma with no `try`/`catch`, so a database fault became a raw 500 instead of the typed
rejection their contracts promise. `deleteExpiredAdminSessions()` was awaited bare inside the
login route, so a housekeeping sweep could fail a correct password. `/track` and both admin
pages read Prisma with no catch at all. And `updateAdminOrderReceipt` wrote with
`order.update`, which throws `P2025` when the row has gone, unlike its two siblings.

Each of those was written by whichever prompt happened to need it, and each inherited its
error handling from whatever that prompt was thinking about at the time. None of them was ever
decided. That is the actual finding: not that any one of them is wrong, but that the project
had a stated discipline for the checkout path and nothing at all for anywhere else.

## Decision

### 1. A dedicated route answers the database question, and answers it honestly

`app/api/health/route.ts` returns `200` with `{"status":"healthy","database":"reachable"}` when
Postgres both answers and holds the schema this image expects, and `503` when it does not. It
probes twice, because there are two distinct failures and telling them apart is most of the
value:

1. `SELECT 1` — is anything there at all. Failure reports `"unreachable"`.
2. `prisma.order.findFirst({ where: { id: "" } })` — does the `orders` table match the Prisma
   Client this image was generated against. Failure reports `"schema-mismatch"`.

The second probe is the one that catches a forgotten `migrate deploy`, and it works because
Prisma builds its `SELECT` list from the model rather than from the row: that call emits all
twenty-five `orders` columns and both enum casts, with a `WHERE` that matches nothing. Postgres
validates the column list at parse time regardless, so a database missing any of them fails —
while no customer's row is read and none can be, since the empty string is not a value
[`ORDER_ID_ALPHABET`](../../lib/order-id.ts) can mint.

The probe never throws and is bounded at five seconds, because a Postgres that accepts a TCP
connection and then never answers is a real failure and a health endpoint that hangs on it
reports nothing.

The route is public and unauthenticated, so the body is three fields wide: a verdict, a cause
in one word, and a timestamp. No host, no port, no driver name, no exception text. All of that
goes to the log under `[health]`.

### 2. The container's health check stays on `/`, and this is not a compromise

Pointing Coolify's health check at `/api/health` was investigated and **rejected**. A container
health check decides whether the container lives; `/api/health` answers whether a dependency is
well. Wiring the second into the first would mean a thirty-second Postgres restart marks a
container unhealthy, gets it restarted, and fails deploys — taking down a storefront that is
still serving every page and still taking every payment, to protect it from a fault ADR-042
built it to survive.

So `/` remains exactly right for the job it does: it asks whether this process serves, and it
needs no database to answer. `/api/health` is for a person after a deploy and for an uptime
monitor, both documented in §5 and §5b of [DEPLOY.md](../../DEPLOY.md). Coolify's health-check
path is a dashboard field this repository cannot read or set, so §5b states the manual step:
confirm the path is `/`, or leave the check disabled and let the image's own `HEALTHCHECK`
apply.

### 3. `prisma migrate deploy` stays manual, and stops being invisible

Automation was investigated and **rejected**, on the evidence rather than on taste.
`migrate deploy` needs the `prisma` CLI and the `prisma/migrations` directory. The runtime image
has neither: `output: "standalone"` traces only what the server imports, which is
`@prisma/client` and its query engine. Shipping the CLI and the schema engine it drives adds
roughly 115 MB of build tooling to an image whose whole point is not carrying build tooling —
and running it from an entrypoint would put Postgres on the boot path of every container start,
so a database blip during a restart becomes a crash loop. ADR-047 rejected an entrypoint
`prisma generate` for the first of those reasons; this rejects an entrypoint `migrate deploy`
for both.

What made the manual step dangerous was never that it was manual. It was that forgetting it had
no symptom until an order was lost. Probe 2 above is that symptom, available from outside the
deployment with one unauthenticated `curl`, and DEPLOY.md §5a now ends with it.

### 4. Each surface's failure behaviour, decided rather than inherited

| Surface | Decision | Why |
| --- | --- | --- |
| Checkout (`/api/create-order`, `/api/verify-order`) | **Graceful** — unchanged | A shopper mid-payment. ADR-042; not reopened |
| `/track` | **Graceful** | A customer holding an order number. See below |
| Admin login's expired-session sweep | **Graceful** | Genuinely housekeeping. See below |
| Admin order actions (status, address, receipt) | **Loud, typed** | The operator is the person who fixes databases |
| Admin login itself | **Loud** | "Wrong password" would be a lie |
| Admin pages (list, detail, protected layout) | **Loud, styled** | An empty order list is the most dangerous screen here |

**`/track` degrades.** `findPublicOrderTracking` now catches, logs under `[order-tracking]` and
returns `null`, which the page already renders as `ORDER_NOT_FOUND_MESSAGE`. The person reading
it is a customer with a parcel number, and their two available actions — check the number,
message the shop — are identical whether the id names nothing or the database is down. Handing
them Next's generic 500 instead would tell them nothing they can use and quite a lot they
should not have. This is the same discipline as
[`findTrackingIdForCashfreeOrder`](../../lib/order-capture.ts), applied to a read.

**The login sweep degrades.** `sweepExpiredAdminSessions()` wraps the `deleteMany` and returns
`null` on failure. Deleting rows that expired last week is the one thing on the login path
nobody is waiting for, and awaiting it bare put it between a verified password and the cookie
that acts on it — so tidying could lock the owner out of their own panel. It is the only admin
surface here that fails silently, and it is the only one that is not a check.

**Everything else in the panel is loud**, and the argument is one sentence: the person looking
at this screen is the person who would restart Postgres. An order list that quietly rendered
"No active orders yet" during an outage would be the single most dangerous screen in the
application — a true-looking sentence about a quiet morning that was not quiet. So the panel
renders its own error state, which says the database failed *and* says what that means: that
checkout is still running and orders are arriving unrecorded. Loud does not mean crashing.
Next's generic 500 names no system and suggests no action, and the browser-side fallback for an
untyped API failure is "That change was refused, and the server did not say why", which is the
least useful true sentence available.

Concretely:

- The three order actions share one boundary, `runAdminOrderAction`, which wraps the **session
  read as well as the write**. `readAdminForOrderAction` resolves the cookie against Postgres,
  so a database that is down fails there first and a boundary placed after it would have caught
  nothing. It answers `503 DATABASE_UNAVAILABLE` for a Prisma connectivity fault and
  `500 SERVER_ERROR` for anything else, both in the documented response shape, both promising
  that nothing about the order was changed — which is a guarantee and not a reassurance, since
  two of the three writers run in a transaction and the third is a single statement.
- The protected layout returns `DATABASE_UNAVAILABLE` from `requireAdminSession` instead of
  throwing, and renders the error state in place of the whole panel. It **fails closed**: no
  nav, no children, no redirect to a login page that would fail at the same query and read as
  "your session expired".
- The two admin pages catch their own reads. On the detail page `notFound()` stays outside the
  `try`, because it works by throwing and a boundary that swallowed it would report a database
  outage every time an operator mistyped an order number.
- Login answers `503 UNAVAILABLE` when the credentials could not be checked at all. The
  one-message rule in `ADMIN_LOGIN_FAILURE_MESSAGE` is about telling a stranger from the owner,
  and a 503 does neither — it is returned identically for usernames that do not exist. What it
  buys is the owner not spending ten minutes on a password that was right.

### 5. The receipt write is aligned with its siblings

`updateAdminOrderReceipt` now uses `updateMany` guarded on the status it read, returning
`CONCURRENT_CHANGE` when nothing matched, exactly as `applyAdminOrderStatusChange` and
`updateAdminOrderShippingAddress` do.

The audit noted the two flags are independent of status and asked whether a guard was therefore
wrong. It is not, and the distinction is worth writing down: the **flags** are independent of
status, but the **permission to set them** is not. `acceptsItemReceivedBack(order.status)` is
re-derived from a row another tab can move between this function's read and its write, and an
unguarded `update` would happily record a parcel coming back on an order that no longer expects
one. The guard makes the check and the write one act. It also removes the last way these three
could answer differently — `update` throws `P2025` when the row has gone, where `updateMany`
matches nothing and produces a sentence an operator can act on.

## Alternatives considered

**Point Coolify's health check at `/api/health`.** Rejected — §2 above. It would couple the
storefront's uptime to Postgres and take the shop down for the exact fault it was designed to
survive. Recorded in §5b of DEPLOY.md as a setting to check and leave alone rather than as a
thing nobody thought about.

**A second liveness route so `/` stops being the health target.** Rejected as a route added for
no gain. `/` is prerendered, needs no database, and is already the honest answer to "is this
process serving".

**Ship the Prisma CLI and run `migrate deploy` from an entrypoint.** Rejected — §3 above.

**Run `migrate deploy` from a Coolify pre-deployment command.** Rejected for the same reason:
that command runs a container of the same image, which still has no CLI.

**A `_prisma_migrations` comparison in the health probe.** Rejected as cleverness. It would
need the committed migration list at runtime, which means either a generated constant that can
drift or shipping `prisma/migrations` into the image. Probe 2 already fails on the thing that
actually matters — a schema the client cannot use — and fails on it for free.

**Make the panel degrade like the storefront.** Rejected, and it is the alternative worth
naming explicitly, because consistency was the audit's framing and this ADR deliberately breaks
it. The two surfaces have different readers. Hiding a fault from someone who cannot act on it is
kindness; hiding it from the one person who can is negligence.

**One `try`/`catch` per admin route handler.** Rejected in favour of the shared boundary. Three
copies of the same catch is three chances for one of them to be subtly different, and none of
the three would have covered the session read that fails first.

## Consequences

`/api/health` is the first route in this project whose whole purpose is to fail. It is
unauthenticated by necessity — a monitor cannot hold a session — which is why its body is
deliberately uninformative and its log is not.

The panel now has an error state that a real outage is required to see. It is exercised by
`lib/admin-page-database-failure.test.tsx` rather than by hand, along with the four other new
suites: the probe itself, the route under a mocked failure, the three order actions, the login
sweep, and `/track`. All of them refuse Postgres at the module boundary, the same way
`lib/checkout-database-failure.test.ts` has since ADR-042 — the file this whole ADR is an
argument with, and agrees with.

`requireAdminSession` returns a resolution rather than an identity, which is a small breaking
change confined to its one caller. `AdminLoginResponseBody.status` gains `UNAVAILABLE`; the
existing sign-in form renders it without modification, because it already shows `error` as a
sentence.

What this does **not** do is make an outage less likely, back up the orders table, or apply a
migration. It makes each of those failures say so. The backup policy remains
**[VERIFY WITH OWNER]** and unaddressed.
