# ADR-041: The admin panel is a subdomain of one deployment, behind a database-backed session

- **Status:** Accepted — credential storage superseded by [ADR-061](ADR-061-env-var-admin-credentials.md); session storage, routing and the two-layer gate below still stand
- **Date:** 2026-08-20
- **Prompt:** 45

## Context

[ADR-040](ADR-040-postgres-for-orders.md) put orders, customers and an `admins` table into
Postgres and named the thing that has to come next: *"Phase 2 introduces an authenticated
operator."* Until now this site has had no login of any kind — [ADR-001](ADR-001-tech-stack.md)
chose guest checkout with no accounts, and that row still stands for shoppers. The operator is
a different party with a different need: one person, on their own machine, who has to be the
only one who can see what every customer bought and what it cost.

Three questions had to be answered before a single protected page could be written, and none of
them is reversible cheaply once order-management screens exist on top:

1. **Where does the panel live** — a path on the shop's own domain, a subdomain, or a separate
   application?
2. **What is a session** — a signed cookie the server can verify without asking anything, or a
   row in the database it already has?
3. **What does a failed login say**, given that a single operator account makes the username
   itself worth guessing?

The owner asked for `admin.morchadigems.com`. **That hostname does not exist yet** — there is
no DNS record for it and Coolify has never been told about it. Deciding the routing now and
wiring the domain later is deliberate, and the split is recorded under
*[Pending deployment](#pending-deployment)* below.

## Decision

### The panel is served on its own hostname, by the same deployment

`admin.morchadigems.com` is the admin panel's address in production. It is **not** a second
application, a second Docker image, a second container or a second build. One Next.js
deployment answers on both hostnames, and `middleware.ts` decides which of them a request is
for.

The mechanism is a hostname-keyed rewrite. Every admin page lives under `/admin/*` in the file
tree; on the admin hostname, middleware rewrites `/login` to `/admin/login`, `/orders` to
`/admin/orders` and `/` to `/admin`, so the `/admin` prefix is an implementation detail of the
repository that never appears in a URL anyone types. On the storefront's own hostname the same
paths are not the panel at all: `/admin/*` is redirected to the home page, so the panel cannot
be reached at `morchadigems.com/admin` even by someone holding a valid session cookie.

The hostname itself comes from `ADMIN_HOSTNAME`, defaulting to `admin.morchadigems.com`, on the
same principle `APP_BASE_URL` follows in [`lib/site-url.ts`](../../lib/site-url.ts): a domain is
a property of a deployment, not a string the repository owns. A blank value falls back to the
default rather than producing a hostname no request can ever match.

**Why a subdomain rather than a path.** A separate origin is a real security boundary: cookies,
`localStorage`, CSP and the same-origin policy all treat `admin.morchadigems.com` as a different
site from `www.morchadigems.com`, so an XSS on a product page cannot read the admin session, and
the admin cookie is never sent on a storefront request at all. It also keeps the panel out of
the shop's URL space entirely, which matters for a crawler, for a shared link, and for the
person who types the wrong address.

**Why one deployment rather than two.** A second app would mean a second image, a second
container in Coolify, a second set of environment variables to keep in step, and a second copy
of the code that reads `data/products.json` and talks to Prisma — for a panel that one person
uses. The subdomain gives the origin separation; the shared deployment gives one build, one
migration run and one place a bug is fixed. The cost is that both hostnames run the same
process, so a crash takes down both; that is accepted for a shop this size and named under
*Consequences*.

### Local development reaches the panel by path

There is no `admin.morchadigems.com` on a laptop, and inventing one (a hosts-file entry, a
wildcard DNS service) would make the panel untestable for anyone who had not done that setup.
So on a development hostname the internal route space is served directly:
`http://localhost:3000/admin/login`.

"Development hostname" is decided by two signals joined with **or** — a non-production
`NODE_ENV`, or a hostname that is plainly a development machine (`localhost`, `127.0.0.1`,
`::1`, `*.localhost`, and the forwarded-port hosts of Codespaces, Gitpod and ngrok). The `or` is
deliberate in both directions. A production build run locally (`npm run build && npm start`)
sets `NODE_ENV=production`, and without the hostname signal the panel would be untestable in
exactly the configuration most worth testing. And a real deployment that forgot to set
`NODE_ENV` is still answering on a public hostname, where the storefront-domain redirect
applies — so the failure mode of a missing variable is a panel that is *unreachable* on the
public domain, not one that is exposed there.

The admin hostname is checked **first**, before either signal, so pointing `admin.morchadigems.com`
at `127.0.0.1` in `/etc/hosts` exercises the production rewrite path locally if someone wants to.

### A session is a row in Postgres, not a signed cookie

The cookie carries 32 bytes of `randomBytes`, base64url-encoded, and nothing else — no
username, no expiry, no claims. The database stores the **SHA-256 of that token**, so a database
dump contains nothing that can be put back into a browser.

The alternative was a stateless signed cookie (an HMAC or a JWT over `{ adminId, expiresAt }`),
which is genuinely cheaper: no lookup per request, and it can be verified on the Edge runtime
where middleware runs. It was rejected on two counts.

**Revocation.** Signing out has to actually end the session. With a signed cookie, "logout"
deletes the browser's copy and nothing else — a token captured beforehand keeps working until it
expires, and there is no way to end it short of rotating a secret and logging everyone out. With
a row, `DELETE` is the logout, and it takes effect whether or not the browser ever receives the
response. For an account that can read every customer's address, that difference is the decision.

**One less secret to deploy.** A signed cookie needs a signing key set correctly in Coolify at
build *and* run, never rotated by accident, and never left at a default. Postgres is already
required by [ADR-040](ADR-040-postgres-for-orders.md) and already holds the `admins` table; the
session table adds no new operational surface at all. The lookup it costs is one indexed query
on a primary-key-shaped column, on a panel one person uses.

`AdminSession` therefore joins the schema — `token_hash` (unique), `admin_id` (cascading), 
`created_at`, `expires_at` — in migration `20260820064646_add_admin_sessions`.

**Sessions last seven days, fixed from the moment of login and never extended by activity.**
The owner signs in on their own machine, works, and is asked again the following week. A
sliding window would mean a session that never ends for anyone who visits daily, which is the
opposite of what an expiry is for. Expired rows are deleted as they are encountered and swept on
every login, so the table is kept by the traffic rather than by a scheduled job.

### The gate is in two layers, and only the second one is authentication

Next 14 runs middleware on the Edge runtime, which has no database driver. Middleware therefore
checks only that a session cookie is **present** and redirects to the login page when it is not.
A forged cookie gets past it.

`app/admin/(protected)/layout.tsx` is the check that decides who is logged in: it runs on Node,
resolves the cookie against Postgres, and redirects anything that does not name a live,
unexpired session. Every page inside that route group is protected by existing there rather
than by remembering to ask; the login page sits outside the group, at `app/admin/login`, so it
is not guarded by the thing it exists to get past. The route group adds no URL segment, so the
dashboard is still served at `/admin`.

Stating it plainly, because the order matters and a later change could quietly invert it:
**middleware is a cheap gate that keeps unauthenticated browsers off the panel; it is not the
thing that establishes identity, and nothing downstream may treat a request that passed it as
authenticated.**

### bcryptjs, not bcrypt

Passwords are hashed with **`bcryptjs` 3.0.3** — the pure-JavaScript implementation — at a cost
factor of 12, rather than the native `bcrypt` package.

The reason is the production image, and it is the same argument
[ADR-040](ADR-040-postgres-for-orders.md) made for staying on Prisma 6. The
[`Dockerfile`](../../Dockerfile) builds on `node:20-alpine` and installs dependencies in a stage
that is copied wholesale into the build stage; native `bcrypt` has no musl prebuild, so `npm ci`
would compile it, which means adding `python3`, `make` and `g++` to a stage that currently
installs nothing — and then trusting Next's standalone file tracing to carry a `.node` binary
built against one Alpine layer into another. That is deployment work this prompt is explicitly
scoped out of, in exchange for a performance difference that does not exist here: bcryptjs is
roughly two to three times slower per hash, on an operation that happens perhaps once a week and
is *deliberately* slow anyway. It is also API-compatible, so swapping to native bcrypt later is
an import change and a rebuild, not a migration — existing hashes verify either way.

`bcryptjs` 3 ships its own TypeScript types, so no `@types/bcryptjs` is needed (that package is
deprecated for v3).

### Every failed login is the same failed login

An unknown username, a wrong password, a blank field and a body that is not JSON all produce one
status (`401`), one message (`"Username or password is incorrect."`) and one duration.

With a single operator account the username is half the credential and worth protecting: a
message that distinguishes "no such user" from "wrong password" turns the form into an oracle
that hands an attacker the name before they try a single password. Three separate leaks had to
be closed, not one:

- **The words.** Both paths return the same string constant, and the test asserts the two
  response bodies are byte-identical rather than merely similar.
- **The work.** When no admin matches, the code still runs a bcrypt comparison, against a
  constant hash of a publicly known string, so the absent-user path does the same quarter second
  of key stretching the wrong-password path does.
- **The clock.** A rejection is padded up to a **600 ms floor** rather than delayed *by* a fixed
  amount, so the two paths take the same observable time even though only one of them hashed.

That floor is also the anti-brute-force measure, and it is not rate limiting and does not pretend
to be — it costs roughly a second per attempt from one connection. A real lockout belongs with
the prompt that gives the panel something worth attacking.

### One admin, created interactively by a script

`scripts/seed-admin.mjs` (run with `npm run seed:admin`) prompts on stdin for a username and a
password, hides the password as it is typed, asks for it twice, hashes it, and writes one row.

**Credentials are never accepted as command-line arguments.** An argument is written to the
shell's history file, is visible in `ps` to every other user on the machine while the process
runs, and is captured by any wrapper that logs the command it ran. The plaintext exists only
inside the process, is passed to bcrypt, and is never printed, written or transmitted.

If an admin already exists the script says how many and asks for confirmation before adding
another, because the panel is designed around one operator and a second row is more likely a
mistake than an intention. Usernames are lowercased on the way in and on the way to a login
lookup, so `Admin` on Monday and `admin` on Tuesday are the same account.

### The admin hostname serves its own `robots.txt`

This was investigated rather than assumed, and the assumption would have been wrong.

`app/robots.ts` builds one static file at build time with no host-aware logic whatsoever — the
same bytes are served for every `Host` header. So a request to `admin.morchadigems.com/robots.txt`
would have received the storefront's file, which opens with `Allow: /` and whose
`Disallow: /admin` names a prefix that **does not exist on that hostname**, every admin page
being at its root. One robots response does *not* correctly deny both hostnames; it denies the
right thing on one and the wrong thing on the other.

Leaving it to the rewrite was no better: with every path on the admin host rewritten under
`/admin/*`, `robots.txt` would have resolved to a route that does not exist and returned 404 —
and a 404 for `robots.txt` is read by crawlers as "crawl everything".

The fix keeps the host-awareness in the one layer that already has it. `app/admin/robots.txt/route.ts`
is a static route handler serving `User-agent: *` / `Disallow: /`, and the middleware rewrite is
what makes `admin.morchadigems.com/robots.txt` land on it. `app/robots.ts` is untouched except
to add `/admin` to the storefront's disallow list, so nothing about the shop's own file becomes
dynamic. The `Sitemap:` line is deliberately absent from the admin file: pointing at the
storefront's sitemap from there would invite a crawler onto the host the file is refusing.

`admin.morchadigems.com/sitemap.xml` resolves to nothing and 404s, which is the correct answer
for a private host — no sitemap is better than an empty one.

Three independent guards now keep the panel out of an index, and they fail independently:
`Disallow: /admin` on the storefront, a deny-all `robots.txt` on the admin host, and
`robots: { index: false, follow: false }` in the metadata of every page under `/admin`, which
travels with the page however it was reached.

## Alternatives considered

**The panel at `morchadigems.com/admin`.** The simplest thing that works, and it needs no DNS,
no middleware and no rewrite. Rejected on the origin boundary: on one origin the admin session
cookie is sent with storefront requests, script on any shop page can reach admin URLs with the
operator's credentials attached, and one CSP has to be wide enough for both a Cashfree checkout
and an admin panel. The subdomain gives a boundary the browser enforces, for the price of one
middleware file.

**A separate Next.js application on the admin subdomain.** The textbook answer, and the right
one at a larger scale. Rejected on operational cost against benefit: a second image to build, a
second Coolify service to configure and keep in step, a second deploy to remember, and shared
code (`lib/prisma.ts`, the catalogue reader, the design tokens) that would have to be duplicated
or extracted into a package. None of that buys anything the hostname rewrite does not already
give, for a panel with one user.

**A signed cookie or JWT instead of a session table.** Covered under *Decision*. It wins on
speed and on Edge-runtime verification; it loses on revocation, which is the property that
matters when the session grants access to every customer record. Worth revisiting only if the
per-request lookup ever shows up in a profile, which on a single-operator panel it will not.

**A `__Host-` prefixed cookie.** The strongest cookie identity available, and it was rejected
for one concrete reason: `__Host-` mandates `Secure`, and local development is served over plain
HTTP, where a `Secure` cookie is discarded — producing a login that appears to succeed and never
sticks. The cookie is `Secure` in production and not in development, which is the same trade-off
without the trap. `HttpOnly`, `SameSite=Lax` and `Path=/` apply everywhere.

**Server Actions instead of API routes for login.** Genuinely tempting, because a Server Action
posts to the page's own URL and is therefore immune to the prefix problem the rewrite creates
(`/api/login` on the admin host, `/admin/api/login` locally). Rejected for consistency: every
other endpoint in this project is a route handler with a documented contract in
[`docs/api/`](../api/), and one login flow is not worth a second pattern. The prefix problem is
solved instead by the server computing the correct URL from the request's hostname and handing
it to the form as a prop — which is testable, whereas a Server Action's transport is not.

**A CSRF token on the login and logout endpoints.** Deferred, not overlooked. The login endpoint
accepts JSON only, which a cross-site `<form>` cannot send without a CORS preflight the browser
will not grant, and the session cookie is `SameSite=Lax`, so no cross-site POST carries it. What
remains is login-CSRF (forcing a victim to be logged in as the attacker), which against a
single-operator panel with no shared state is close to meaningless. A token belongs with the
prompt that adds state worth forging a request against.

**Rate limiting the login endpoint with a library.** Out of scope by instruction, and the fixed
600 ms failure floor is the stand-in. Named here so it is not mistaken for a solved problem.

## Consequences

**What this makes easy.** Every future admin screen is a file under `app/admin/(protected)/` and
is protected by being there — no per-page guard to remember. The panel gains a real origin
boundary without a second deployment to operate. And the shop's public surface is unchanged:
storefront routing, checkout and the money path are untouched by this prompt, and
`middleware.ts` returns `NextResponse.next()` for every request that is not about the admin
panel.

**What it makes harder.** The two hostnames share one process, so a crash or a bad deploy takes
both down together — the isolation is at the origin, not at the runtime. Middleware is now on
the request path of every non-static request; it is a hostname comparison and a cookie check,
but it is no longer nothing. And a URL inside the panel now has two spellings — `/login` in
production, `/admin/login` locally — which is why no admin URL may be written down as a literal
in a component; they are all derived from the request hostname in
[`lib/admin-routing.ts`](../../lib/admin-routing.ts).

**The admin panel currently renders inside the storefront's chrome.** The shop header, footer and
floating WhatsApp button surround the login page and the dashboard, because separating them
means a second root layout, which means moving every storefront route into a route group. That
is a large, risky change for a cosmetic gain and belongs with the prompt that builds the real
admin UI, not with the one that adds a login form.

**Personal data now sits behind exactly one password.** ADR-040 listed the obligations that
arrive with customer rows in Postgres; this ADR is what decides who can read them. There is no
second factor, no lockout and no audit of admin logins — only a strong-ish password rule
(twelve characters minimum), a slow hash, and a session that can be revoked. Each of those gaps
is a reasonable next prompt, and none of them is closed by this one.

**What would force a revisit.** A second operator, which turns "one admin" into roles and makes
the seed script the wrong tool. A customer-facing login, which would put sessions on the
storefront origin too and change the cookie story completely. Or the admin panel outgrowing the
storefront's deploy cadence — wanting to ship a dashboard fix without rebuilding the shop is the
signal that the second application was the right call after all.

## Pending deployment

**`admin.morchadigems.com` does not resolve, and nothing in this prompt makes it resolve.** The
routing logic is complete and tested; the domain wiring is not started. Until both of the
following are done in a later, deployment-focused prompt, the panel is reachable in local
development only:

1. **DNS.** A record for `admin` in the `morchadigems.com` zone at Cloudflare, pointing at the
   same VPS as the apex. If the storefront's record is proxied, this one should match it — and
   Cloudflare's SSL mode must stay **Full (strict)**, which [`DEPLOY.md`](../../DEPLOY.md) §4
   already requires for the payment flow. A wildcard would also work and is not recommended: an
   explicit record is one more thing that has to be done on purpose.
2. **Coolify.** The admin hostname added as a second domain on the *existing* application — not
   a new service, not a new resource — so Traefik routes it to the same container and issues a
   certificate for it. Nothing else about the deployment changes.

Two environment settings ride along with that prompt, both listed in
[`.env.example`](../../.env.example): `ADMIN_HOSTNAME`, which is optional and only needed if the
panel ever moves off the default; and `DATABASE_URL`, which **is** required and does not yet
exist in production — ADR-040 deferred provisioning Postgres in Coolify, and the admin panel is
the first feature that genuinely cannot run without it. Seeding the production admin means
running `npm run seed:admin` against the production database from a shell that has it, which is
a step that prompt must plan for.
