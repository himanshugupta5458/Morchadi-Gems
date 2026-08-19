# ADR-032: Containerised deploy on Coolify — standalone output and a three-stage Dockerfile

- **Status:** Accepted
- **Date:** 2026-08-19
- **Prompt:** 29

## Context

[ADR-001](ADR-001-tech-stack.md) named Vercel as the host, and every deployment note written
since has assumed it: `.env.example` says "set these in the Vercel project settings", and
`.gitignore` still carries a `.vercel` entry. The owner is not deploying to Vercel. The target
is **Coolify**, self-hosted on a Hostinger VPS running Ubuntu 24.04 with Docker.

That swap changes what the platform provides. Vercel builds the app, decides how to run it,
supplies `sharp` for image optimisation, terminates TLS, and serves `public/` and
`.next/static` from its own edge. A Docker host supplies none of that. The image has to be
complete on its own, and everything Vercel did implicitly now has to be written down.

Three properties of this app decide the shape of the image:

1. **The API routes need a real Node server.** `/api/create-order`, `/api/verify-order` and
   `/api/notify-admin` all declare `export const runtime = "nodejs"` and
   `export const dynamic = "force-dynamic"`. They read `CASHFREE_SECRET_KEY`, sign requests,
   and call Cashfree server-side. A static export (`output: "export"`) cannot host them at
   all, and edge cannot run them as written.
2. **The catalogue is a file, not a database** ([ADR-001](ADR-001-tech-stack.md)). There is no
   external datastore to connect to, no migration to run on boot, and no stateful volume to
   mount. `data/products.json` is traced into the build output and travels inside the image.
   A container restart loses nothing.
3. **All imagery is local, under `public/`** ([ADR-006](ADR-006-product-image-convention.md)).
   164 files, 5.6 MB — every product photo, category tile, hero and the logo. There is no
   remote image host and no `remotePatterns` config, which means the image layer is entirely
   the container's problem.

The default `next build` output is not directly shippable: it assumes the full
`node_modules` tree sits beside it. Copying that tree into a runtime image means shipping
typescript, tailwind, eslint, vitest and the rest — hundreds of megabytes of build-only
tooling in a production image, and a correspondingly larger attack surface.

## Decision

**Set `output: "standalone"` in `next.config.mjs`, and ship a three-stage Dockerfile that
copies `public/` and `.next/static` into the runner explicitly.**

### Standalone output

`output: "standalone"` makes `next build` emit `.next/standalone/` — a minimal server at
`server.js` plus only the `node_modules` packages the build trace proves are reachable at
runtime. For this app that trace resolves to 21 packages, and it correctly pulls in
`data/products.json` and `data/testimonials.json`, so the catalogue needs no separate copy
step.

It changes nothing about how the app behaves. `next dev` ignores the setting entirely, and
the build output is otherwise identical: the same 70 prerendered pages, the same three
dynamic API routes, the same `/sitemap.xml` and `/robots.txt`, the same `next/image`
optimisation endpoint. Verified against a running container — see
[the test result](../testing/RESULT-2026-08-19-container-build.md).

### The copy gotcha, which is the whole point of the runner stage

**`.next/standalone` contains neither `public/` nor `.next/static`.** This is documented
Next.js behaviour, not a bug, and it was confirmed by inspection of a real build:

```
.next/standalone/
├── .next/        (BUILD_ID, manifests, server/ — no static/)
├── data/
├── node_modules/
├── package.json
└── server.js
```

The failure mode is nasty because it is silent and partial. The container starts, logs
`✓ Ready`, and serves HTML with a 200. Only the assets are gone: every product photo, the
CSS, and every JS chunk 404. A health check on `/` passes while the site is unusable.

So the runner stage makes three copies, not one:

```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
```

### `sharp` must stay installed at build time

`next/image` optimisation in a standalone server needs `sharp`. It is a devDependency here —
added in prompt 5 for `scripts/generate-placeholders.mjs`, with a note that it "never runs on
Vercel", because Vercel supplies its own. On Docker nothing supplies it.

Next's build trace does copy `sharp` into `.next/standalone/node_modules` when it is
installed, so a plain `npm ci` in the deps stage is enough and `package.json` needed no
change. But that makes the deps stage load-bearing in a way it does not look:
**`npm ci --omit=dev` there would produce a green build whose product photos are all broken**,
because the trace cannot copy a package that is not there. The Dockerfile says so at the line
where someone would make that edit.

Alpine resolves the musl variants (`@img/sharp-linuxmusl-x64`) from the existing lockfile, so
deps, builder and runner all sit on `node:20-alpine` with `libc6-compat` for consistency.

### `HOSTNAME=0.0.0.0`

The standalone server binds to `process.env.HOSTNAME`. Unset, it listens on localhost inside
the container's own namespace — unreachable from the host and indistinguishable from a dead
app to Coolify's proxy. The runner sets it explicitly. `PORT` defaults to 3000 and Coolify may
override it; the health check reads `${PORT}` rather than hardcoding.

### Build-time versus runtime environment

The split is not cosmetic — putting a value in the wrong place fails in a way tests do not
catch.

