# Deploying Morchadi Gems on Coolify

The production target is **Coolify**, self-hosted on a Hostinger VPS (Ubuntu 24.04, Docker).
Not Vercel. The reasoning behind the container shape is in
[ADR-032](docs/decisions/ADR-032-coolify-docker-deploy.md); this file is the procedure.

The application ships in one image built from the [`Dockerfile`](Dockerfile) at the repo root.
The **catalogue** travels inside that image as `data/products.json`
([ADR-001](docs/decisions/ADR-001-tech-stack.md)), so a catalogue change is a redeploy and a
rollback is a previous image tag.

**There is also a Postgres**, holding orders, customers and the admin account
([ADR-040](docs/decisions/ADR-040-postgres-for-orders.md)). It is a separate Coolify resource
with its own volume, it is *not* in this image, and it is the one piece of this deployment that
a restart must not lose. Two steps go with it and neither is automated:
**`prisma migrate deploy`** after a schema change, and **`npm run seed:admin`** once, to create
the operator account. Both are in section 5a.

This file was rewritten on 2026-08-21 to match what the deployment actually does. Anything it
still cannot see from inside the repository — the live Coolify settings, the production
`DATABASE_URL` — is called out where it appears rather than asserted.

---

## 1. Before you start

You need:

- A VPS with Docker, running Coolify, reachable over SSH.
- The domain, with DNS you can edit — an `A` record for the storefront **and one for
  `admin`**, because the admin panel is a second hostname served by this same deployment
  ([ADR-041](docs/decisions/ADR-041-admin-subdomain-and-auth.md)).
- A **Postgres resource in Coolify**, and its connection string. Postgres 16 matches the local
  `docker-compose.yml`.
- **Live Cashfree credentials** — app ID and secret key from the Cashfree dashboard under
  *Developers → API Keys*, on the **production** tab. The sandbox pair will not charge real
  cards.
- Optionally, the CallMeBot phone and API key for the owner's WhatsApp order notifications.
  Leave them unset and checkout works identically; the notification is simply skipped
  ([`docs/api/notify-admin.md`](docs/api/notify-admin.md)).

Decide the canonical origin now — `https://www.morchadigems.com` or `https://morchadigems.com`,
one or the other. It goes into the sitemap, the canonical tags and the Cashfree return URL, and
changing it later means a rebuild, not just an env edit. Pick one, and redirect the other to it.

---

## 2. Create the application in Coolify

1. **Projects → New Resource → Public Repository** (or *Private Repository* via the GitHub
   App if this repo is private).
2. Repository: this repo. Branch: `main`.
3. **Build Pack: `Dockerfile`.** Not Nixpacks. Coolify offers Nixpacks by default and it will
   appear to work — do not use it. The Dockerfile is what encodes the two copy steps and the
   `sharp` requirement that a generic Next.js build pack gets wrong; see
   [ADR-032](docs/decisions/ADR-032-coolify-docker-deploy.md).
4. Dockerfile location: `/Dockerfile`. Build context: `/`.
5. **Port: `3000`.** This is the port Coolify's proxy forwards to inside the container. The
   image exposes 3000 and the server reads `PORT`, so if you change one, change both.

---

## 3. Environment variables

Coolify separates **build variables** (present while the image is built) from **runtime
variables** (injected when the container starts). The distinction is not cosmetic here — a
value in the wrong column fails silently.

### Build-time — tick "Build Variable" (or "Available at build")

Next inlines these at compile time. Setting them only at runtime does nothing at all.

| Variable | Value | Notes |
| --- | --- | --- |
| `APP_BASE_URL` | `https://www.morchadigems.com` | **Also needed at runtime — set it in both columns.** |
| `NEXT_PUBLIC_BASE_URL` | `https://www.morchadigems.com` | Same origin. Inlined into the client bundle. |
| `NEXT_PUBLIC_WEB3FORMS_KEY` | your Web3Forms key, or leave unset | Public by design. Unset means the contact form validates and then honestly says delivery is not connected. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | your GA4 measurement id (`G-…`), or leave unset | Public by design. Unset means no analytics tag is rendered at all and the site behaves exactly as it does without it. The CSP already allows the Google hosts it needs ([ADR-039](docs/decisions/ADR-039-analytics-and-utm-attribution.md)). **Build-time only** — Next inlines it, so a value set at runtime does nothing. **A `Dockerfile` `ARG` for this was missing until 2026-08-21**; an image built before then discarded whatever Coolify passed, so if analytics has never reported, rebuild rather than re-checking the id. |

