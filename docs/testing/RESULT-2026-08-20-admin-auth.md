# Test Result: Admin authentication and subdomain routing — 2026-08-20

- **Plan:** [PLAN-admin-auth.md](PLAN-admin-auth.md)
- **Commit:** working tree at `94b099f` + prompt 45 changes
- **Environment:** GitHub Codespace, Node 24. `postgres:16-alpine` in Docker on
  `localhost:5432` (`morchadi-gems-postgres`, healthy). The manual cases were run against a real
  **production build** — `npm run build && npm start`, so `NODE_ENV=production` — with `curl
  -H "Host: …"` standing in for the DNS record that does not exist yet. No production
  environment was contacted and no DNS or Coolify setting was touched.

Every manual case below was executed against a running server, not read off the source. Two
findings came out of doing that rather than assuming, and both are recorded under *Findings*.

## Gate

| ID | Result | Notes |
| --- | --- | --- |
| G-01 | Pass | `npm run typecheck` — clean, no output |
| G-02 | Pass | `npm run lint` — no ESLint warnings or errors |
| G-03 | Pass | `npm run test:run` — **895 passed, 46 files** (was 814 / 43) |
| G-04 | Pass | `npm run validate:products` — `PASS — all checks green`; the three advisory lists are the pre-existing ones, unchanged |
| G-05 | Pass | `npm run build` — compiled, 73/73 static pages generated, exit 0, middleware 27.1 kB |

## Cases

### Hostname routing — production shape

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | `admin.morchadigems.com/login` → 200, renders "Admin sign in" |
| TC-02 | Pass | Rewrites to `/admin/api/login`; the live login POST to `admin.morchadigems.com/api/login` returned `SIGNED_IN` |
| TC-03 | Pass | 307 to `/login` |
| TC-04 | Pass | Rewrite to `/admin/orders` |
| TC-05 | Pass | Live: `admin.morchadigems.com/` with a session rendered the dashboard |
| TC-06 | Pass | 307 to `/`, `x-middleware-rewrite` absent |
| TC-07 | Pass | 307 to `/` — verified live, the login page is not served on the public domain |
| TC-08 | Pass | Still 307 to `/`; the cookie changes nothing |
| TC-09 | Pass | All five `continue` |
| TC-10 | Pass | `/administration` unaffected |
| TC-11 | Pass | `panel.example.test` rewrites; the default stops matching |
| TC-12 | Pass | Whitespace falls back to `admin.morchadigems.com` |
| TC-13 | Pass | Live: 404 with a valid session — the storefront API is unreachable on the admin host |

### Hostname routing — local development

| ID | Result | Notes |
| --- | --- | --- |
| TC-14 | Pass | Live: `localhost:3000/admin/login` → 200 |
| TC-15 | Pass | Live: 307 to `/admin/login` |
| TC-16 | Pass | `continue` |
| TC-17 | Pass | `*.app.github.dev` behaves as localhost |
| TC-18 | Pass | Verified on a real production build: still path-addressed on `localhost` |
| TC-19 | Pass | Storefront untouched |

### Middleware mechanics

| ID | Result | Notes |
| --- | --- | --- |
| TC-20 | Pass | `x-middleware-rewrite: https://admin.morchadigems.com/admin/orders` |
| TC-21 | Pass | 307 |
| TC-22 | Pass | Live: `location: https://admin.morchadigems.com/login`. **This case failed twice before it passed — see Findings** |
| TC-23 | Pass | Leftmost of `admin.morchadigems.com, inner.internal` used |
| TC-24 | Pass | `?status=packed` dropped |
| TC-25 | Pass | `x-middleware-next: 1` |

### Sessions

| ID | Result | Notes |
| --- | --- | --- |
| TC-26 | Pass | |
| TC-27 | Pass | `expiresAt` within 10 s of exactly seven days |
| TC-28 | Pass | `token_hash` matches `/^[0-9a-f]{64}$/` and differs from the 43-character token |
| TC-29 | Pass | |
| TC-30 | Pass | |
| TC-31 | Pass | |
| TC-32 | Pass | Row count drops to 0 after the read |
| TC-33 | Pass | |
| TC-34 | Pass | |
| TC-35 | Pass | Returns 2 |
| TC-36 | Pass | |
| TC-37 | Pass | |
| TC-38 | Pass | |
| TC-39 | Pass | Live `Set-Cookie` under `npm start` carried `Secure`; the development build does not |
| TC-40 | Pass | |

### Login and logout

| ID | Result | Notes |
| --- | --- | --- |
| TC-41 | Pass | Live: `morchadi_admin_session=…; Path=/; Expires=Thu, 27 Aug 2026 …; Secure; HttpOnly; SameSite=lax` |
| TC-42 | Pass | |
| TC-43 | Pass | |
| TC-44 | Pass | Byte-identical: both `{"status":"REJECTED","error":"Username or password is incorrect."}` at 401 |
| TC-45 | Pass | A form-encoded body is answered exactly as an empty one is |
| TC-46 | Pass | Both at or above 600 ms |
| TC-47 | Pass | |
| TC-48 | Pass | |
| TC-49 | Pass | `  AUTH-SUITE-THROWAWAY  ` accepted |
| TC-50 | Pass | |
| TC-51 | Pass | Live and in the suite: the token stops resolving immediately |
| TC-52 | Pass | |

### Route protection in the running app

| ID | Result | Notes |
| --- | --- | --- |
| TC-53 | Pass | `Cookie: morchadi_admin_session=totally-made-up` → 307 to `/admin/login`, issued by the protected layout after middleware let it through. The two-layer design behaves as designed |
| TC-54 | Pass | Rendered `Logged in as <span class="italic text-gold">devadmin</span>` |
| TC-55 | Pass | |
| TC-56 | Pass | 200, no loop |
| TC-57 | Pass | `admin.morchadigems.com/admin/login` → 404 |