| Variable | When | Why |
| --- | --- | --- |
| `NEXT_PUBLIC_BASE_URL` | **Build** | Next inlines every `NEXT_PUBLIC_*` into the bundle at compile time. Setting it at runtime does nothing. |
| `NEXT_PUBLIC_WEB3FORMS_KEY` | **Build** | Same. Read by `lib/contact.ts` for a client component. Public by design ([ADR-012](ADR-012-static-and-policy-pages.md)). |
| `APP_BASE_URL` | **Build _and_ runtime** | Both. See below. |
| `CASHFREE_APP_ID` | Runtime | Server-only, read per request. |
| `CASHFREE_SECRET_KEY` | Runtime | Server-only. Never a build ARG — ARG values are readable in image history. |
| `CASHFREE_ENV` | Runtime | Server-only, selects the Cashfree API base URL. |
| `CALLMEBOT_PHONE` | Runtime | Server-only, optional ([`/api/notify-admin`](../api/notify-admin.md)). |
| `CALLMEBOT_APIKEY` | Runtime | Server-only, optional. |

`APP_BASE_URL` is the one that needs care. `lib/site-url.ts` reads it through `process.env`,
so it is genuinely runtime — but the callers that matter most run during prerendering.
`/sitemap.xml`, `/robots.txt`, every canonical tag and every schema.org `@id`
([ADR-029](ADR-029-seo-foundations.md)) are baked into static output at build time. Set it
only at runtime and the container ships a sitemap full of `http://localhost:3000`. Set it only
at build time and the Cashfree `return_url` in `/api/create-order` falls back to the request
origin. **It must be set in both places, to the same production https origin.**

Only non-secret values are passed as build ARGs. The three secrets exist nowhere in the image:
`.dockerignore` excludes `.env*` from the build context entirely, and a scan of `.next/static`
and the served HTML in a running container found no trace of injected runtime values.

## Alternatives considered

**Nixpacks (Coolify's default build pack).** Zero config — Coolify detects Next.js and builds
it. Rejected because the detection is a black box: it decides the Node version, whether dev
dependencies survive, and how the app is started, and none of that is visible in this
repository or reviewable in a diff. The `sharp` and `public/` questions above would each have
been discovered in production. A Dockerfile is 75 lines that say exactly what ships.

**Default `next build` output with the full `node_modules` copied in.** Simpler Dockerfile,
no standalone setting, no copy gotcha. Rejected on size and surface: the production image
would carry typescript, tailwind, eslint, vitest and every transitive devDependency. Standalone
traces 21 packages instead.

**`output: "export"` (fully static).** Would make hosting trivial — any static file server.
Impossible here: three Node-runtime API routes create and verify Cashfree payments. Static
export drops them, which drops checkout.

**A single-stage Dockerfile.** Rejected for the same reason as the previous: the build
toolchain and the full source tree would ship to production.

**`node:20-slim` (Debian) instead of alpine.** A defensible choice — glibc avoids the class of
native-module surprises musl is known for. Rejected because `sharp` publishes prebuilt musl
binaries and the lockfile already carries them, alpine yields a meaningfully smaller image, and
alpine is what Next's own reference Dockerfile uses. If a future native dependency has no musl
build, switching the three `FROM` lines is the whole migration.

**Moving `sharp` to `dependencies`.** Would make the runtime requirement explicit and survive an
`--omit=dev` edit. Rejected for now because it forces a lockfile regeneration for a case the
Dockerfile already handles and documents, and `sharp` genuinely is a build tool for the
placeholder generator. Revisit if the deps stage is ever changed.

## Consequences

**Easier.** The deploy is a reviewable file. Anyone can read the Dockerfile and know the Node
version, the user the process runs as, what is in the image and what is not. A rollback is a
previous image tag. The build is reproducible off the lockfile, and the same image runs
identically on the VPS, in CI, and locally — which is how the copy gotcha was caught here
rather than in production.

**Harder.** Two more files to keep true as the app changes. A new runtime asset directory
outside `public/` would need its own `COPY` line, and nothing in the test suite would catch the
omission — the gate is green today with a broken-image image, which is precisely why the
container smoke test exists. Build args are now part of the deploy contract: changing the
domain means a rebuild, not just an env edit, because the sitemap and canonicals are baked in.

**Memory during build.** `next build` here peaks around 1.5–2 GB. A small VPS with no swap can
OOM-kill it, and the symptom is an unhelpful `exit code 137` rather than a Next error. The fix
is host-side — add swap, or set `NODE_OPTIONS=--max-old-space-size` as a build variable — and
is written up in [DEPLOY.md](../../DEPLOY.md). No application behaviour was changed for it.

**What would force a revisit.** Moving to a remote image CDN would make the `public/` copy
mostly dead weight and reopen the alpine-versus-slim question. Adding a database would end the
"restart loses nothing" property and require a volume and a migration step on boot. Next 15
changes standalone tracing defaults; that upgrade should re-verify the two copy lines rather
than assume them.

This ADR does not supersede [ADR-001](ADR-001-tech-stack.md) — the stack it chose is unchanged.
It narrows one row of it: hosting is Coolify on a VPS, not Vercel.
