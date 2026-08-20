# Test Plan: Admin authentication and subdomain routing

- **Scope:** the hostname routing decision, the middleware that applies it, session
  creation/validation/expiry/destruction, the login and logout endpoints, and the crawler
  guards on `/admin`. Covers both the production shape (`admin.morchadigems.com`) and the
  local-development fallback (`localhost:3000/admin/*`).
- **Explicitly not covered:** DNS resolution and Coolify domain configuration for
  `admin.morchadigems.com`, which do not exist yet
  ([ADR-041](../decisions/ADR-041-admin-subdomain-and-auth.md), *Pending deployment*); the
  order-management UI, which does not exist yet; rate limiting, which is deliberately not
  implemented; and the storefront, which this work must leave untouched.
- **Prerequisites:** local Postgres healthy (`docker compose ps`), `DATABASE_URL` set in `.env`
  and `.env.local`. The two database-backed suites skip rather than fail without it. The manual
  cases need a production build (`npm run build && npm start`), because `NODE_ENV=production` is
  half of what the routing decision reads.

## Cases

### Hostname routing — production shape

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | Admin host, login page, no session | `GET admin.morchadigems.com/login` | Rewritten to `/admin/login`, 200 | Automated |
| TC-02 | Admin host, login endpoint, no session | `POST admin.morchadigems.com/api/login` | Rewritten to `/admin/api/login` | Automated |
| TC-03 | Admin host, protected path, no session | `GET admin.morchadigems.com/orders` | 307 to `/login` on that host | Automated |
| TC-04 | Admin host, protected path, session cookie present | Same with cookie | Rewritten to `/admin/orders` | Automated |
| TC-05 | Admin host, root | `GET admin.morchadigems.com/` with cookie | Rewritten to `/admin` | Automated |
| TC-06 | Storefront host, `/admin` | `GET www.morchadigems.com/admin` | 307 to `/`, no rewrite | Automated |
| TC-07 | Storefront host, `/admin/login` | Same for the login path | 307 to `/` — the login page is not served on the public domain | Automated |
| TC-08 | Storefront host, `/admin/*` **with** a valid session cookie | Same with cookie | Still 307 to `/`. The hostname decides, not the cookie | Automated |
| TC-09 | Storefront routes unaffected | `/`, `/shop`, `/product/P001`, `/api/create-order`, `/robots.txt` on the storefront host | `continue` — no rewrite, no redirect | Automated |
| TC-10 | A path that merely starts with the same letters | `GET /administration` | `continue`, not treated as admin | Automated |
| TC-11 | `ADMIN_HOSTNAME` override | Set to `panel.example.test` | That host rewrites; the default host no longer does | Automated |
| TC-12 | Blank `ADMIN_HOSTNAME` | Set to whitespace | Falls back to the default rather than matching nothing | Automated |
| TC-13 | Storefront API unreachable on the admin host | `GET admin.morchadigems.com/api/create-order` with a session | Rewrites to `/admin/api/create-order` → 404 | Automated + Manual |

### Hostname routing — local development

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-14 | Path-addressed login | `GET localhost:3000/admin/login` | `continue`, 200 | Automated |
| TC-15 | Path-addressed protected page, no session | `GET localhost:3000/admin` | 307 to `/admin/login` | Automated |
| TC-16 | Path-addressed protected page, session present | Same with cookie | `continue` | Automated |
| TC-17 | Codespaces forwarded-port host | Same two cases on `*.app.github.dev` | Behaves as localhost does | Automated |
| TC-18 | Production build run locally | `NODE_ENV=production`, host `localhost` | Still path-addressed — the hostname signal wins | Automated |
| TC-19 | Storefront untouched locally | `/`, `/shop` on localhost | `continue` | Automated |

### Middleware mechanics

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-20 | Rewrite header | Authenticated admin-host request | `x-middleware-rewrite` names the `/admin/*` URL | Automated |
| TC-21 | Redirect status | Unauthenticated admin-host request | 307 with a `Location` | Automated |
| TC-22 | Redirect origin behind a proxy | `X-Forwarded-Host: admin.morchadigems.com`, `X-Forwarded-Proto: https`, `Host:` an internal name | `Location` is `https://admin.morchadigems.com/login` — the browser's origin, not the container's | Automated + Manual |
| TC-23 | Chained proxies | Comma-separated `X-Forwarded-Host`/`-Proto` | Leftmost entry used | Automated |
| TC-24 | Query string on redirect | `/orders?status=packed`, no session | Query dropped from the `Location` | Automated |
| TC-25 | Pass-through | Storefront request | `x-middleware-next: 1`, no rewrite, no location | Automated |

