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

## One command: `npm run dev:all`

The three steps below — start Postgres, apply migrations, run the app — behind one command.

```bash
npm run dev:all
```

```
▸ Starting Postgres (compose service "postgres")
 Container morchadi-gems-postgres  Created
 Container morchadi-gems-postgres  Started

▸ Waiting for "postgres" to report healthy
  starting…
  healthy — accepting connections

▸ Applying pending migrations (prisma migrate deploy)
2 migrations found in prisma/migrations
No pending migrations to apply.

▸ Starting the Next.js dev server (npm run dev)
  ▲ Next.js 14.2.35
  - Local:        http://localhost:3000
 ✓ Ready in 4.3s
```

| It does | Which by hand is |
| --- | --- |
| Starts the compose service that publishes `DATABASE_URL`'s port | `docker compose up -d` |
| Polls until that container reports **healthy** | watching `docker compose ps` |
| Brings the schema up to date | `npx prisma migrate deploy` |
| Starts the app | `npm run dev` |

Ctrl-C stops the dev server, exactly as `npm run dev` does. The container is left running, which
is what you want between restarts; `docker compose stop` puts it away.

**It waits for health, it does not sleep.** The wait polls `docker compose ps` for the
`pg_isready` healthcheck defined in `docker-compose.yml` — every second, for up to 60 seconds —
and only `healthy` lets it move on. `Up` is not enough: Postgres refuses connections for a few
seconds after the container starts, and a migration run in that gap fails. If the container never
becomes healthy, exits, or reports `unhealthy`, the command stops with the reason and the command
to look at, and **runs nothing against the database** rather than proceeding blind.

**It is additive. Every step still works on its own** — `docker compose up -d`, `npx prisma
migrate deploy` and `npm run dev`, run separately, are unchanged and remain the right thing to
reach for when you are debugging one of them in particular. `npm run dev:all` starts nothing you
could not start yourself; it only saves typing the sequence.

**Nothing about the database is written down twice.** The host and port come from
`DATABASE_URL`; the service name, container name and healthcheck come from `docker-compose.yml`,
read through `docker compose config`. The script names no container, no port and no password, so
changing one of those in the file that owns it is the whole change — there is no copy in
`scripts/dev-stack.mjs` to drift out of step.

**When `DATABASE_URL` is not local, Docker is skipped entirely.** A host that is not
`localhost`, `127.0.0.1`, `::1` or `0.0.0.0` — the Coolify-hosted database this project will
have one day, or any other remote server — is not ours to start, so no container is started and
nothing is waited for:

```
▸ Skipping the local Postgres container
  DATABASE_URL host db.morchadigems.invalid is not this machine, so there is no local container to start.
  Nothing local to start or wait for; going straight to migrations.
```

A `?host=/var/run/postgresql` Unix-socket URL is treated the same way, for the same reason.
`DATABASE_URL` is read from the environment first, then `.env`, then `.env.local`, matching
`npm run seed:admin`.

### This command is for local development only

**`npm run dev:all` must never be wired into deployment.** It is not referenced by the
[`Dockerfile`](../Dockerfile), by any production start command, or by `npm run build`, and it
must stay that way — `lib/dev-stack-plan.test.ts` asserts all three.

Production is started by Coolify's own process manager ([ADR-032](decisions/ADR-032-coolify-docker-deploy.md)),
and **production migrations are a deliberate, separate release step**, not something a developer
convenience runs on the way past. Two of the four things this command does are actively wrong in
production anyway: `docker compose up -d` refers to a throwaway database with committed
credentials, and `next dev` is not a production server.

## Start it by hand