Never put a secret in this column. Build variables are passed as Docker build ARGs and remain
readable in the image history.

### Runtime — ordinary variables, not build variables

| Variable | Value | Notes |
| --- | --- | --- |
| `APP_BASE_URL` | `https://www.morchadigems.com` | The Cashfree `return_url` is built from this per request. |
| `CASHFREE_APP_ID` | live app ID | Server-only. |
| `CASHFREE_SECRET_KEY` | live secret key | Server-only, the most sensitive value in the project. Mark it a secret in Coolify. |
| `CASHFREE_ENV` | `production` | `sandbox` moves no real money. Must match the credential pair. |
| `CALLMEBOT_PHONE` | `919358358834` | Optional. Country code first, digits only, no `+`. |
| `CALLMEBOT_APIKEY` | the key CallMeBot issued | Optional. Both must be set or the notification is skipped. |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | **Required.** Server-only, and the second most sensitive value here — mark it a secret in Coolify. Runtime only: `prisma generate` reads the schema file and never this, so it is deliberately not a build ARG ([ADR-047](docs/decisions/ADR-047-prisma-generate-in-docker-build.md)). Use Coolify's internal service hostname, not a public address. |
| `ADMIN_HOSTNAME` | `admin.morchadigems.com` | Optional. Unset falls back to exactly this value (`lib/admin-routing.ts`); set it explicitly if the panel lives anywhere else, or the middleware will not recognise its own hostname and will bounce every admin request to the storefront home. |

**Nothing breaks loudly when `DATABASE_URL` is missing**, which is the trap. Checkout still
takes money — the Postgres write is deliberately off the critical path
([ADR-042](docs/decisions/ADR-042-order-capture-in-postgres.md)) — and the only symptom is
`[order-capture]` lines in the container log, an admin panel that cannot log in, and orders that
exist at Cashfree and nowhere else. Set it before the first real payment, not after.

`PORT` and `HOSTNAME` are set in the image (`3000`, `0.0.0.0`) and need no entry. Coolify may
override `PORT`; the app follows it.

### Why `APP_BASE_URL` appears twice

It is read through `process.env` in server code, so it genuinely is a runtime variable — but
its most important callers run during the build. `/sitemap.xml`, `/robots.txt`, every canonical
tag and every schema.org `@id` are prerendered ([ADR-029](docs/decisions/ADR-029-seo-foundations.md)),
so their URLs are baked into the image.

- Set at runtime only → the deployed sitemap and canonicals say `http://localhost:3000`.
- Set at build only → the Cashfree return URL falls back to the request origin, which behind a
  proxy can be an internal hostname.

Set it in both columns, to the same value, with `https://` and **no trailing slash**.

---

## 4. Domain and TLS

1. In Coolify, set the application's domain to `https://www.morchadigems.com` — with the
   scheme. Coolify uses it to route through its Traefik/Caddy proxy and to request a
   certificate.
2. Point DNS at the VPS: an `A` record for `www` (and the apex, if you are redirecting it) to
   the server's IP.
3. **Add the admin hostname to the same application.** `admin.morchadigems.com` needs its own
   `A` record and its own entry in Coolify's domain field, because it is a second hostname on
   one deployment rather than a second application — `middleware.ts` rewrites every path on it
   into `/admin/*` ([ADR-041](docs/decisions/ADR-041-admin-subdomain-and-auth.md)). Coolify
   issues a certificate per hostname, so both need one.
4. Deploy, then load both domains over https and confirm the padlock on each.

### Cloudflare

If the domain sits behind Cloudflare, the orange cloud is fine — but the SSL/TLS mode must be
**Full (strict)**.

- **Flexible** breaks this deployment. Cloudflare would talk to the origin over plain http
  while telling the browser the connection is secure, and a payment flow that redirects out to
  Cashfree and back is exactly where that produces mixed-content and redirect loops.
- Full (strict) requires a valid certificate on the origin, which Coolify already issues.

Two settings worth checking while you are there: **Always Use HTTPS** on, and no aggressive
"Rocket Loader"/script-minification feature enabled — those rewrite JavaScript in transit and
have a history of breaking hydration.

If Coolify's certificate request fails while the orange cloud is on, grey-cloud the record,
let the certificate issue, then turn it back on.

#### ⚠️ Do not enable "Cache Everything" on this site

