# The local development database

Postgres for the Phase 2 order and CRM domain, running in Docker on your own machine.

**This is strictly for local development. It is never used in production, and nothing here is
a secret.** Production Postgres does not exist yet — provisioning it in Coolify is a separate,
later piece of work. See [ADR-040](decisions/ADR-040-postgres-for-orders.md) for why this
database exists at all, and why the product catalogue is *not* in it.

## What is running

[`docker-compose.yml`](../docker-compose.yml) at the repository root defines one service.

| | |
| --- | --- |
| Image | `postgres:16-alpine` |
| Container | `morchadi-gems-postgres` |
| Host port | `5432` |
| Database | `morchadi_gems_dev` |
| User | `morchadi_dev` |
| Password | `dev_local_only` |
| Volume | `morchadi_gems_pg_data` (named, survives restarts) |

**The credentials are committed to git on purpose.** They open an empty throwaway database that
listens on your machine only. There is nothing in it worth protecting, and a placeholder
everyone shares beats a secret nobody can find. Never reuse this password anywhere reachable
from outside your machine.

## Start it

```bash
docker compose up -d
```

First run pulls the image, which takes a minute. Confirm it is actually ready before connecting —
`Up` and `healthy` are different things, and Postgres refuses connections for a few seconds after
the container starts:

```bash
docker compose ps
```

```
NAME                     STATUS                    PORTS
morchadi-gems-postgres   Up 10 seconds (healthy)   0.0.0.0:5432->5432/tcp
```

The compose file defines a `pg_isready` healthcheck, so `healthy` means the server is accepting
connections, not merely that the process started.

## Stop it

```bash
docker compose stop     # pause it, keep the data
docker compose down     # remove the container, keep the data
```

Both preserve the named volume. `stop` then `start` is the fastest way back.

## Reset it — wipes all data

```bash
docker compose down -v
docker compose up -d
```

`-v` removes the named volume, which destroys everything in the database. That is the intended
way to get back to a clean state, and it is safe: **local data here is scratch.** There is no
seed script yet, nothing important is stored, and the Codespace this runs in is itself temporary.
Never run `-v` against anything else.

## Connect to it

The connection string, in both [`.env.example`](../.env.example) and your `.env.local`:

```
postgresql://morchadi_dev:dev_local_only@localhost:5432/morchadi_gems_dev
```

A shell inside the container, for when you want raw `psql`:

```bash
docker exec -it morchadi-gems-postgres psql -U morchadi_dev -d morchadi_gems_dev
```

### Why `DATABASE_URL` is in two files

`.env.local` is what the Next.js app reads. **The Prisma CLI does not read `.env.local` — it
reads `.env`.** So `prisma generate`, `prisma migrate` and `prisma studio` need the value in
`.env`, and the app needs it in `.env.local`, and for local development they are the same
string. Both files are gitignored, and [`.dockerignore`](../.dockerignore) keeps every `.env*`
out of the build context entirely.

If you change the credentials in `docker-compose.yml`, change them in all three places or the
CLI and the app will disagree about which database they are talking to.

## Verify the connection

```bash
npm run test:run -- lib/prisma-connection.test.ts
```

With the container healthy, this opens a real connection through the singleton client in
[`lib/prisma.ts`](../lib/prisma.ts), runs `SELECT 1`, and disconnects.

**With no database running it skips rather than fails**, printing the reason:

```
↓ answers a trivial query through the singleton client [no database at DATABASE_URL
  (Can't reach database server at `localhost:5432`) — start it with `docker compose up -d`]
```

That is deliberate. A fresh clone and a CI runner have no Docker Postgres, and a connectivity
smoke test must not turn into a gate that everyone without a local database fails. The suite
still exits 0.

## Prisma Studio

```bash
npx prisma studio
```

A browser GUI over the data, and one of the two reasons Prisma was chosen over Drizzle
([ADR-040](decisions/ADR-040-postgres-for-orders.md)). It shows nothing useful yet — there are no
models. Schema design is a later prompt.

## Troubleshooting

**`bind: address already in use` on 5432.** Something else already holds the port — often a
previously started copy of this same container. Check with `docker ps -a`, and `ss -ltn | grep
5432` for a non-Docker Postgres. Stop the other one rather than changing the port here; the port
appears in three files.

**The test skips even though the container is `Up`.** It is probably not `healthy` yet. Wait for
`docker compose ps` to say so, then re-run.

**`Environment variable not found: DATABASE_URL`.** `.env` is missing or has no `DATABASE_URL`.
`.env` is gitignored, so a fresh clone will not have one — copy the line from `.env.example`.

**`password authentication failed`.** The volume was created with different credentials. Postgres
only applies `POSTGRES_USER` and `POSTGRES_PASSWORD` when it initialises an *empty* volume, so
editing them in `docker-compose.yml` does nothing to an existing database. `docker compose down
-v` and start again.
