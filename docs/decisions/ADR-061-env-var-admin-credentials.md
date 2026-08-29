# ADR-061: Admin credentials move from a Postgres row to environment variables

- **Status:** Accepted
- **Date:** 2026-08-29
- **Prompt:** 103

## Context

[ADR-041](ADR-041-admin-subdomain-and-auth.md) put the one admin account in Postgres: a
bcrypt-hashed `passwordHash` on an `Admin` row, created interactively by
`scripts/seed-admin.mjs`, looked up by `authenticateAdmin` on every login. That design weighed
revocability and "one less secret to deploy" against a signed cookie, and both of those
arguments still hold for **sessions** — see *What did not change* below.

What ADR-041 did not weigh is what happens when the *password itself* needs to change and the
database it lives in is not reachable from a convenient shell. Resetting a database-backed
password means running `scripts/seed-admin.mjs` (or an equivalent write) against production
Postgres, which — per [`DEPLOY.md`](../../DEPLOY.md) §5a — means either an SSH tunnel to the VPS
or temporarily publishing the database port. In practice the SSH route has proven unreliable
enough, often enough, to turn "I forgot the password" into a stuck afternoon rather than a
thirty-second fix. A shop with one operator and no second factor cannot afford its own
credential to be the thing standing between the owner and their own order queue.

## Decision

`authenticateAdmin` (`lib/admin-auth.ts`) compares submitted credentials against
`process.env.ADMIN_USERNAME` and `process.env.ADMIN_PASSWORD` instead of querying Postgres. The
`Admin` Prisma model is dropped entirely, in migration
`20260829061318_drop_admin_table_env_credentials`.

**This is explicitly a weaker security posture, accepted with the trade fully priced in.** A
bcrypt hash in Postgres is replaced by a plaintext value sitting in Coolify's environment panel
and in the container's process environment. Anyone who can read Coolify's env vars or exec into
the container now reads the admin password directly, where before they would have read a hash
that still required an offline attack. That is accepted in exchange for password recovery that
depends on nothing but Coolify being reachable — the one thing that has never been the unreliable
part of this stack.

### Every property ADR-041's login endpoint held, held exactly as before

- **One failure message, byte-identical, for every rejection reason** — including, now, an
  unconfigured environment. `ADMIN_LOGIN_FAILURE_MESSAGE` does not gain a fourth case; it
  answers a wrong password, an unknown username, an unset `ADMIN_USERNAME`/`ADMIN_PASSWORD` and
  a blank field alike.
- **The 600 ms failure floor** (`FAILED_LOGIN_FLOOR_MS`), unchanged, padding every rejection to
  the same observable duration. Bcrypt's own cost is gone — there is nothing left to hash — but
  the floor was already doing the timing work independently of bcrypt's cost, so removing bcrypt
  removes nothing the floor was relying on.
- **A constant-time password comparison**, now `timingSafeStringEqual` (SHA-256 both sides, then
  `crypto.timingSafeEqual`) rather than bcrypt's `compare`. Hashing first is what lets
  `timingSafeEqual` — which throws outright on a length mismatch — run unconditionally: both
  digests are always 32 bytes, so a password of the wrong length is compared exactly like one of
  the right length instead of being rejected by an early, cheaper, timeable check.
- **Fails closed.** An unset or empty `ADMIN_USERNAME`/`ADMIN_PASSWORD` rejects every login
  attempt — nobody signs in — rather than accepting anything or throwing an unhandled error. A
  `console.error` records the misconfiguration server-side; nothing in the response or its timing
  discloses it.
- **The username is trimmed and lowercased on both sides before comparison**, matching the
  lookup `scripts/seed-admin.mjs` used to perform, so `Admin` and `admin` remain the same
  account.

### What did not change

`AdminSession` stays a Postgres table, and every argument ADR-041 made for that — real
server-side revocation, a `DELETE` that ends a session whether or not the browser ever sees the
response, a token the database only ever stores as a SHA-256 digest — is untouched by where the
*password* is checked. The two problems are independent: how a login is verified says nothing
about how a subsequent request proves it is still that login.