### Sessions

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-26 | Create and read back | `createAdminSession(adminId)` then `readAdminSession(token)` | Resolves to that admin's id and username | Automated |
| TC-27 | Seven-day expiry | Inspect `expiresAt` | Exactly `7 × 24 × 60 × 60` seconds out, within tolerance | Automated |
| TC-28 | Token is not stored | Read the row | `token_hash` is 64 hex characters and is **not** the token | Automated |
| TC-29 | Tokens are unique | Two consecutive sessions | Different tokens, both valid | Automated |
| TC-30 | Unknown token | `readAdminSession("not-a-token")` | `null` | Automated |
| TC-31 | Empty cookie | `readAdminSession("")` | `null`, without a query | Automated |
| TC-32 | Expired session | Backdate `expiresAt`, then read | `null`, **and the row is deleted** | Automated |
| TC-33 | Destroy | `destroyAdminSession(token)` then read | `null`, row gone | Automated |
| TC-34 | Destroy is scoped | Two sessions, destroy one | The other still resolves | Automated |
| TC-35 | Destroy all for an admin | `destroyAllSessionsForAdmin` | Both end | Automated |
| TC-36 | Destroy an unknown token | Unknown and empty token | No throw, no effect | Automated |
| TC-37 | Expiry sweep | Two expired, one live | Expired removed, live survives | Automated |
| TC-38 | Cookie attributes | Inspect the options builder | `HttpOnly`, `SameSite=Lax`, `Path=/` | Automated |
| TC-39 | `Secure` follows the environment | Production vs development | `true` then `false` — a `Secure` cookie over plain-HTTP localhost would be discarded | Automated |
| TC-40 | Clearing cookie matches | Inspect the cleared options | Same attributes, `Max-Age=0` | Automated |

### Login and logout

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-41 | Correct credentials | `POST` valid username and password | 200, `{"status":"SIGNED_IN"}`, `Set-Cookie` with `HttpOnly`, `SameSite=lax`, `Path=/` | Automated |
| TC-42 | The cookie is real | Take the token from `Set-Cookie` and resolve it | Names that admin | Automated |
| TC-43 | Wrong password | `POST` a valid username, wrong password | 401, generic message, **no** `Set-Cookie` | Automated |
| TC-44 | Wrong username | `POST` an unknown username | **Byte-identical** status and body to TC-43 | Automated |
| TC-45 | Empty and malformed bodies | `POST` empty strings; `POST` a form-encoded body | 401, byte-identical to each other | Automated |
| TC-46 | Timing | Time TC-43 and TC-44 | Both at or above the 600 ms failure floor | Automated |
| TC-47 | No echo | Inspect the failure body | Contains neither the submitted password nor the username | Automated |
| TC-48 | No caching | Inspect headers | `Cache-Control: no-store` | Automated |
| TC-49 | Username case | Sign in with a differently-cased, space-padded username | Accepted | Automated |
| TC-50 | Password hashing | `hashAdminPassword` twice | bcrypt format, salted (two different hashes), verifies | Automated |
| TC-51 | Logout | `POST` with a live session cookie | 200, `{"status":"SIGNED_OUT"}`, `Max-Age=0` cookie, **session dead server-side** | Automated |
| TC-52 | Logout with no session | `POST` with no cookie | 200, `SIGNED_OUT` — nothing to refuse | Automated |

### Route protection in the running app

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-53 | Forged cookie | `GET /admin` with an invented cookie value | Passes middleware, then the protected layout redirects to the login page. **Middleware is not the authentication** | Manual |
| TC-54 | Signed-in dashboard | `GET /admin` with a real session | 200, renders "Logged in as *username*" | Manual |
| TC-55 | Sign out end to end | `POST` logout, then `GET /admin` with the same cookie | Redirected to the login page | Manual |
| TC-56 | The login page stays reachable while signed in | `GET /admin/login` with a session | 200 (not a redirect loop) | Manual |
| TC-57 | Double prefix on the admin host | `GET admin.morchadigems.com/admin/login` | 404 — `/admin/admin/login` is not a route | Manual |