`npm run dev:all` above does this for you, but every step it wraps is still a first-class
way to work — and the right one when the thing you are debugging *is* the container, the
migration or the dev server. Nothing below has changed.

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
way to get back to a clean state, and it is safe: **local data here is scratch.** Nothing
important is stored and the Codespace this runs in is itself temporary. The one thing you will
have to redo is the admin account — see [Creating the admin account](#creating-the-admin-account)
below, and `npm run seed:admin` takes a few seconds. Never run `-v` against anything else.

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

## Migrations

The schema lives in [`prisma/schema.prisma`](../prisma/schema.prisma). The tables it describes —
`orders`, `order_status_history`, `order_line_items`, `customers`, `admins`, `admin_sessions` —
are created by the migrations in `prisma/migrations/`, which **are committed to git**: they are the ordered history
of how the database got its shape, and production will replay exactly this list.

### After editing the schema

```bash
npx prisma migrate dev --name what_you_changed
```

This diffs your edit against the database, writes a new timestamped folder under
`prisma/migrations/` holding the SQL, applies it, and regenerates the Prisma client. Name it for
the change, in `snake_case` — `add_order_notes`, not `update`. Commit the generated folder with
the schema edit; a schema change without its migration is an incomplete commit.

### Checking where you are

```bash
npx prisma migrate status
```

Says whether the database has every migration in the folder applied. `Database schema is up to
date!` is the answer you want.

### Reset — wipes all data, replays every migration

```bash
npx prisma migrate reset
```

Drops the schema, re-runs every migration from the first, and regenerates the client. This is
the fix when the database and the migration history have diverged — a migration edited by hand,
a branch switch, a half-applied change. **It destroys all data and does not ask twice beyond its
own prompt.** That is safe here and only here: local data is scratch. Prisma is not configured to
run a seed automatically, so your admin account goes with it — recreate it with
`npm run seed:admin`.

`prisma migrate reset` and `docker compose down -v` both give you an empty start. The difference:
`reset` keeps the container and leaves you with every table created, `down -v` destroys the
volume and leaves you with no database at all until something recreates it — `npm run dev:all`
is the shortest route back, since it starts the container and applies every migration to the new
volume in one go.

**Never run either reset against anything but this local container.** Production gets
`prisma migrate deploy`, which only applies pending migrations and never resets — and production
Postgres does not exist yet ([ADR-040](decisions/ADR-040-postgres-for-orders.md)).

### Applying pending migrations without changing the schema

```bash
npx prisma migrate deploy
```

Applies every migration the database has not seen yet and writes none. This is what a fresh
clone or a fresh volume needs, and it is the step `npm run dev:all` runs for you — on an
up-to-date database it prints `No pending migrations to apply.` and costs a second.

### Regenerating the client on its own

```bash
npx prisma generate
```

`migrate dev` and `migrate reset` both do this for you. Run it by hand after a `git pull` that
brought in a schema change, or whenever TypeScript claims a model that is plainly in the schema
does not exist on `prisma`.

## Verify the connection

```bash
npm run test:run -- lib/prisma-connection.test.ts lib/prisma-schema.test.ts
```

With the container healthy, the first file opens a real connection through the singleton client
in [`lib/prisma.ts`](../lib/prisma.ts), runs `SELECT 1`, and disconnects. The second writes a
customer, an order, a line item and a status-history row through the generated client, checks
the schema accepted its own shape, and rolls the transaction back so the database is left exactly
as it was found.

**With no database running it skips rather than fails**, printing the reason:

```
↓ answers a trivial query through the singleton client [no database at DATABASE_URL
  (Can't reach database server at `localhost:5432`) — start it with `docker compose up -d`]
```

That is deliberate. A fresh clone and a CI runner have no Docker Postgres, and a connectivity
smoke test must not turn into a gate that everyone without a local database fails. The suite
still exits 0.

Two more suites need the database and skip the same way — `lib/admin-session.test.ts` and
`lib/admin-auth.test.ts`, which create a throwaway admin, exercise login, sessions and logout
against it, and delete it again. They leave no rows behind
([ADR-041](decisions/ADR-041-admin-subdomain-and-auth.md)).

## Prisma Studio

```bash
npx prisma studio
```

A browser GUI over the data, and one of the two reasons Prisma was chosen over Drizzle
([ADR-040](decisions/ADR-040-postgres-for-orders.md)). It lists every model in the schema and
lets rows be read and edited by hand. `admins` and `admin_sessions` fill up as soon as you seed
an account and sign in ([ADR-041](decisions/ADR-041-admin-subdomain-and-auth.md)); the order
tables stay empty until a later prompt wires checkout to write to them.

## Creating the admin account

The admin panel signs in against a row in the `admins` table, and there is no sign-up page —
there is exactly one operator, and the account is created deliberately. See
[ADR-041](decisions/ADR-041-admin-subdomain-and-auth.md).

```bash
npm run seed:admin
```

```
Morchadi Gems — create an admin account

Username: yourname
Password (not shown):
Confirm password:

Created admin "yourname".
Sign in at http://localhost:3000/admin/login while developing.
```

**It must be run in a terminal.** The script refuses to start when stdin is not a TTY, because
it hides the password as you type it and a pipe cannot do that.

**Credentials are typed, never passed as arguments.** There is deliberately no
`--username`/`--password`: an argument lands in your shell's history file, is visible in `ps` to
anyone else on the machine while the process runs, and is captured by anything that logs the
command it ran. The plaintext exists only inside the process, goes to bcrypt, and is never
printed, written to disk or sent anywhere. Only the hash reaches Postgres.

| Rule | Why |
| --- | --- |
| Username 3–32 characters, `a-z0-9._-`, starting with a letter or digit | Lowercased on the way in **and** on the way to a login lookup, so `Admin` and `admin` are one account |
| Password at least 12 characters, typed twice | Length is what defends a stolen hash; it is typed twice because it was never shown |
| An existing admin prompts for confirmation | The panel is built around one operator, so a second row is more likely a slip than an intention |
| A duplicate username is refused outright | Never silently overwrites an existing account's password |

The script finds `DATABASE_URL` in your environment, then in `.env`, then in `.env.local` — so
it works with whichever of the two files you keep current, and an already-exported variable wins
over both if you ever need to point it at a different database.

### Signing in

With the container healthy and an admin created, `npm run dev` and open
**http://localhost:3000/admin/login**. In production the same page is
`admin.morchadigems.com/login` — the `/admin` prefix is removed by a middleware rewrite on that
hostname, and the path form is the local-development fallback because no such subdomain exists
on your machine. **That subdomain does not resolve yet**; DNS and Coolify are a later prompt
(ADR-041, "Pending deployment").

### Removing or resetting an admin

There is no "change password" screen yet. `npx prisma studio` edits the row by hand, or:

```bash
docker exec -it morchadi-gems-postgres psql -U morchadi_dev -d morchadi_gems_dev \
  -c "DELETE FROM admins WHERE username = 'yourname';"
```

Deleting the row deletes that admin's sessions with it — `admin_sessions.admin_id` cascades — so
every browser signed in as them is signed out at once.

## Troubleshooting

**`npm run dev:all` says Postgres never reported healthy.** It waited 60 seconds and stopped
without running anything against the database. `docker compose logs postgres` says why; a volume
created with different credentials is the usual cause, and the last entry on this page is the
fix. Nothing was migrated, so there is nothing to undo.

**`npm run dev:all` skipped Docker when you expected it not to.** It skips whenever
`DATABASE_URL`’s host is not `localhost`, `127.0.0.1`, `::1` or `0.0.0.0`. An exported
`DATABASE_URL` in your shell wins over both `.env` and `.env.local` — `echo $DATABASE_URL` is
the first thing to check.

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