**Leave Cloudflare's caching at its default. Do not add a Cache Rule — or a legacy Page Rule —
that caches full pages, HTML, or any extensionless path on `morchadigems.com`.** This is not a
performance preference. Turning it on with the current Next.js version can serve visitors raw
React internals instead of the page.

The reason is a property of the App Router rather than anything this repository chose. **The
same URL returns two different documents depending on one request header.** `/about` and every
product page answer `text/html` to a browser, and answer `text/x-component` — a React Server
Component payload, which is machine data, not a page — to a request carrying `RSC: 1`. Next
declares the difference honestly in the response:

```
Cache-Control: s-maxage=31536000, stale-while-revalidate
Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding
```

`Vary: RSC` is the instruction that keeps those two documents in separate cache entries, and
**Cloudflare does not honour it by default** — it varies on `Accept-Encoding` and nothing else
unless a Cache Rule is explicitly configured to do more. `s-maxage=31536000` is meanwhile a
year-long instruction addressed to shared caches specifically.

Put those together and a cache that stores full pages without partitioning on `RSC` can file a
component payload under the ordinary page URL. Every subsequent visitor is served that payload
— for up to a year — and it is a public storefront, so "every visitor" means every shopper.
Today nothing happens, because Cloudflare does not cache HTML by default and the year-long
`s-maxage` is shouted into a void. Enabling full-page caching is what wakes it up.

Related, and for the same reason: **do not add 307 to Cloudflare's cacheable status codes, and
do not change `middleware.ts`'s redirects away from 307.** The admin-subdomain redirects
([ADR-041](docs/decisions/ADR-041-admin-subdomain-and-auth.md)) can be made to drop their
`Location` header by an injected request header; 307's absence from Cloudflare's default
cacheable set (200, 206, 301, 302, 303, 404, 410) is what currently stops that from being
cached and served to other people.

**When this restriction lifts:** upgrading Next.js past 14.2.35 fixes all of it at the origin —
the relevant advisories are patched in 15.5.16 and 15.5.21. Until that upgrade lands, the
setting is the mitigation. Full detail, including the reproduction, is in
[ADR-049](docs/decisions/ADR-049-next-14-advisory-triage-and-upgrade-scope.md).

---

## 5. Deploy and verify

Press **Deploy**. First build takes a few minutes; later builds reuse the cached dependency
layer unless `package-lock.json` changed.

Then check the things a green build does not prove. **A container with missing assets still
returns 200 on `/`** — that failure is silent by design of the health check, so verify assets
explicitly:

```bash
BASE=https://www.morchadigems.com

curl -s -o /dev/null -w '%{http_code}\n' $BASE/                      # 200, HTML
curl -s -o /dev/null -w '%{http_code}\n' $BASE/products/P001.webp    # 200 image/webp  <- public/ copied
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/_next/image?url=%2Fproducts%2FP001.webp&w=640&q=75"  # 200 <- sharp present
curl -s $BASE/robots.txt                                             # Sitemap: line must show the real domain
curl -s $BASE/sitemap.xml | head -20                                 # <loc> must not say localhost
```

```bash
ADMIN=https://admin.morchadigems.com

curl -s $ADMIN/robots.txt                                            # must be the deny-all file,
                                                                     # not the storefront's
curl -s -o /dev/null -w '%{http_code}\n' $ADMIN/orders               # 307 to /login when signed out
```

Then in a browser: load a product page and confirm photographs and styling render, add to
cart, and run one real payment end to end. Cashfree production is the only way to know the
live credentials and the return URL work together.

**Then check the database, which a green build and a 200 on `/` say nothing about.** Start with
the one command that answers it directly:

```bash
curl -s -o /dev/null -w '%{http_code}\n' $BASE/api/health   # 200. Anything else is a problem.
curl -s $BASE/api/health                                    # {"status":"healthy","database":"reachable",...}
```

| What it says | What it means | What to do |
| --- | --- | --- |
| `200` `"database":"reachable"` | The deployment can reach Postgres and its schema matches this image | Carry on |
| `503` `"database":"unreachable"` | Wrong or missing `DATABASE_URL`, Postgres not running, or not on this network | §3 for the variable, then Coolify's database resource |
| `503` `"database":"schema-mismatch"` | Postgres answered, but `orders` is not the table this image expects | **Migrations were not applied.** §5a |

The 503 body never says which host or which column; the container log does. `/api/health` is
the only surface in this deployment that answers this question, and §5b explains why it is not
wired to anything that can restart the container.