What does change is what a session belongs to. There is now exactly one admin identity and no
row to reference, so `AdminSession.adminId` stops being a foreign key to `Admin.id` and becomes
a plain string, always `ADMIN_IDENTITY_ID` (`"env-admin"`, exported from `lib/admin-auth.ts`).
`AdminIdentity` — `{ id, username }` — keeps its shape: `id` is the constant, and `username` is
read fresh from `ADMIN_USERNAME` on every session lookup rather than stored per-session, since
there is nothing else it could ever be. Every existing caller of `AdminIdentity` —
`readAdminSessionFromRequest`, `requireAdminSession`, the three admin order-action routes,
`changedBy: admin.username` on the status-history audit trail — keeps working unmodified: none
of them ever read `.id` for anything but session bookkeeping, and `.username` still resolves to
the one operator's name.

The middleware/route-handler two-layer gate, `lib/admin-routing.ts`, and the hostname rewrite
from ADR-041 are all unrelated to where a credential is stored and are untouched.

### `scripts/seed-admin.mjs` becomes dead code

It writes to an `admins` table the schema no longer has — running it now fails outright rather
than doing nothing harmful. It is kept, not deleted, as a record of the database-backed design
and in case this decision is ever reversed, with a comment at the top of the file saying plainly
that it does nothing in the current environment. Rotating the password is now a Coolify env var
edit and a restart or redeploy — no application code, no migration, no script.

## Alternatives considered

**Keep the database-backed design and fix the SSH tunnel instead.** The tunnel is documented and
does work when used correctly (`DEPLOY.md` §5a); the problem is reliability under the specific
conditions a password reset happens in — usually exactly when something else about the
deployment is already being poked at. Hardening the tunnel (a permanent bastion, a VPN) is real
infrastructure work with its own maintenance burden, for a shop with one operator and one
password. Rejected as disproportionate to the problem.

**A `.env`-stored bcrypt hash instead of a plaintext password.** Splits the difference: the
value in Coolify is a hash, not a plaintext, but rotating it still means running `hashAdminPassword`
somewhere and pasting the result in — no simpler to recover than the database-backed version
when the person resetting it does not have a shell with `bcryptjs` handy, and Coolify's env
panel is not meaningfully harder to read than Postgres was to reach in the failure mode this ADR
is written for. Rejected for solving a problem this decision does not have (an attacker who can
already read Coolify's runtime environment can also read `CASHFREE_SECRET_KEY` and
`DATABASE_URL` sitting right next to it) while keeping the recovery friction that motivated the
change.

**A second environment-variable-backed admin (multi-operator via env vars).** Out of scope:
ADR-041 already named "a second operator" as the thing that would force a revisit of the
single-admin model, and env vars make a poor store for more than one account regardless — that
is a database problem again, just a smaller one. Nothing here forecloses it; it simply is not
today's problem.

## Consequences

**What this makes easy.** Resetting the admin password is a Coolify env var edit and a
redeploy — no tunnel, no `seed-admin` run, no database write. `lib/admin-auth.ts` has one fewer
runtime dependency: `authenticateAdmin` no longer touches Postgres at all, so a database outage
no longer has any bearing on whether the *credentials* check out (only on whether a session can
subsequently be created or read).

**What this makes harder.** The password is now plaintext wherever the process environment is
readable — Coolify's panel, `docker exec` into the running container, a core dump. There is no
audit of who read or changed it, where a database at least offers row-level history if one were
built. And there is exactly one credential pair: no per-admin scoping, no partial revocation
short of changing the one password everyone who has it shares.

**What would force a revisit.** A second operator — the same trigger ADR-041 named, now doubled:
env vars cannot express "revoke only this person" the way a database row could. Or a compliance
requirement that a credential never live in plaintext in a runtime environment, which would push
this back toward a hash — stored somewhere recoverable without the SSH tunnel that started this
ADR, which is the harder problem this one deliberately did not solve.
