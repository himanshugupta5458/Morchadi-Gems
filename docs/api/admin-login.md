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

## Side effects

1. `deleteExpiredAdminSessions()` — one indexed `DELETE` sweeping rows past their expiry, so the
   table is kept by the traffic rather than by a scheduled job. Runs only on a successful login.
2. `createAdminSession(adminId)` — inserts one `admin_sessions` row holding the token's digest,
   the admin id and an expiry seven days out.

Neither runs on a rejected login. Nothing is written, and nothing is logged, when a login fails.

## Security notes

- **Reads no secret from the environment.** Its credential store is the `admins` table, reached
  through `DATABASE_URL`, which is server-only and never carries a `NEXT_PUBLIC_` prefix.
- **The plaintext password exists only inside the handler**, is passed to bcrypt, and appears in
  no response, no log line and no database column.
- **The session token is returned once**, in a `HttpOnly` cookie, and is unreadable by script.
  It is never echoed in a body.
- **A successful response tells the client nothing but that it succeeded** — no username, no
  admin id, no expiry.