**Then check the two things only a real order can answer**, because a checkout that succeeded
proves nothing about the write behind it:

1. Sign in at `$ADMIN/login` and confirm the order you just placed appears in the list, with the
   right total and the right address.
2. Take its ten-character order number to `$BASE/track` and confirm the customer-facing page
   finds it.

If checkout succeeded and the order is not in the list, the write failed silently and section 3
is where to look. That is by design, and it is why this check is here.

---

## 5a. The database steps, which nothing runs for you

Neither of these is in the image, in an entrypoint, or in any Coolify hook. **They are manual,
and a deploy that needed them and did not get them starts cleanly and fails at the first
query.** ADR-047 recorded this gap; [ADR-048](docs/decisions/ADR-048-database-health-and-failure-surfaces.md)
decided to leave it manual and to make it *visible* instead, which is what the `/api/health`
check in §5 above is for. Run that check after every deploy that carries a migration, and the
window in which an unapplied one is invisible is one curl wide.

**Why it is not automated**, so the question does not get reopened every six months:
`prisma migrate deploy` needs the `prisma` CLI and the `prisma/migrations` directory, and the
runtime image has neither. `output: "standalone"` traces only what the server imports, which is
`@prisma/client` and its query engine; the CLI and the schema engine it drives are another
~115 MB of build tooling that `standalone` exists to leave behind. Shipping them so an entrypoint
could run migrations would also put Postgres on the container's boot path, so a database blip
during a restart would turn into a crash loop and take down a storefront that does not need a
database to serve a page or take a payment. ADR-047 rejected an entrypoint `prisma generate` for
the first of those reasons and ADR-048 rejects an entrypoint `migrate deploy` for both.

### Reaching production Postgres from a machine with the Prisma CLI

The runtime container has no `prisma` binary — `output: "standalone"` exists to leave build
tooling behind — so migrations are run from somewhere else pointed at the production database.
Coolify's Postgres is normally reachable only on the server's internal Docker network, so one of
two things has to happen first:

- **An SSH tunnel from your machine to the VPS**, forwarding a local port at the database's
  internal address. This is the better option: nothing about the server's exposure changes, and
  the tunnel dies when you close it.

  ```bash
  ssh -L 55432:<postgres-internal-host>:5432 <user>@<vps-ip>
  # then, in another shell, from a checkout of this repo at the deployed commit:
  DATABASE_URL='postgresql://<user>:<pass>@localhost:55432/<db>' npx prisma migrate status
  ```

- **Temporarily publishing the Postgres port** in Coolify, running the command against the
  public address, and **unpublishing it again**. Faster, and it puts the shop's order database
  on the open internet for the duration. If you do it, use it for the length of one command.

Whichever route, `prisma migrate status` first. It is read-only and it tells you whether there
is anything to do.

### Applying migrations

```bash
DATABASE_URL='<production url>' npx prisma migrate deploy
```

`migrate deploy` only applies migrations the database has not seen. It never resets and never
generates a new migration. **Never run `migrate dev` or `migrate reset` against production** —
`reset` drops the schema, and `dev` will happily invent a migration from whatever your local
schema happens to say.

Run it **after** the new image is built and **before** or immediately as it starts, and keep the
migration backward-compatible with the image already running if there is any overlap. The three
committed migrations are listed in [`docs/DEV-DATABASE.md`](docs/DEV-DATABASE.md); note that
`20260820085000` adds `amount_prepaid` as `NOT NULL` with no default and makes
`cashfree_order_id` unique, neither of which is safe against a table that already holds rows.

Then confirm it from the outside, which needs no tunnel and no credentials:

```bash
curl -s https://www.morchadigems.com/api/health   # "database":"reachable", not "schema-mismatch"
```

`schema-mismatch` there is the running deployment telling you it reached Postgres and did not
recognise the `orders` table it found. It is the same query Prisma emits for a real order read,
so if that route is happy the write path will be too.

### Creating the operator account

Once, on a fresh database:

```bash
DATABASE_URL='<production url>' npm run seed:admin
```

It prompts for a username and a password twice, echoes neither, enforces a 12-character minimum,
and writes one bcrypt hash to `admins`. The plaintext is never stored, logged or displayed. Then
sign in at `https://admin.morchadigems.com/login` to confirm it took.

The script reads an already-set `DATABASE_URL` in preference to any `.env` file, which is
exactly how a one-off run against production is done without editing anything.

### Backups

