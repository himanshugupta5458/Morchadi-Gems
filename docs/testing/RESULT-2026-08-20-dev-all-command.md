# Test Result: `npm run dev:all` — 2026-08-20

- **Plan:** *(no plan — developer-tooling addition, verified against the prompt's own acceptance criteria)*
- **Commit:** working tree on `b824ecb`
- **Environment:** local Codespace, Docker 29.3.0, Docker Compose v2.40.3, Node v24.14.0, no Cashfree involvement

`npm run dev:all` runs [`scripts/dev-stack.mjs`](../../scripts/dev-stack.mjs): start the local
Postgres container, wait for it to report **healthy**, apply pending migrations, start the dev
server. The decision logic it depends on lives in
[`scripts/dev-stack-plan.mjs`](../../scripts/dev-stack-plan.mjs) as pure functions so it can be
tested without a Docker daemon or a remote database, and is exercised by
`lib/dev-stack-plan.test.ts` (38 cases).

## Automated — `lib/dev-stack-plan.test.ts`

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| TC-01 | `.env.example`'s own `DATABASE_URL` is recognised as the local Docker Postgres | Pass | `kind: "local"`, host `localhost`, port `5432` |
| TC-02 | `127.0.0.1`, `0.0.0.0` and bracketed `[::1]` are all this machine | Pass | Brackets stripped, so the host reads `::1` |
| TC-03 | A URL with no port assumes 5432; a non-default local port is kept | Pass | The port is what the compose lookup keys on |
| TC-04 | A Coolify-style remote host skips Docker | Pass | `kind: "remote"`, reason names the host |
| TC-05 | `postgres`, `10.0.0.7`, `my-db.internal` are each remote | Pass | Container-network and LAN hosts included |
| TC-06 | A `?host=/var/run/postgresql` Unix socket is remote | Pass | Local, but not Compose's to start |
| TC-07 | Unset, empty and whitespace `DATABASE_URL` report `missing` | Pass | The runner stops with the `.env.example` remedy |
| TC-08 | An unparseable value reports `unparseable` rather than being guessed at | Pass | |
| TC-09 | The compose service publishing the port is found from `docker compose config` output | Pass | Service `postgres`, container `morchadi-gems-postgres`, healthcheck present |
| TC-10 | A renamed service, container and port is still found | Pass | Proves nothing is hardcoded — the fixture shares no name with this repo |
| TC-11 | The short string port form (`127.0.0.1:5432:5432`) is understood | Pass | |
| TC-12 | A published port range (`5430-5435`) matches a port inside it | Pass | |
| TC-13 | A single-service compose file is used even when its port disagrees | Pass | `matchedByPort: false`, and the runner says so |
| TC-14 | Two services publishing the same port are refused, not guessed between | Pass | Reason names the port |
| TC-15 | Several services and none publishing the port is refused | Pass | |
| TC-16 | An empty or `null` compose config is reported, not thrown on | Pass | |
| TC-17 | A missing or `disable: true` healthcheck is detected | Pass | Feeds TC-24 |
| TC-18 | `docker compose ps` line-delimited JSON is read | Pass | The form Compose v2.40.3 emits |
| TC-19 | `docker compose ps` JSON-array output is read | Pass | Other Compose versions emit this |
| TC-20 | No container, an empty array, and a different service each read as absent | Pass | |
| TC-21 | A line of non-JSON noise does not break the read | Pass | |
| TC-22 | Absent and `starting` both mean keep waiting | Pass | |
| TC-23 | Only `Health: healthy` ends the wait | Pass | **A merely `running` container is not treated as ready** |
| TC-24 | `unhealthy` and `exited` fail fast rather than waiting out the timeout | Pass | |
| TC-25 | A service with no healthcheck is refused rather than proceeded past blind | Pass | Readiness cannot be observed, so it is not assumed |
| TC-26 | `dev-stack` appears nowhere in the `Dockerfile` | Pass | Boundary guard |
| TC-27 | `dev-stack`/`dev:all` appear in neither `build` nor `start` | Pass | Boundary guard |
| TC-28 | `npm run dev` is still exactly `next dev` | Pass | The individual commands were not replaced |

## Manual — real runs

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| TC-29 | Cold start with the container removed, volume kept (`docker compose down`) | Pass | Output below |
| TC-30 | Cold start on a **brand new empty volume** | Pass | Both migrations applied from nothing; run on an isolated throwaway compose project so the real volume was untouched |
| TC-31 | `DATABASE_URL` pointing at a remote host skips Docker entirely | Pass | Verified with a `docker` shim that records every invocation — **it recorded none** |
| TC-32 | The existing `adminmorchadi2026` account survives and the login path works | Pass | See below |
| TC-33 | `docker compose up -d`, `npx prisma migrate deploy` and `npm run dev` still work individually | Pass | All three ran on their own during this session |

### TC-29 — cold start, container removed, volume kept

```
$ docker compose down
 Container morchadi-gems-postgres  Stopping
 Container morchadi-gems-postgres  Stopped
 Container morchadi-gems-postgres  Removing
 Container morchadi-gems-postgres  Removed
 Network morchadi-gems_default  Removing
 Network morchadi-gems_default  Removed

$ npm run dev:all

> morchadi-gems@0.1.0 dev:all
> node scripts/dev-stack.mjs

▸ Starting Postgres (compose service "postgres")
 Network morchadi-gems_default  Creating
 Network morchadi-gems_default  Created
 Container morchadi-gems-postgres  Creating
 Container morchadi-gems-postgres  Created
 Container morchadi-gems-postgres  Starting
 Container morchadi-gems-postgres  Started

▸ Waiting for "postgres" to report healthy
  starting…
  healthy — accepting connections

▸ Applying pending migrations (prisma migrate deploy)
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "morchadi_gems_dev", schema "public" at "localhost:5432"

2 migrations found in prisma/migrations

No pending migrations to apply.

▸ Starting the Next.js dev server (npm run dev)

> morchadi-gems@0.1.0 dev
> next dev

  ▲ Next.js 14.2.35
  - Local:        http://localhost:3000
  - Environments: .env.local, .env

 ✓ Starting...
 ✓ Ready in 4.3s
```

`starting…` then `healthy` is the wait doing its job: the container was `Up` for several seconds
before Postgres accepted connections, and nothing ran against the database in that window.

### TC-30 — brand new empty volume

**The real volume was not wiped**, because it holds the `adminmorchadi2026` account and
`npm run seed:admin` can only recreate one from an interactive TTY. The fresh-volume path was
proved instead on a throwaway compose project on port 15432 with its own volume, torn down with
`-v` afterwards:

```
▸ Starting Postgres (compose service "postgres")
 Volume morchadi-freshtest_fresh_pg_data  Creating
 Volume morchadi-freshtest_fresh_pg_data  Created
 Container morchadi-gems-postgres-freshtest  Created
 Container morchadi-gems-postgres-freshtest  Started

▸ Waiting for "postgres" to report healthy
  starting…
  healthy — accepting connections

▸ Applying pending migrations (prisma migrate deploy)
Datasource "db": PostgreSQL database "morchadi_gems_dev", schema "public" at "127.0.0.1:15432"

2 migrations found in prisma/migrations

Applying migration `20260820062848_init_orders_crm_schema`
Applying migration `20260820064646_add_admin_sessions`

The following migration(s) have been applied:
...
All migrations have been successfully applied.

▸ Starting the Next.js dev server (npm run dev)
 ✓ Ready in 3s
```

This is also the proof that the compose service, container name and port are discovered rather
than assumed: that project's service published 15432 and its container was named
`morchadi-gems-postgres-freshtest`, and the script found both without being told.

### TC-31 — a `DATABASE_URL` that is not local

No remote database exists to point at, so the branch was proved two ways.

The decision itself is covered by TC-04 to TC-06 above, in isolation and without a network.

The **wiring** was then proved with a real run, against a host that cannot resolve, with a
`docker` shim first on `PATH` that appends every invocation to a file:

```
$ PATH="$SHIM:$PATH" \
  DATABASE_URL="postgresql://morchadi:pretend-secret@db.morchadigems.invalid:5432/morchadi_gems?sslmode=require" \
  node scripts/dev-stack.mjs

▸ Skipping the local Postgres container
  DATABASE_URL host db.morchadigems.invalid is not this machine, so there is no local container to start.
  Nothing local to start or wait for; going straight to migrations.

▸ Applying pending migrations (prisma migrate deploy)
Datasource "db": PostgreSQL database "morchadi_gems", schema "public" at "db.morchadigems.invalid:5432"

Error: P1001: Can't reach database server at `db.morchadigems.invalid:5432`

✖ `npx prisma migrate deploy` failed, so the dev server was not started.
  → npx prisma migrate status
  → If the database and the migration history have diverged, `npx prisma migrate reset` is the local fix — it wipes all data.

=== docker invocations recorded ===
(none — docker was never called)
```

`docker` was on `PATH` and never invoked: no `compose config`, no `compose up`, no `compose ps`.
The command went straight to migrations, and failed on the connection rather than on anything to
do with Docker — which is exactly what a run against a real Coolify database that happened to be
down would look like.

### TC-32 — the admin account afterwards

**The volume was kept, so this applies.** `created_at` is byte-identical to the reading taken
before the container was removed, and the bcrypt hash is intact:

```
     username      |       created_at        | hash_prefix | hash_len
-------------------+-------------------------+-------------+----------
 adminmorchadi2026 | 2026-08-20 07:35:46.422 | $2b$12$     |       60
```

**The password itself is not known to this session** — `npm run seed:admin` never records it —
so a successful login as `adminmorchadi2026` could not be performed. What was verified instead,
through the dev server that `npm run dev:all` started:

| Check | Result |
| --- | --- |
| `POST /admin/api/login` as `adminmorchadi2026` with a wrong password | `401 {"status":"REJECTED"}` — the handler reached Postgres and ran bcrypt |
| A temporary admin seeded with a known password, logged in | `200 {"status":"SIGNED_IN"}` with a `morchadi_admin_session` cookie |
| `GET /admin` carrying that cookie | `200` |
| `GET /admin` without it | `307` to the login page |
| Temporary admin deleted afterwards | `admins` holds one row, `admin_sessions` holds none |

So the login path works end to end against the restarted database, and
`adminmorchadi2026`'s row went through the restart untouched.

## Gate

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass — no ESLint warnings or errors |
| `npm run test:run` | **945/945 pass, 48 files** |
| `npm run validate:products` | Pass — all checks green |
| `npm run build` | Pass |

## Failures

None.

## Summary

38 automated cases pass, 5 manual scenarios pass, 0 failed, 0 skipped. The whole suite is
945/945 and the build is green. Shippable — and by construction it changes nothing that ships:
`npm run dev:all` is a local developer convenience, absent from the `Dockerfile`, from every
production start command and from `npm run build`, with TC-26 to TC-28 standing guard over that
boundary.
