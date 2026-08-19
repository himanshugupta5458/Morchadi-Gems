# Test Result: Containerised production build — 2026-08-19

- **Plan:** *(no plan — deployment verification for [ADR-032](../decisions/ADR-032-coolify-docker-deploy.md))*
- **Commit:** working tree at `f431ea4` + prompt 29 changes
- **Environment:** GitHub Codespace, Docker 29.3.0, `node:20-alpine`. Cashfree credentials were
  dummy values — no payment was attempted against the container, so the checkout path is
  verified only as far as "the route runs and rejects bad input".

The image was built and run for real. Docker was available, so nothing here is review-only.

## Gate

| ID | Result | Notes |
| --- | --- | --- |
| G-01 | Pass | `npm run typecheck` — clean |
| G-02 | Pass | `npm run lint` — no ESLint warnings or errors |
| G-03 | Pass | `npm run test:run` — 653 passed, 31 files |
| G-04 | Pass | `npm run validate:products` — all checks green (9 pre-existing discount advisories, unchanged) |
| G-05 | Pass | `npm run build` — 70 static pages, 3 dynamic API routes, exit 0 |

## Standalone output

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| S-01 | `output: "standalone"` produces an entrypoint | Pass | `.next/standalone/server.js` present, 4551 bytes |
| S-02 | Build output otherwise unchanged | Pass | Same route table as before the change: 70 prerendered, `/api/*` still `ƒ`, `/sitemap.xml` and `/robots.txt` still `○` |
| S-03 | Catalogue traced into standalone | Pass | `.next/standalone/data/products.json` and `testimonials.json` present — no extra copy step needed |
| S-04 | `sharp` traced into standalone | Pass | `.next/standalone/node_modules/sharp` present despite being a devDependency |
| S-05 | **`public/` absent from standalone** | Pass (confirms the gotcha) | `.next/standalone/public` does not exist |
| S-06 | **`.next/static` absent from standalone** | Pass (confirms the gotcha) | `.next/standalone/.next/` holds `BUILD_ID`, manifests and `server/` only |
| S-07 | `npm run dev` unaffected | Pass | Dev server ready in 1.8 s; `/`, `/shop` and `/products/P001.webp` all 200 |

## Image build

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| B-01 | `docker build -t morchadi-test .` | Pass | 2 m 49 s cold, exit 0. Final image 309 MB |
| B-02 | musl `sharp` resolved on alpine | Pass | `@img/sharp-linuxmusl-x64` and `@img/sharp-libvips-linuxmusl-x64` present in the image |
| B-03 | Runs as non-root | Pass | `uid=1001(nextjs) gid=1001(nodejs)` |
| B-04 | Container boots | Pass | `✓ Ready in 85ms`, bound `0.0.0.0:3000` |
| B-05 | Dockerfile `HEALTHCHECK` | Pass | `docker inspect` reports `healthy` |

## Runtime — assets, the thing the gate cannot see

Container run on port 3010 with `APP_BASE_URL=https://www.morchadigems.com` and dummy secrets.

| ID | Path | Result | Notes |
| --- | --- | --- | --- |
| R-01 | `/` | Pass | 200 `text/html`, 299 KB |
| R-02 | `/_next/static/css/aad62706087778d0.css` | Pass | 200 `text/css`, 35 KB |
| R-03 | `/_next/static/chunks/webpack-*.js` | Pass | 200 `application/javascript` |
| R-04 | `/products/P001.webp` | Pass | 200 `image/webp`, 43 KB |
| R-05 | `/categories/anklets.webp` | Pass | 200 `image/webp` |
| R-06 | `/hero/home-hero.webp` | Pass | 200 `image/webp` |
| R-07 | `/logo.png` | Pass | 200 `image/png` |
| R-08 | `/og/default.png` | Pass | 200 `image/png` |
| R-09 | `/favicon.ico` | Pass | 200 `image/x-icon` |
| R-10 | `/_next/image?url=%2Fproducts%2FP001.webp&w=640&q=75` | Pass | 200, re-encoded — `sharp` is doing real work, not falling through |
| R-11 | `/product/P001`, `/shop` | Pass | 200, prerendered and dynamic pages both render |

## Runtime — SEO output carries the build-time origin

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| E-01 | `/sitemap.xml` | Pass | `<loc>https://www.morchadigems.com/</loc>` — the build ARG, not localhost |
| E-02 | `/robots.txt` | Pass | `Sitemap: https://www.morchadigems.com/sitemap.xml`, all six disallow rules intact |
| E-03 | Canonical tag on `/` | Pass | `https://www.morchadigems.com` |
| E-04 | JSON-LD `@id` | Pass | `https://www.morchadigems.com/#organization`, `/#website` |

This set is the evidence that `APP_BASE_URL` behaves as a **build-time** variable for
prerendered output. Passed as a build ARG only, it reached the sitemap, robots and canonicals
correctly.

## Runtime — API routes and secrets

| ID | Scenario | Result | Notes |
| --- | --- | --- | --- |
| A-01 | `POST /api/create-order` with `{}` | Pass | 400 JSON — Node-runtime route running and validating |
| A-02 | `POST /api/verify-order` | Pass | 405 — route is GET-only, correct |
| A-03 | `GET /api/verify-order` with no params | Pass | 400 JSON |
| A-04 | `POST /api/notify-admin` with `{}` | Pass | 200 `{"status":"SKIPPED_INVALID_REQUEST"}` |
| A-05 | Runtime secrets absent from client bundle | Pass | Grep for the injected dummy values across `.next/static` and `public/` in the image: 0 hits |
| A-06 | Runtime secrets absent from served HTML | Pass | 0 hits on `/` |

## Negative control — proving the copy gotcha

The same image rebuilt with the `public/` and `.next/static` `COPY` lines deleted, everything
else identical:

| Path | With the copies | Without |
| --- | --- | --- |
| `/` | 200 | **200** |
| `/_next/static/css/…css` | 200 | **404** |
| `/products/P001.webp` | 200 | **404** |
| `/logo.png` | 200 | **404** |
| `/_next/image?url=…` | 200 | **400** |

This is the failure mode described in [ADR-032](../decisions/ADR-032-coolify-docker-deploy.md):
the site returns 200 on `/` and passes any health check that only probes the root, while every
photograph, stylesheet and script is gone. It is not detectable from the build log, from the
test suite, or from an uptime monitor. The two `COPY` lines are the whole fix.

## Failures

None.

## Summary

**38 numbered checks plus a 5-path negative control — 43 in total, all as expected, 0 failures, 0 skipped.** The container is shippable to Coolify.

Two things this run does not cover and a production deploy must:

- **No real payment.** Cashfree ran with dummy credentials, so the live create-order →
  redirect → verify-order → notify-admin round trip is unverified against production Cashfree.
  [DEPLOY.md](../../DEPLOY.md) §5 makes one real order part of the deploy procedure.
- **No TLS or proxy.** Everything was tested over plain http against the container directly.
  Coolify's proxy, certificate issuance and the Cloudflare Full (strict) requirement are
  untested here; [DEPLOY.md](../../DEPLOY.md) §4 covers them.