**There is no backup policy in this repository.** Coolify can schedule `pg_dump` on a database
resource; whether that is switched on is [VERIFY WITH OWNER]. The catalogue is in git and the
image is reproducible — the orders table is the only thing here that cannot be rebuilt.

---

## 5b. The health check, and the one thing it must not be pointed at

**A manual Coolify step, because it is a dashboard setting and not a file in this repository.**
Nothing here can read it, so what Coolify is currently configured with is
**[VERIFY WITH OWNER]**.

### What to set

In Coolify: **your application → Configuration → Health Check**.

- If the health check is **disabled**, leave it disabled. The image carries its own
  `HEALTHCHECK` (see the `Dockerfile`) and it is already correct.
- If it is **enabled**, the **Path** must be `/` and the expected **Return Code** `200`.

That is the whole change: confirm the path is `/`, and change it back if it is anything else.

### Why it is `/` and not `/api/health`

`/api/health` is the new route that actually queries Postgres, and pointing a *container* health
check at it looks like an obvious upgrade. It is the opposite of one.

The storefront renders from `data/products.json`, and checkout writes to Postgres off the
critical path on purpose ([ADR-042](docs/decisions/ADR-042-order-capture-in-postgres.md)): the
shop keeps serving pages and keeps taking payments through a database outage. If the container
health check went red whenever Postgres did, Coolify would mark a perfectly serving container
unhealthy, restart it, and fail deploys — so a thirty-second Postgres restart at 3am would take
the whole shop offline to protect it from a fault it was built to survive. **Liveness is
"can this process serve"; `/api/health` answers "is the dependency well". They are different
questions and only one of them may decide whether the container lives.**

### So who watches `/api/health`?

You do, after each deploy (§5 above). Beyond that, point any uptime monitor at
`https://www.morchadigems.com/api/health` and have it alert on a non-200 — the route is public,
unauthenticated, `no-store`, and its body is three fields wide with no host, port or error text
in it. Treat an alert as urgent rather than as a broken page: **checkout does not stop when
Postgres does**, so every minute of a 503 there is a minute in which real orders are being paid
for and not recorded.

The admin panel says the same thing from the inside. Every panel screen renders its own
"The order database did not answer" state during an outage rather than a blank list or a generic
500, and it says out loud that orders are still arriving unrecorded
([ADR-048](docs/decisions/ADR-048-database-health-and-failure-surfaces.md)).

### One thing the route deliberately does not answer

On the admin hostname, `admin.morchadigems.com/api/health` is **not** this route: middleware
rewrites every path on that hostname into `/admin/*`, so it resolves to `/admin/api/health`,
which does not exist — a 307 to the login page without a session cookie, a 404 with one. Use
the storefront domain. The container's own check reaches the app at `127.0.0.1:3000`, which is
not the admin hostname either, so the rewrite never applies there.

---

## 6. If the build runs out of memory

`next build` peaks around **1.5–2 GB** for this app — 70 prerendered pages, 49 products, and
the image pipeline. On a small VPS the build gets OOM-killed by the kernel, and the symptom is
unhelpful: the deploy fails with **`exit code 137`** or a bare "killed", not a Next.js error.

Two fixes, host-side. Neither changes application behaviour.