### Crawler guards

| ID | Result | Notes |
| --- | --- | --- |
| TC-58 | Pass | |
| TC-59 | Pass | |
| TC-60 | Pass | |
| TC-61 | Pass | |
| TC-62 | Pass | Live: `admin.morchadigems.com/robots.txt` served `User-agent: *` / `Disallow: /`. **This is the case that changed the design — see Findings** |
| TC-63 | Pass | 404 with a valid session |
| TC-64 | Pass | 307 to `http://www.morchadigems.com/` |
| TC-65 | Pass | |

### Seed script

| ID | Result | Notes |
| --- | --- | --- |
| TC-66 | Pass | Driven through a real pty. `DevAdmin` stored as `devadmin`, exit 0 |
| TC-67 | Pass | The full pty transcript was searched for the password string: **not present**. Only the username echoes |
| TC-68 | Pass | "This database already holds 1 administrator." → `n` → "Nothing was created.", exit 0, row count unchanged |
| TC-69 | Pass | Refuses with "This script must be run in a terminal" when stdin is a pipe |
| TC-70 | Pass | `password_hash` begins `$2b$12$` |

### Regression

| ID | Result | Notes |
| --- | --- | --- |
| TC-71 | Pass | All seven storefront URLs 200 |
| TC-72 | Pass | `git status` shows neither `app/api/create-order/route.ts` nor `app/api/verify-order/route.ts` modified |
| TC-73 | Pass | See the Gate table above |

## Findings

Two defects were found by running the code rather than by reading it. Both were fixed before
this result was written; neither reached a commit.

### 1. A relative redirect `Location` is rejected by Next's middleware runtime

TC-22 asked what a browser is sent to when it is redirected to the login page, and the first
implementation used `NextResponse.redirect(request.nextUrl.clone())` — the ordinary pattern.
Against a running server with proxy headers set, that produced
`location: http://localhost:3000/login`: `nextUrl`'s origin is the address the Node process is
listening on, **not** the hostname the browser asked for. Behind Coolify's proxy that is an
internal name a browser cannot resolve.

The obvious fix — emitting a site-relative `Location: /login` and letting the browser resolve it
— compiled, type-checked, and passed its unit test. It then returned **HTTP 500** from a real
server:

```
TypeError: Invalid URL
    at eV (/workspaces/Morchadi-Gems/.next/server/middleware.js:13:25843)
  code: 'ERR_INVALID_URL',
  input: '/login'
```

Next parses the `Location` of a 3xx returned from middleware and requires it to be absolute. The
unit test could not have caught this: it inspects the `NextResponse` object, which is
well-formed, and the rejection happens later in the framework.

**Fix.** The absolute URL is assembled from the *forwarded* origin — `X-Forwarded-Host` and
`X-Forwarded-Proto` where present, the request's own host and scheme otherwise — with a
`try`/`catch` falling back to `request.nextUrl` so a malformed `Host` header degrades to a
wrong-but-working redirect rather than a 500 on the storefront. Verified live: with
`X-Forwarded-Host: admin.morchadigems.com` and `X-Forwarded-Proto: https` against a container
whose own `Host` is `10.0.0.5:3000`, the response is
`location: https://admin.morchadigems.com/login`.

**Lesson recorded:** a middleware unit test asserts what the handler *returns*, not what Next
*does with it*. Any middleware response shape that is new to this repository needs one live
request before it is believed.

### 2. `robots.txt` on the admin subdomain would have said the wrong thing

The plan's TC-62 existed because the prompt asked for this to be investigated rather than
assumed, and the assumption would have been wrong twice over.

`app/robots.ts` has no host-aware logic and is prerendered once at build time, so **the same
bytes are served for every `Host`**. On `admin.morchadigems.com` that file would have opened
with `Allow: /`, and its `Disallow: /admin` would have named a prefix that does not exist on
that hostname — every admin page is at its root there. One robots response does not correctly
deny both hostnames.

Letting the rewrite have it was no better: with every path on the admin host rewritten under
`/admin/*`, `robots.txt` would have resolved to a route that does not exist and returned 404 —
and a 404 for `robots.txt` is read as "crawl everything".

**Fix.** `app/admin/robots.txt/route.ts`, a static route handler serving `User-agent: *` /
`Disallow: /`, reached on the admin host by the same rewrite that serves every other path there.
`app/robots.ts` stays static and host-agnostic; only `/admin` was added to its disallow list. No
`Sitemap:` line is emitted from the admin file — pointing at the storefront's sitemap would
invite a crawler onto the host the file is refusing.

## Summary

**73 of 73 cases pass. 0 failed, 0 skipped.** Suite: **895 passed across 46 files**, up from
814 across 43. Gate: five of five green.

Two defects found and fixed during execution, both by running the code against a live server;
both are written up above.

**This is shippable as an authentication foundation, and it is not yet reachable in
production.** `admin.morchadigems.com` has no DNS record and no Coolify domain entry, and
production Postgres does not exist — so the panel works in local development only until the
deployment prompt described in
[ADR-041](../decisions/ADR-041-admin-subdomain-and-auth.md#pending-deployment) is done. That is
the intended state at the end of this prompt, not a failure.

**Test data left behind: none.** The two database-backed suites create a throwaway admin and
delete it; the `devadmin` account used for the manual cases was deleted afterwards, and
`admin_sessions` was confirmed empty (its rows cascade from `admins`).