### Crawler guards

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-58 | Storefront `robots.txt` | Read the disallow list | Contains `/admin`, without a trailing slash so the bare path is covered | Automated |
| TC-59 | Disallow list composition | Compare to the sitemap's exclusions | `[...NON_INDEXABLE_PATHS, "/api/", "/admin"]` exactly | Automated |
| TC-60 | Admin host `robots.txt` | Read the builder and the route | `User-agent: *` / `Disallow: /`, `text/plain`, no `Allow:`, no `Sitemap:` | Automated |
| TC-61 | Sitemap | Every URL it publishes | None contains `/admin` | Automated |
| TC-62 | Admin host `robots.txt`, live | `GET admin.morchadigems.com/robots.txt` | The deny-all file, **not** the storefront's | Manual |
| TC-63 | Admin host sitemap | `GET admin.morchadigems.com/sitemap.xml` with a session | 404 — no sitemap for a private host | Manual |
| TC-64 | `/admin/robots.txt` on the storefront host | `GET www.morchadigems.com/admin/robots.txt` | 307 to `/` — the admin file is not served on the public domain | Manual |
| TC-65 | Page metadata | Inspect `app/admin/layout.tsx` | `robots: { index: false, follow: false }` on every admin route | Manual |

### Seed script

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-66 | Happy path | Run `npm run seed:admin` in a terminal, answer the prompts | Row created, username lowercased, exit 0 | Manual |
| TC-67 | Password is never echoed | Capture the full pty transcript | The password appears nowhere in it | Manual |
| TC-68 | Existing admin | Run again with an admin present | Reports the count and asks; answering `n` creates nothing, exit 0 | Manual |
| TC-69 | Not a terminal | Pipe stdin | Refuses to run rather than reading an unhidden password | Manual |
| TC-70 | Only the hash is stored | Inspect the row | `password_hash` begins `$2b$12$`; no plaintext column exists | Manual |

### Seed script prompts

Added after the password and confirm-password prompts were found never to appear
([log](../logs/2026-08-20-password-prompt-never-appears.md)). Every case is driven through a real
pty and asserted against the **captured bytes**, not against how the screen looked — the original
bug was invisible in a rendered transcript and obvious in the raw stream.

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-74 | Every prompt is visible | Fresh run, answer all three questions | `Username: `, `Password (not shown): ` and `Confirm password: ` each appear and each capture input | Manual |
| TC-75 | Nothing erases a prompt | Inspect the captured byte stream of a full run | No cursor-positioning or erase sequence anywhere in it | Automated + Manual |
| TC-76 | Too-short password retry | Enter a password under 12 characters | The message shows **and the next password prompt is visible** | Manual |
| TC-77 | Mismatch retry | Enter a valid password, then a different confirmation | The message shows **and the next password prompt is visible** | Manual |
| TC-78 | Attempts exhausted | Fail three times | `No matching password after 3 attempts.`, exit 1, no row created | Manual |
| TC-79 | Existing admin, accepted | Run with an admin present, answer `y` | Proceeds to the username prompt and creates the row | Manual |
| TC-80 | Existing admin, declined | Run with an admin present, press Enter | `Nothing was created.`, exit 0 | Manual |
| TC-81 | The password is byte-exact | Verify the typed password against the stored hash | `compare` returns true for it and false for a near miss | Manual |
| TC-82 | Backspace, visible prompt | Type a username with extra characters and delete them | The echoed characters are erased; the corrected value is used | Automated + Manual |
| TC-83 | Backspace, hidden prompt | Delete characters while entering a password | Nothing is written at all — the length cannot be counted from the screen | Automated |
| TC-84 | Arrow keys | Press arrow keys mid-answer | Dropped, not appended as their escape sequence | Automated + Manual |
| TC-85 | Ctrl-C | Press Ctrl-C at a prompt | `Cancelled.`, exit 130, no row created — raw mode raises no signal, so the script must do this itself | Manual |
| TC-86 | Pasted CRLF | Paste an answer ending in carriage return and line feed | The line feed does not satisfy the following prompt | Automated |
| TC-87 | Type-ahead before a secret | Type past the Enter of a password | The extra characters do not reach the confirmation prompt | Automated |

### Regression

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-71 | The storefront still works | `/`, `/shop`, `/product/P001`, `/cart`, `/contact`, `/sitemap.xml`, `/robots.txt` | All 200 | Manual |
| TC-72 | The money path is untouched | `git status` on `app/api/create-order` and `app/api/verify-order` | Unmodified | Manual |
| TC-73 | Full gate | `typecheck && lint && test:run && validate:products && build` | All green | Automated |
