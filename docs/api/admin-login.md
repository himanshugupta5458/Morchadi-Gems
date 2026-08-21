# POST /admin/api/login

Signs the shop owner in and issues a session cookie.

**Two public URLs, one handler.** On the admin subdomain this route is reached at
`https://admin.morchadigems.com/api/login`, which `middleware.ts` rewrites to `/admin/api/login`.
In local development, where no such subdomain exists, it is reached by its internal path:
`http://localhost:3000/admin/api/login`. The login page never writes either address down — the
server resolves it from the request's hostname with `resolveAdminLoginApiHref` and hands it to
the form. See [ADR-041](../decisions/ADR-041-admin-subdomain-and-auth.md).

## Request

| | |
| --- | --- |
| Method | `POST` |
| Runtime | `nodejs` — the handler runs bcrypt and opens a Postgres connection |
| Caching | `dynamic = "force-dynamic"`; every response carries `Cache-Control: no-store` |
| Auth | None. This is the endpoint that creates auth |

```ts
interface AdminLoginRequestBody {
  /** Compared case-insensitively against admins.username. Trimmed before lookup. */
  username: string;
  /** Plaintext, over HTTPS. Passed to bcrypt and dropped; never logged or stored. */
  password: string;
}
```

`Content-Type: application/json` is required in practice: the body is parsed with
`request.json()`, and a body that is not JSON is treated as empty credentials and rejected like
any other bad login. That is also a modest CSRF property — a cross-site `<form>` cannot send
JSON without a preflight the browser will not grant.

## Server-side validation

In order, and every failure below leaves by the same door:

1. **Body parse.** Not-JSON, a JSON array, `null`, or a non-string `username`/`password`
   all resolve to empty strings rather than throwing.
2. **Empty check.** An empty username or password is rejected without touching the database.
3. **Admin lookup.** `username.trim().toLowerCase()` against `admins.username`.
4. **Password comparison.** Always performed, including when no admin matched — in that case
   against a constant hash, so the absent-user path costs the same key stretching as the
   wrong-password path.
5. **Failure floor.** A rejection is padded up to 600 ms total, rather than delayed by a fixed
   amount, so a missing username and a wrong password take the same observable time.

**Nothing the client sends is trusted for anything but the comparison.** There is no
"remember me", no expiry hint, no redirect target and no role in the request body — the expiry
is decided by `lib/admin-session.ts` and the destination by the page that rendered the form.

## Responses

### 200 OK — signed in

```json
{ "status": "SIGNED_IN" }
```

With a `Set-Cookie` header:

```
morchadi_admin_session=<43-char base64url token>; Path=/; Expires=<7 days out>; Secure; HttpOnly; SameSite=lax
```

`Secure` is present in production and absent in development, where the site is served over
plain HTTP and a `Secure` cookie would be silently discarded. The token is 32 bytes of
`randomBytes`; the database stores only its SHA-256.

### 401 Unauthorized — rejected

```json
{ "status": "REJECTED", "error": "Username or password is incorrect." }
```

**This is the only failure response, and it is byte-identical for every cause** — unknown
username, wrong password, empty field, malformed body. No `Set-Cookie` is sent. `lib/admin-auth.test.ts`
asserts the identity of the bytes rather than of the meaning, because a message that differs by
a word is an enumeration oracle just the same.

There is no 400, no 422 and no 429. A shape error is a failed login, and rate limiting is
deliberately not implemented here — see ADR-041.

### 503 Service Unavailable — could not be checked

```json
{
  "status": "UNAVAILABLE",
  "error": "The admin database did not answer, so this sign-in could not be checked. It is not your password. Try again in a moment."
}
```

Returned when Postgres could not be reached at all, so the credentials were never compared. No
`Set-Cookie` is sent, and the reason is logged under `[admin-login]`.

**This does not weaken the one-message rule above.** That rule exists to stop the endpoint
telling a stranger which usernames exist; a 503 is returned identically for every username,
including ones that do not, so it discloses nothing an attacker could not learn by noticing the
outage. What it buys is the owner not retyping a password that was correct all along. See
[ADR-048](../decisions/ADR-048-database-health-and-failure-surfaces.md).

## Side effects

1. `sweepExpiredAdminSessions()` — one indexed `DELETE` sweeping rows past their expiry, so the
   table is kept by the traffic rather than by a scheduled job. Runs only on a successful login,
   and **cannot fail the login**: it catches, logs under `[admin-session]` and returns `null`.
   Awaited bare it sat between a verified password and the cookie that acts on it, so a fault in
   the tidying turned a correct sign-in into a 500
   ([ADR-048](../decisions/ADR-048-database-health-and-failure-surfaces.md)).
2. `createAdminSession(adminId)` — inserts one `admin_sessions` row holding the token's digest,
   the admin id and an expiry seven days out. This one *is* load-bearing: a failure here means no
   session exists, and the response is the 503 above rather than a cookie for a session that was
   never created.

Neither runs on a rejected login. Nothing is written, and nothing is logged, when a login fails
on its credentials.

## Security notes

- **Reads no secret from the environment.** Its credential store is the `admins` table, reached
  through `DATABASE_URL`, which is server-only and never carries a `NEXT_PUBLIC_` prefix.
- **The plaintext password exists only inside the handler**, is passed to bcrypt, and appears in
  no response, no log line and no database column.
- **The session token is returned once**, in a `HttpOnly` cookie, and is unreadable by script.
  It is never echoed in a body.
- **A successful response tells the client nothing but that it succeeded** — no username, no
  admin id, no expiry.
