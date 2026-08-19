# Deploying Morchadi Gems on Coolify

The production target is **Coolify**, self-hosted on a Hostinger VPS (Ubuntu 24.04, Docker).
Not Vercel. The reasoning behind the container shape is in
[ADR-032](docs/decisions/ADR-032-coolify-docker-deploy.md); this file is the procedure.

Everything ships in one image built from the [`Dockerfile`](Dockerfile) at the repo root.
There is no database, no volume, and no migration step — the catalogue is
`data/products.json` and travels inside the image ([ADR-001](docs/decisions/ADR-001-tech-stack.md)).
A restart loses nothing. A rollback is a previous image tag.

---

## 1. Before you start

You need:

- A VPS with Docker, running Coolify, reachable over SSH.
- The domain, with DNS you can edit.
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
3. Deploy, then load the domain over https and confirm the padlock.

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

Then in a browser: load a product page and confirm photographs and styling render, add to
cart, and run one real payment end to end. Cashfree production is the only way to know the
live credentials and the return URL work together.

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
| HTML and CSS fine, but `/_next/image?...` 500s | `sharp` missing from the traced output | The deps stage must run a full `npm ci`. `npm ci --omit=dev` builds green and breaks every optimised image. |
| Coolify says unhealthy, container logs look fine | Server bound to localhost inside the container | `HOSTNAME=0.0.0.0` in the runner stage. Do not remove it. |
| Sitemap and canonicals say `localhost:3000` | `APP_BASE_URL` set at runtime only | Add it as a build variable too, then **redeploy** — a restart will not fix it, the values are baked in. |
| Cashfree returns the shopper to the wrong host | `APP_BASE_URL` missing at runtime | Add it as a runtime variable. |
| Build fails, `exit code 137` | Out of memory | Section 6. |
| Contact form says delivery is not connected | `NEXT_PUBLIC_WEB3FORMS_KEY` unset at build time | Add it as a build variable and redeploy. |
| Deploy succeeds but the catalogue is stale | Image not rebuilt | Catalogue changes ship as code ([ADR-001](docs/decisions/ADR-001-tech-stack.md)). Every product edit needs a redeploy. |

---

## 8. Building the image by hand

Useful for reproducing a failure locally. This is exactly what Coolify runs.

```bash
docker build \
  --build-arg APP_BASE_URL=https://www.morchadigems.com \
  --build-arg NEXT_PUBLIC_BASE_URL=https://www.morchadigems.com \
  -t morchadi-gems .

docker run --rm -p 3000:3000 \
  -e APP_BASE_URL=https://www.morchadigems.com \
  -e CASHFREE_ENV=sandbox \
  -e CASHFREE_APP_ID=... \
  -e CASHFREE_SECRET_KEY=... \
  morchadi-gems
```

Resulting image is roughly 310 MB. Local development is unaffected by any of this —
`npm run dev` behaves exactly as before.
