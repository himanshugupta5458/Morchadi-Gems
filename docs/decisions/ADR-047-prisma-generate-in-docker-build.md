# ADR-047: The production image generates the Prisma Client itself

- **Status:** Accepted
- **Date:** 2026-08-21
- **Prompt:** 54

## Context

The Dockerfile was written by [ADR-032](ADR-032-coolify-docker-deploy.md), and its second
listed premise was *"the catalogue is a file, not a database — there is no external datastore
to connect to, no migration to run on boot."* That was true when it was written. It stopped
being true at [ADR-040](ADR-040-postgres-for-orders.md), which added Postgres and Prisma, and
it stopped mattering quietly at [ADR-042](ADR-042-order-capture-in-postgres.md), when
application code first began importing from `@prisma/client`. Eighteen modules import from it
today, and most import *types* — `OrderStatus`, `PaymentType`, `Prisma`, `PrismaClient`.

Those types do not exist in the published package. `@prisma/client` ships as a stub; the real
`index.d.ts` carrying `OrderStatus` and every model type is written by `prisma generate`,
reading `prisma/schema.prisma`. Locally that happens invisibly, because `@prisma/client`'s own
postinstall runs `prisma generate` when it can find a schema, and a developer's `npm install`
runs in a directory that has one.

The deps stage does not. It copies the lockfile alone — deliberately, so the 69-second install
caches on dependency changes and not on source edits — so the postinstall finds no schema and
generates nothing. It does not fail, and it does not warn: the `npm ci` layer in a clean build
of this image prints no Prisma output of any kind. The builder stage then copies that
ungenerated `node_modules` in and runs `npm run build`, whose type-checking step fails on the
first type import it reaches:

```
Module '"@prisma/client"' has no exported member 'OrderStatus'.
```

A green `npm run build` on a developer's machine cannot catch this. The failure needs a
`node_modules` that was installed without a schema beside it, which only ever happens inside
the image.

[ADR-040](ADR-040-postgres-for-orders.md) predicted the work: *"adding the `prisma generate`
and `prisma migrate deploy` steps the production image will need … are one later prompt."*
This is the first of those two steps. The second is still outstanding and is not decided here.

## Decision

**One explicit `RUN npx prisma generate` in the builder stage, between `COPY . .` and
`npm run build`.** The deps stage is untouched, and keeps caching on the lockfile alone.

Three properties of that placement were verified rather than assumed, because each of them is
the kind of thing a future reader will otherwise "fix":

**1. `prisma generate` needs the schema file and nothing else.** Not `DATABASE_URL`, not a
reachable database, not `prisma/migrations/`. Confirmed by running it in a scratch directory
holding only `prisma/schema.prisma`, with no `.env` present and `DATABASE_URL` unset in the
environment: it succeeded and emitted a full client. This matters because `DATABASE_URL` is
runtime-only in this deployment — it is a Coolify environment variable, never a build `ARG`,
and ADR-032 already forbids passing secrets as ARGs on the grounds that an ARG value is
readable in the image history. The build stays secret-free.

**2. `prisma/` already reaches the builder.** `.dockerignore` never excluded it, so `COPY . .`
carries `prisma/schema.prisma` in, one line above the generate step. No new `COPY` was added;
what was added is a note in `.dockerignore` recording that `prisma/` is load-bearing, since
that file's header comment lists what the build needs and had not been updated since ADR-040.

**3. The runner needs no fourth copy.** ADR-032's hard-won lesson is that `output: "standalone"`
omits `public/` and `.next/static`, and both must be copied explicitly. The generated Prisma
Client is *not* a third instance of that problem: Next's build trace resolves
`node_modules/.prisma/client` from the `lib/prisma.ts` import chain and copies it into
`.next/standalone` itself — `index.js`, `schema.prisma`, and the ~21 MB
`libquery_engine-*.so.node` binary included. Verified by inspecting the traced output rather
than by trusting the general reputation of standalone-versus-Prisma, which is poor.

## Alternatives considered

**Copy `prisma/` into the deps stage and let the postinstall do it.** Rejected on two counts.
It busts the deps layer cache on every schema edit, trading a 69-second install for a
one-line convenience. More importantly it makes the most load-bearing step of the build
implicit — a behaviour of a transitive package's install script rather than a line in the
Dockerfile. Prisma 7 already moves the generator; a major-version bump that changes when the
postinstall fires would break the image with no line in this file to point at.

**Add `"postinstall": "prisma generate"` to `package.json`.** Rejected for the same
implicitness, and it does not even solve the problem: the deps stage still has no schema, so
the hook would still generate nothing there. It would also fire on every local `npm install`
and in every CI job, whether or not that job touches the database.

**Copy the generated client into the runner explicitly, alongside `public/` and
`.next/static`.** Rejected as verified unnecessary — see point 3 above. It would also
duplicate ~21 MB of engine binary into the final image for no gain.

**Generate at container start, in the entrypoint.** Rejected. It would require the `prisma`
CLI and the full schema in the runtime image, which is precisely the build-only tooling
`output: "standalone"` exists to leave behind, and it would move a deterministic build-time
artefact into the boot path of every container restart.

## Consequences

The generate runs inside `node:20-alpine`, so Prisma detects that platform and emits the
`linux-musl-openssl-3.0.x` engine — the correct one for the runner, which is the same base
image and already installs `libc6-compat`. Generating on the host and copying in would have
produced a `debian-openssl-1.1.x` binary that loads on a developer's machine and fails in
production; doing it in-stage makes that mistake unavailable.

A schema change now invalidates the build from `COPY . .` onward, which it already did. The
deps layer is unaffected, so the install still caches on the lockfile alone.

What this does **not** do is run migrations. `prisma migrate deploy` against production
Postgres, and the provisioning and backup policy that go with it, remain the later prompt
ADR-040 named. An image built today generates a client that matches the committed schema; it
does not assert that the database it will connect to matches it too.

This ADR narrows a premise of ADR-032 rather than a decision. ADR-032's body is left untouched,
in keeping with the pattern CLAUDE.md records for ADR-001.
