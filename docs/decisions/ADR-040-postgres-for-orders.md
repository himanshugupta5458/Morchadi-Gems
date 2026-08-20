# ADR-040: Postgres for orders and CRM, alongside the JSON catalogue rather than replacing it

- **Status:** Accepted
- **Date:** 2026-08-20
- **Prompt:** 43

## Context

[ADR-001](ADR-001-tech-stack.md) chose to have no database at all, and it closed by naming the
conditions that would force a revisit: *"customer accounts or order history"*, and *"the first
of these to arrive should get its own ADR superseding this one, rather than a database quietly
appearing alongside the JSON file."* This is that ADR.

Phase 2 is a CRM over the orders the shop is already taking. What it needs is not storage of
product facts — it is storage of **state that changes after the deploy**:

- **A status workflow.** An order moves through placed → packed → shipped → delivered, or into
  returned, RTO and refunded. Every one of those transitions is an admin clicking something at
  2pm on a Tuesday. None of them is knowable when the image is built.
- **RTO and refund tracking.** Return-to-origin is a per-order outcome recorded weeks after the
  order, and it is the single number that decides whether a COD-style flow is survivable.
- **Revenue and profit analytics.** "What did we make last month, net of refunds and shipping"
  is a query over rows. It cannot be a grep.
- **Queryable history.** "Show me every order from this customer" and "every order still unshipped
  after five days" are the two questions a CRM exists to answer.

Today the order record is a Cashfree dashboard entry plus a WhatsApp message
([`docs/api/notify-admin.md`](../api/notify-admin.md)), which is exactly what
[ADR-039](ADR-039-analytics-and-utm-attribution.md) had to work around when it put campaign
attribution into `order_tags` because there was nowhere else to put it. That is a fine record
of *what was ordered* and a useless record of *what happened next*.

**The reason a JSON file cannot absorb this is deployment shape, not size.**
`data/products.json` works because it is read-only at runtime and changes only when someone
ships a commit. Order state changes at runtime, from admin actions and customer orders, and the
file lives **inside the Docker image** ([ADR-032](ADR-032-coolify-docker-deploy.md)) on a
container filesystem that is discarded on every redeploy. A writable JSON file there would lose
every status change on the next deploy, would corrupt under two concurrent writers, and would be
unqueryable besides. This is a category difference, not a scaling one.

## Decision

**Postgres is adopted for the Phase 2 order and CRM domain. This reverses the no-database
decision of [ADR-001](ADR-001-tech-stack.md) for that domain and for nothing else.**

The reversal is deliberately narrow. Precisely:

| Data | Where it lives after this ADR | Why |
| --- | --- | --- |
| `orders` | Postgres | Runtime state, queryable history |
| `order_status_history` | Postgres | An append-only audit of who changed what, when |
| `customers` | Postgres | Repeat-purchase history is the CRM's core question |
| `admins` | Postgres | Phase 2 introduces an authenticated operator |
| **Product catalogue** | **`data/products.json`, in git, unchanged** | **Explicit owner decision** |

**The catalogue is not moving, and this is a decision rather than a deferral.** Every argument
ADR-001 made for it still holds and none of the pressure above touches it: prices change when
someone ships a commit, a diff is the best possible audit trail for a price, and code review is
the best possible guard against a typo that charges ₹99 for a ₹9,900 piece. It stays the sole
authority on what anything costs, and the mandatory server-side price validation in
[`CLAUDE.md`](../../CLAUDE.md) continues to read from that file and from nothing else. **An order
row may record the price that was charged; it may never be the source consulted to decide a
price.** A future prompt that moves prices into Postgres would be reversing that, and needs its
own ADR to do it.

So ADR-001 is not superseded wholesale. Its catalogue, admin-panel, guest-checkout, Cashfree and
server-side-pricing rows all stand. One row — "no database" — is narrowed, in the same way
[ADR-032](ADR-032-coolify-docker-deploy.md) narrowed its hosting row without invalidating the
rest. Following that precedent, ADR-001's body is left untouched.

**The ORM is Prisma, chosen over Drizzle, per owner decision.** The reasons given were Prisma
Studio — a GUI over the data, which matters when the operator is not a SQL user — and a gentler
learning curve. Both are accepted at face value; they are the right criteria for a project whose
constraint is operator capability rather than query performance.

**Prisma is pinned to 6.19.2, using the `prisma-client-js` generator.** This is a deliberate
divergence from `prisma@latest` (7.9.1) and is explained under *Alternatives considered* below.

**Development is local-first, and production Postgres is deliberately not provisioned yet.**
A single `postgres:16-alpine` service in `docker-compose.yml` at the repository root, on port
5432, with a named volume, and credentials committed in plain sight because the database is
empty and listens on one machine only. Provisioning Postgres in Coolify, setting a real
`DATABASE_URL` there, adding the `prisma generate` and `prisma migrate deploy` steps the
production image will need, and choosing a backup policy are **one later prompt**, taken once
the schema and the admin flow are proven locally. Deciding the production database shape before
the first table exists would be guessing.

**This prompt ships plumbing only.** No models, no migrations, no application code touching the
database. `prisma/schema.prisma` holds a `generator` block and a `datasource` block and nothing
else. `lib/prisma.ts` exports a singleton client that nothing imports yet except its own smoke
test. Schema design is its own prompt and its own ADR.

## Alternatives considered

**Keeping everything in JSON files, with order state written to disk.** Rejected on the
deployment shape described above: the file is inside an image that is replaced on every deploy,
so every status change would be lost on the next release. Adding a Docker volume to keep it
would mean hand-rolling concurrency control and querying over a file — reimplementing a database
badly, and losing the git-diff auditability that is the only reason the JSON approach was good
in the first place.