**Add swap** — the better fix, since it helps every build on the box:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # survive reboot
free -h                                                       # confirm
```

**Or cap Node's heap** — set as a *build* variable in Coolify:

```
NODE_OPTIONS=--max-old-space-size=1536
```

This makes Node garbage-collect harder rather than grow until the kernel intervenes. Set it
below the container's real memory limit, not at it.

If the box has 2 GB or less total, do both. A third option is building the image elsewhere
(CI, or locally) and having Coolify pull the tag instead of building on the VPS.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Page loads but every image and stylesheet 404s | `public/` or `.next/static` not copied into the runner stage | The three `COPY --from=builder` lines in the Dockerfile. Standalone output includes neither — see [ADR-032](docs/decisions/ADR-032-coolify-docker-deploy.md). |
| Build fails: `Module '"@prisma/client"' has no exported member 'OrderStatus'` | The Prisma Client was never generated | The builder stage must run `npx prisma generate` before `npm run build`. The deps stage cannot do it — it carries no schema — and it fails silently there. See [ADR-047](docs/decisions/ADR-047-prisma-generate-in-docker-build.md). |
| HTML and CSS fine, but `/_next/image?...` 500s | `sharp` missing from the traced output | The deps stage must run a full `npm ci`. `npm ci --omit=dev` builds green and breaks every optimised image. |
| Coolify says unhealthy, container logs look fine | Server bound to localhost inside the container | `HOSTNAME=0.0.0.0` in the runner stage. Do not remove it. |
| Sitemap and canonicals say `localhost:3000` | `APP_BASE_URL` set at runtime only | Add it as a build variable too, then **redeploy** — a restart will not fix it, the values are baked in. |
| Cashfree returns the shopper to the wrong host | `APP_BASE_URL` missing at runtime | Add it as a runtime variable. |
| Build fails, `exit code 137` | Out of memory | Section 6. |
| Contact form says delivery is not connected | `NEXT_PUBLIC_WEB3FORMS_KEY` unset at build time | Add it as a build variable and redeploy. |
| Deploy succeeds but the catalogue is stale | Image not rebuilt | Catalogue changes ship as code ([ADR-001](docs/decisions/ADR-001-tech-stack.md)). Every product edit needs a redeploy. |
| Checkout works, but no orders appear in the panel | `DATABASE_URL` unset or wrong | `curl $BASE/api/health` first: it answers this in one line. The capture write is off the critical path and fails silently by design ([ADR-042](docs/decisions/ADR-042-order-capture-in-postgres.md)). Look for `[order-capture]` in the container log. Section 3. |
| `/api/health` says `"database":"schema-mismatch"` | Postgres is reachable but the image is ahead of it | `prisma migrate deploy`. Nothing runs it for you. Section 5a. |
| `/api/health` 404s, or 307s to a login page | It was requested on `admin.morchadigems.com` | Use the storefront domain. Every path on the admin hostname is rewritten into `/admin/*`. Section 5b. |
| Coolify restarts the container whenever Postgres blips | Coolify's health check path was pointed at `/api/health` | Set it back to `/`. That route is a dependency probe, not a liveness probe. Section 5b. |
| Every admin screen says "The order database did not answer" | Postgres is unreachable from the container | It is telling the truth, and orders are being taken and not recorded. Treat as urgent. `curl $BASE/api/health`, then section 3. |
| Admin login always rejects, correct password | No `admins` row in *this* database | `npm run seed:admin` against the production URL. Section 5a. |
| `The column orders.xyz does not exist` at runtime | Image is ahead of the database | `prisma migrate deploy`. Nothing runs it for you. Section 5a. |
| Sign-in says "The admin database did not answer" | Postgres unreachable, so the password could not be checked at all | It is not the password. `curl $BASE/api/health`, then section 3. |
| `admin.morchadigems.com` shows the shop, or redirects to it | The hostname is not the one middleware recognises | Set `ADMIN_HOSTNAME` to match exactly, and add the hostname to the application in Coolify. Section 3, section 4. |
| GA4 installed but reporting nothing | `NEXT_PUBLIC_GA_MEASUREMENT_ID` set at runtime, or baked by an image built before 2026-08-21 | Set it as a **build** variable and redeploy. The `Dockerfile` `ARG` only exists from that date. |

---

## 8. Building the image by hand

Useful for reproducing a failure locally. This is exactly what Coolify runs.

```bash
docker build \
  --build-arg APP_BASE_URL=https://www.morchadigems.com \
  --build-arg NEXT_PUBLIC_BASE_URL=https://www.morchadigems.com \
  --build-arg NEXT_PUBLIC_WEB3FORMS_KEY=... \
  --build-arg NEXT_PUBLIC_GA_MEASUREMENT_ID=G-... \
  -t morchadi-gems .

docker run --rm -p 3000:3000 \
  -e APP_BASE_URL=https://www.morchadigems.com \
  -e CASHFREE_ENV=sandbox \
  -e CASHFREE_APP_ID=... \
  -e CASHFREE_SECRET_KEY=... \
  -e DATABASE_URL='postgresql://...' \
  morchadi-gems
```

All four `--build-arg` values are declared as `ARG` in the Dockerfile; a `--build-arg` Docker
does not recognise is discarded with a warning rather than an error, which is how the GA id went
missing for as long as it did.

The image runs without `DATABASE_URL` — the storefront degrades exactly as section 3 describes
— but the admin panel will not sign in and no order will be recorded.

Resulting image is roughly 310 MB, plus the Prisma query engine the build trace now carries.
Local development is unaffected by any of this: `npm run dev:all` starts the local Postgres,
applies migrations and runs the dev server in one command.
