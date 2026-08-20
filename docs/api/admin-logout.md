# POST /admin/api/logout

Ends the current admin session, server-side and in the browser.

Reached at `https://admin.morchadigems.com/api/logout` in production and
`http://localhost:3000/admin/api/logout` in development, by the same rewrite that serves
[the login endpoint](admin-login.md). See
[ADR-041](../decisions/ADR-041-admin-subdomain-and-auth.md).

## Request

| | |
| --- | --- |
| Method | `POST` |
| Runtime | `nodejs` — the handler deletes a row from Postgres |
| Caching | `dynamic = "force-dynamic"`; `Cache-Control: no-store` |
| Auth | None required, by design — see below |

No body. The only input is the `morchadi_admin_session` cookie, read from the request.

**`POST`, not `GET`, and not a link.** A `GET /logout` href is followed by anything that walks
the page — a prefetcher, a link scanner, an `<img>` on somebody else's site — and each of those
would end the owner's session for them. The panel renders a button that posts.

## Server-side validation

None, and that is the contract. An unknown token, an expired one and no cookie at all are all
answered identically, because in every one of those cases the caller is in fact signed out.

The path is listed as public in `lib/admin-routing.ts` for the same reason: a stale cookie must
always be clearable, rather than being redirected into the login page it is trying to leave.

A cross-site POST cannot reach a live session here — the cookie is `SameSite=Lax`, so it is not
sent on a cross-site POST at all, and the handler would delete nothing.

## Responses

### 200 OK — always

```json
{ "status": "SIGNED_OUT" }
```

With a `Set-Cookie` that clears the session:

```
morchadi_admin_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax
```

The clearing cookie carries the same `Path`, `HttpOnly`, `SameSite` and (in production)
`Secure` attributes it was set with — a browser will not replace a cookie whose attributes do
not match.

There is no failure response. This endpoint has nothing to refuse.

## Side effects

`destroyAdminSession(token)` deletes the matching `admin_sessions` row, if there is one.

**The row is deleted before the cookie is cleared, and the order matters.** A logout that only
emptied the cookie would leave a live session behind on any machine that had kept a copy of the
token. Deleting the row is what makes the token stop working, whether or not the browser ever
applies the response.

## Security notes

- Reads no secret and returns no data.
- The token is used only to locate a row by its digest; it is never logged.
- Ending one session leaves the admin's other sessions alone. `destroyAllSessionsForAdmin` exists
  in `lib/admin-session.ts` for a future "sign out everywhere", and no route calls it yet.