**SQLite on a mounted volume.** Genuinely tempting: no service, no connection string, a single
file, and Prisma supports it. Rejected on where this is going rather than where it is. The CRM
is expected to grow reporting queries and a second concurrent writer (the admin panel alongside
the checkout path), SQLite's single-writer lock is the wrong shape for that, and the migration
to Postgres later would land exactly when the data has become valuable and the move most
expensive. Postgres now costs one compose service.

**A hosted Postgres (Supabase, Neon) instead of one in Docker.** Rejected for the development
loop, not on the merits — a hosted database is a strong candidate for *production* and that
choice is explicitly still open. For local work it would add an account, a network round trip on
every query, and a shared database that two developers can break for each other. Docker Compose
gives a disposable database that resets with one command and works with no network at all.

**Drizzle instead of Prisma.** A real contender: lighter, closer to SQL, no generated client and
no separate engine. Rejected on the owner's stated criteria. Drizzle has no equivalent of Prisma
Studio, and a GUI over orders is not a nicety here — it is how a non-technical operator inspects
and corrects data without a developer. The learning curve argument points the same way.

**Prisma 7 (`prisma@latest`, 7.9.1) with the `prisma-client` generator.** This was the default
choice and was rejected on one concrete, in-scope consequence. Prisma 7 makes the generator's
`output` field mandatory and no longer generates into `node_modules`, so the client becomes
gitignored files inside the repository that must exist before `tsc` or `next build` will
succeed. The production image installs dependencies in a stage that copies only
`package.json` and `package-lock.json` ([`Dockerfile`](../../Dockerfile)), so adopting v7 forces
a `prisma generate` step into the Docker build — deployment work that this prompt is explicitly
scoped out of. It would also put generated TypeScript inside `lib/`, where `tsconfig.json`'s
`**/*.ts` and `next lint` would both pick it up, requiring exclusions in two shared config files.
Prisma 6.19.2 with `prisma-client-js` generates into `node_modules`, touches no shared config,
and leaves the Dockerfile alone.

`prisma-client-js` is deprecated in v7 and will be removed in a later major, so this is a debt
with a due date, not a permanent position. **The right moment to pay it is the same prompt that
provisions production Postgres**, because that prompt is already opening the Dockerfile to add
`prisma generate` and `prisma migrate deploy` — the exact change v7 requires. Upgrading now
would mean doing that work twice, and doing it before a single model exists.

**Waiting until the schema is designed before adding any of this.** Rejected as a false economy.
The connection, the client singleton and the hot-reload pattern are the parts most likely to
waste a day if they are wrong, and they are testable with no tables at all. Getting them green
first means the schema prompt is about the schema.

## Consequences

**What this makes easy.** Order status becomes something the site can record and query, which
unblocks every Phase 2 feature at once: the admin workflow, RTO and refund tracking, revenue and
profit reporting, and a customer's purchase history. Attribution stops being a
`localStorage` value that has to hitch a ride on a Cashfree tag
([ADR-039](ADR-039-analytics-and-utm-attribution.md)) and can become a column on the order, which
is where multi-touch attribution becomes possible at all. `npx prisma studio` gives the owner a
GUI over the data without a developer present.

**What it makes harder, and it is not a short list.** ADR-001's headline claim — "there is no
database to breach" — stops being true the moment real customer rows exist. This project now
acquires, in production: a connection to manage and a pool to size, migrations that must be run
in the right order at deploy time, a backup and restore policy that someone has to actually
test, personal data at rest with the retention and deletion obligations that brings under India's
DPDP Act, and a second stateful thing that can be down while the storefront is up. **None of
that is paid for by this prompt.** Every item lands in the production-provisioning prompt, and
listing them here is the point: they are the real cost of the decision, and they should be read
before that prompt is written, not discovered during it.

**A second source of truth now exists, and its boundary is the thing to defend.** Prices in
git, orders in Postgres. The failure mode is a well-meaning later change that denormalises a
price into an order table and then reads it back when creating a payment. Recording what was
charged is correct and necessary; consulting that record to decide what to charge is the bug
[`CLAUDE.md`](../../CLAUDE.md) exists to prevent.

**The local database is disposable and nothing may assume otherwise.** `docker compose down -v`
wipes it, the Codespace it runs in is itself temporary, and there is no seed script yet. Local
data is scratch until a later prompt says otherwise — see
[`docs/DEV-DATABASE.md`](../DEV-DATABASE.md).

**A dependency-security note, in the spirit of [ADR-030](ADR-030-dependency-security-bump.md).**
`npm audit` reports five high-severity advisories after this change. Four are pre-existing or
CLI-only: the `next` advisory is the one ADR-030 already recorded as not fixable without a major
bump, and the other three (`@prisma/config` → `deepmerge-ts`, `effect`) reach the tree only
through the `prisma` **CLI**. `@prisma/client`, the package that runs in production, declares no
dependencies at all — verified with `npm ls`. No advisory affects code that serves a request.
There is no fix available within the 6.x line; the v7 upgrade above is also the fix for this.

**What would force a revisit.** The catalogue needing to be editable by the owner without a
deploy, which is the one change that would pull products into Postgres and genuinely supersede
ADR-001 rather than narrow it. A second application needing the same data, which would make the
database a shared contract rather than an implementation detail. Or the operational cost of
running Postgres in Coolify proving higher than a managed provider, which is a hosting decision
and belongs in the production-provisioning ADR, not this one.
