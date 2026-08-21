# ADR-049: The 21 Next.js advisories, re-triaged against an app that now has middleware — and the scope of the upgrade that would clear them

- **Status:** Accepted
- **Date:** 2026-08-21
- **Prompt:** 57

## Context

[ADR-030](ADR-030-dependency-security-bump.md) fixed everything fixable inside its major and
left one finding standing: `next@14.2.35`, carrying 21 advisories, none of which has a 14.x
patch. It closed by naming the conditions that would force a revisit — *"any advisory reaching
the routes that **are** exposed, or the owner's decision on 15.5.23."*

The first condition has been met, and not by a new advisory. It was met by this repository.

ADR-030's exposure triage rests on one sentence: *"This application has **no middleware**, no
custom server, no rewrites, no redirects, no custom headers, no `remotePatterns`, no i18n, no
Server Actions, no `next/script beforeInteractive`, no CSP nonces and no WebSocket upgrades."*
That was true on 2026-08-18. Eleven prompts later it is not. [ADR-041](ADR-041-admin-subdomain-and-auth.md)
added `middleware.ts`, and it is not incidental middleware — it is the only thing standing
between `admin.morchadigems.com` and the storefront, and it issues redirects on two paths.
[ADR-034](ADR-034-seo-audit-remediation.md) added custom headers. The application also acquired
an authenticated operator, order rows and admin sessions, so "what is at stake" changed at the
same time as "what is reachable".

An advisory list re-read against a stale premise is worse than no list. This record re-runs the
triage against the application as it stands, and prices the upgrade that would end it.

**Nothing here changes a dependency version or a line of code.** This is the assessment
[ADR-030](ADR-030-dependency-security-bump.md) deferred to the owner, and the accompanying build-log
row is the only other artefact.

### What `npm audit` reports today

`npm audit` and `npm audit --omit=dev` return **identical output**: 5 high-severity findings
across two independent chains.

| Chain | Root | Advisories | Offered fix |
| --- | --- | --- | --- |
| `next` | direct dependency, `14.2.35` | 21 | `next@16.3.2` — two majors |
| `prisma → @prisma/config → {deepmerge-ts, effect}` | direct dependency, `6.19.2` | 2 | `prisma@6.12.0` — a downgrade |

The `postcss` and `glob` overrides ADR-030 installed are still holding; neither package appears.

## Decision

**Defer the Next.js major upgrade for roughly four to six weeks, conditional on three
Cloudflare and VPS facts being verified within the next week. Reject the offered Prisma fix
outright. Take neither advisory chain on trust from its severity rating.**

The reasoning is below, and the conditions are binding: if any of the three checks in
[Timing](#timing-and-the-conditions-attached-to-it) comes back the wrong way, the upgrade stops
being a deferrable chore.

---

## Part 1 — the 21 Next.js advisories, by whether this application can reach them

Every row was decided by reading the advisory's own stated preconditions and then checking this
repository against them. Where a check could be run rather than reasoned, it was run against a
real `next start` on the production build; those rows say so.

### Not reachable — 13 advisories

| Advisory | Severity | Why this application cannot reach it |
| --- | --- | --- |
| [GHSA-36qx-fr4f-26g5](https://github.com/advisories/GHSA-36qx-fr4f-26g5) — Middleware/Proxy bypass with i18n | high 7.5 | Pages Router **and** i18n are both required. This app is App Router only — there is no `pages/` directory — and `next.config.mjs` declares no `i18n` block |
| [GHSA-89xv-2m56-2m9x](https://github.com/advisories/GHSA-89xv-2m56-2m9x) — SSRF in Server Actions on custom servers | high | Requires both a Server Action and a custom server. There is no `"use server"` anywhere in the tree, and `output: "standalone"` runs Next's own `server.js`, which is not a custom server |
| [GHSA-m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) — DoS in App Router Server Actions | high | The advisory disposes of itself: *"Applications using Pages Router or not using Server Actions are not vulnerable."* |
| [GHSA-4c39-4ccg-62r3](https://github.com/advisories/GHSA-4c39-4ccg-62r3) — Unbounded Server Action payload, Edge runtime | moderate 6.3 | Requires *"at least one Server Action … if that Server Action uses the Edge runtime."* There are none. Every route handler pins `runtime = "nodejs"` |
| [GHSA-955p-x3mx-jcvp](https://github.com/advisories/GHSA-955p-x3mx-jcvp) — Disclosure of internal Server Function endpoints | moderate | What leaks is Server Action ids out of client chunks. With no `"use server"` and no `use cache`, there are no ids to enumerate |
| [GHSA-p9j2-gv94-2wf4](https://github.com/advisories/GHSA-p9j2-gv94-2wf4) — SSRF in rewrites via attacker-controlled hostname | high | Requires a `next.config.js` `rewrites()`/`redirects()` whose **external destination hostname** is built from a dynamic segment or a `has` capture. `next.config.mjs` declares neither. The advisory states the exclusion directly: middleware rewrites to same-origin paths are not affected, which is the only rewrite this app performs |
| [GHSA-ggv3-7p47-pfv8](https://github.com/advisories/GHSA-ggv3-7p47-pfv8) — HTTP request smuggling in rewrites | moderate | The smuggled request escapes to *"unintended backend routes"* past a rewrite that proxies to a backend. This app configures no rewrites and proxies to no backend; `NextResponse.rewrite` targets a path inside the same process |
| [GHSA-c4j6-fc7j-m34r](https://github.com/advisories/GHSA-c4j6-fc7j-m34r) — SSRF via WebSocket upgrades | high 8.6 | Requires the app to handle WebSocket upgrades. Nothing in the tree opens, accepts or proxies a socket |
| [GHSA-gx5p-jg67-6x7h](https://github.com/advisories/GHSA-gx5p-jg67-6x7h) — XSS in `beforeInteractive` scripts | moderate 6.1 | The one `next/script` in the codebase is `components/GoogleAnalytics.tsx`, and it is deliberately `afterInteractive` — the reason is written in the file. Its only interpolated value is `NEXT_PUBLIC_GA_MEASUREMENT_ID`, inlined at build time, never request input |
| [GHSA-ffhc-5mcf-pf4q](https://github.com/advisories/GHSA-ffhc-5mcf-pf4q) — XSS in App Router apps using CSP nonces | moderate 4.7 | Requires an app that *"relies on CSP nonces."* `config/security-headers.mjs` deliberately does not: it allows `script-src 'unsafe-inline'` precisely so that no per-request nonce is generated, and the trade-off is argued in the file. The decision to skip nonces, taken for prerendering reasons, incidentally removes this advisory's precondition |
| [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) — Image Optimizer DoS via `remotePatterns` | moderate 5.9 | No `images` block, so `remotePatterns` is empty. **Verified against the running production server:** `/_next/image?url=https%3A%2F%2Fexample.com%2Fa.jpg` returns **400** |
| [GHSA-68g3-v927-f742](https://github.com/advisories/GHSA-68g3-v927-f742) — Cache confusion of response bodies | moderate | Triggered by the specific shape `fetch(new Request(init), aDifferentInit)`. `new Request(` appears in this repository **only inside test files** — never in `app/`, `lib/` or `components/`. The two server-side fetches, in `app/api/create-order/route.ts` and `lib/cashfree-order.ts`, are plain `fetch(url, init)` with `cache: "no-store"` |
| [GHSA-4633-3j49-mh5q](https://github.com/advisories/GHSA-4633-3j49-mh5q) — Cache confusion on invalid UTF-8 bodies | moderate | Same precondition, same finding |

Two of these deserve a note rather than a row. `GHSA-ffhc-5mcf-pf4q` and `GHSA-9g9p-9gw9-jx7f`
are unreachable because of choices made for entirely unrelated reasons — prerendering economics
and the fact that every photograph is local. They are not defences, and they would stop being
true the day someone adds a nonce or a remote image host. Both should be re-checked, not
assumed, if either changes.

### Probably not reachable, and the reason is worth recording — 3 advisories

| Advisory | Severity |
| --- | --- |
| [GHSA-q4gf-8mx6-v5v3](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3) — DoS with Server Components | high 7.5 |
| [GHSA-8h8q-6873-q5fj](https://github.com/advisories/GHSA-8h8q-6873-q5fj) — DoS with Server Components | high 7.5 |
| [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) — HTTP request deserialization DoS | high 7.5 |

These three are the ones ADR-030 listed as *not* ruled out, on the reasoning that they *"apply
to any App Router application serving Server Components — which this is, on every route."*
That reasoning was cautious and defensible, and it is probably too pessimistic.

All three describe a request *"sent to any App Router Server Function endpoint that, when
deserialized, may trigger excessive CPU usage."* The load-bearing word is **deserialized**. So
the question is not whether this app serves Server Components — it does — but whether an
outsider can get Next to deserialize a Server Function payload when the app defines no Server
Functions. That was tested rather than argued:

- `POST /` carrying `Next-Action: 0000…0000` returns **200**, and the server logs
  `Failed to find Server Action "0000…0000"`. The endpoint is live; a bogus action id is not
  rejected at the router.
- But the body is never read. A **2 MB** body, a malformed body, an empty body and a multipart
  body all complete in **23–32 ms**, indistinguishable from one another. Next resolves the
  action id against its manifest and gives up *before* touching the payload.

With no `"use server"` in the tree there is no id that survives that lookup, so the deserializer
has no reachable entry point. This is evidence, not proof: it is one probe against 14.2.35, it
cannot see paths the manifest lookup does not guard, and a single Server Action added anywhere in
this codebase would invalidate it along with four of the rows in the table above. **Adding a
Server Action to this application before the upgrade lands should be treated as a change that
re-opens this ADR.**

### Reachable, gated entirely on Cloudflare configuration — 3 advisories

This is the section that did not exist in ADR-030, and it is the reason this record was written.

| Advisory | Severity |
| --- | --- |
| [GHSA-3g8h-86w9-wvmq](https://github.com/advisories/GHSA-3g8h-86w9-wvmq) — Middleware/Proxy redirects can be cache-poisoned | low 3.7 |
| [GHSA-wfc6-r584-vfw7](https://github.com/advisories/GHSA-wfc6-r584-vfw7) — Cache poisoning in RSC responses | moderate 5.4 |
| [GHSA-vfv6-92ff-j949](https://github.com/advisories/GHSA-vfv6-92ff-j949) — Cache poisoning via `_rsc` collisions | low 3.7 |

**The middleware half reproduces exactly.** `GHSA-3g8h-86w9-wvmq` requires three things: an app
that redirects from middleware, a caching CDN in front of it, and 3xx responses cacheable on
those paths. This app has the first two. Against the production server, injecting the header the
advisory names collapses both of this deployment's redirect paths:

```
GET /admin/orders          Host: morchadigems.com        → 307, location: http://morchadigems.com/
GET /admin/orders  + x-nextjs-data: 1                    → 307, x-nextjs-redirect: http://morchadigems.com/   (no Location)

GET /orders                Host: admin.morchadigems.com  → 307, location: http://admin.morchadigems.com/login
GET /orders        + x-nextjs-data: 1                    → 307, x-nextjs-redirect: http://admin.morchadigems.com/login   (no Location)
```

A browser handed the second form gets a 307 with nowhere to go. Both of ADR-041's redirects — the
storefront's `/admin/*` → `/` and the panel's unauthenticated → `/login` — are affected, and
neither response carries any `Cache-Control` at all, so whether it is ever cached is decided
entirely by the CDN's defaults.

**Cloudflare's defaults are what stop it, and only just.** Two independent facts, both from
Cloudflare's own documentation:

1. Cloudflare's default cacheable status codes are 200, 206, 301, 302, 303, 404 and 410.
   **307 is not among them** — and `middleware.ts`'s `temporaryRedirect` hardcodes 307.
2. *"The Cloudflare CDN does not cache HTML or JSON by default"*, and caching is decided by
   file extension. Both redirect targets are extensionless paths.

So the origin is vulnerable and the edge declines to cache the poison. That is a real mitigation
and it is also a coincidence — nobody chose 307 to defeat a cache-poisoning advisory.

**The RSC half is the same shape and the stakes are higher.** Every statically prerendered page
in this application — 49 product pages, the policy pages, `/about` — is served with:

```
Cache-Control: s-maxage=31536000, stale-while-revalidate
Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding
```

`s-maxage=31536000` is an instruction addressed specifically to shared caches: hold this for a
year. And the same URL returns two different documents depending on one request header —
`/about` answers `text/html` normally and `text/x-component` when asked with `RSC: 1`. Verified
on the production build for `/about` and `/product/P043`.

That is precisely the condition `GHSA-wfc6-r584-vfw7` names: *"an attacker can cause an RSC
response to be served from the original URL and poison shared cache entries so later visitors
receive component payloads instead of the expected HTML."* The advisory's own workaround is
*"ensure your CDN or reverse proxy keys on the relevant RSC request headers and honors `Vary`"* —
and Cloudflare does **not** honour arbitrary `Vary` headers by default; varying on anything
beyond `Accept-Encoding` has to be configured explicitly in a Cache Rule.

**The whole thing therefore turns on one dashboard setting this repository cannot read.** Today
Cloudflare does not cache HTML, so the year-long `s-maxage` is shouted into a void and these
three advisories are latent. The day somebody enables a "Cache Everything" rule on the
storefront — an ordinary, well-meaning TTFB optimisation for a shop that is mostly static
pages — all three become live simultaneously, against a cache told to hold the poisoned entry
for a year, with no `Vary` partitioning to save it. The failure mode is every product page
serving a raw React Server Component payload to shoppers.

This is the single most important finding in this record, and it is an operational constraint
rather than a code defect: **until Next.js is upgraded, "Cache Everything" must not be enabled
for `morchadigems.com`.** It belongs in `DEPLOY.md` beside the existing Cloudflare guidance on
SSL mode and Rocket Loader, and adding it there is the first item of the follow-up prompt.

### Reachable today, no configuration required — 2 advisories

| Advisory | Severity |
| --- | --- |
| [GHSA-h64f-5h5j-jqjh](https://github.com/advisories/GHSA-h64f-5h5j-jqjh) — DoS in the Image Optimization API | moderate 5.9 |
| [GHSA-3x4c-7xq6-9pq8](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8) — Unbounded `next/image` disk cache growth | moderate |

These two need no CDN misconfiguration, no Server Action and no attacker-controlled hostname.
They need `next/image`, a default loader and self-hosting, which is exactly what
[ADR-032](ADR-032-coolify-docker-deploy.md) and [ADR-006](ADR-006-product-image-convention.md)
built. Nine components render `next/image`; 68 image files sit under `public/`.

**The memory advisory is real but small here.** `GHSA-h64f-5h5j-jqjh` is that the optimizer
*"fetches local images entirely into memory without enforcing a maximum size limit."* The
mitigating fact is the catalogue itself: the largest asset in `public/` is
`products/P043.webp` at **234 KB**, and `logo.png` at 145 KB. There is no large local file to
point the optimizer at, so the unbounded read is bounded by the repository. What is not bounded
is the decode — P043 is 1535×1920, and re-encoding it at `w=3840&q=100` produced a **1.36 MB**
JPEG from a 234 KB source. That is CPU and transient RSS per request, on a single-container VPS,
with no CDN in front of it: `/_next/image` is an extensionless path, so Cloudflare's
extension-based default does not cache it, and Next asks for only `max-age=60, must-revalidate`
anyway. Every optimizer request reaches the origin.

**The disk advisory is the more concrete one, and it was measured.** `GHSA-3x4c-7xq6-9pq8` is
that *"an attacker could generate many unique image-optimization variants and exhaust disk
space."* Against the production server:

- Width is validated against `deviceSizes` + `imageSizes`. Exactly **16 widths** are accepted
  (16 through 3840); `w=999` returns 400.
- Quality is not meaningfully constrained. **`q=1` through `q=100` all return 200**, each
  producing a distinct cache entry; `q=101` returns 400.
- 48 distinct variants of one image occupied **13 MB** of `.next/cache/images`.

16 widths × 100 qualities × 68 images is **108,800 reachable cache entries**, each one a plain
unauthenticated `GET`. The 13 MB / 48 sample skews large — it was weighted toward wide variants —
but even a conservative average puts the full variant space in the **several-gigabyte to
tens-of-gigabytes** range.

Where that lands matters more than the number. The container declares no volume, so
`.next/cache/images` is the container's writable layer, which is disk on the Hostinger VPS — the
same disk carrying the Postgres volume. Filling it does not politely degrade image optimisation;
it takes the database with it, and with the database go order capture, the admin panel and
`/api/health`. [ADR-048](ADR-048-database-health-and-failure-surfaces.md) decided how each
surface behaves when Postgres is gone; this is a way to make Postgres gone, from outside, with
`curl`.

**These two are the genuine near-term risk, and they are also the two with the cheapest
non-upgrade mitigations** — see [Consequences](#consequences).

### Summary

| Verdict | Count | Advisories |
| --- | --- | --- |
| Not reachable | 13 | i18n bypass, both rewrite advisories, both SSRF-in-Server-Actions, WebSocket SSRF, Server Action DoS and payload, Server Function disclosure, both XSS, `remotePatterns` DoS, both cache-confusion |
| Probably not reachable — tested, not proven | 3 | the two Server Components DoS, the deserialization DoS |
| Reachable only if Cloudflare caches HTML | 3 | middleware redirect poisoning, RSC response poisoning, `_rsc` collisions |
| Reachable today | 2 | Image Optimization API DoS, `next/image` disk cache growth |

**No advisory among the 21 threatens confidentiality or price integrity.** None reaches
`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` or `DATABASE_URL` — all three stay inside route
handlers and `server-only` modules. None touches server-side price validation, which reads
`data/products.json` at request time and never trusts a client total. None exposes an order row
or an admin session; the database-backed check in `app/admin/(protected)/layout.tsx` is
unaffected by every one of them. What is at stake across the whole list is **availability and
cache correctness on a public storefront**, which is why the recommendation below is "soon" and
not "tonight".

---

## Part 2 — the Prisma chain, and why the offered fix is worse than the finding

`npm audit` proposes `prisma@6.12.0`, marked a breaking change, to clear two advisories:
[GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) (stack exhaustion in
`deepmerge-ts` on recursive object graphs) and
[GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g) (`AsyncLocalStorage`
contamination in `effect` under concurrent RPC load). Four things were checked before forming a
view, and each one moved the answer further from "take the fix".

**1. The chain hangs off the CLI, not the client.** `npm ls` gives one path and one only:
`prisma@6.19.2 → @prisma/config@6.19.2 → {deepmerge-ts@7.1.5, effect@3.18.4}`. `@prisma/client`
does not depend on `@prisma/config`. Nothing in `app/`, `lib/`, `components/` or `scripts/`
imports `prisma` or `@prisma/config`.

**2. None of it ships.** This is the decisive point, and it was verified rather than reasoned:
a full `npm run build` was run and `.next/standalone/node_modules` inspected. `@prisma/client`
and `.prisma` are present — as [ADR-047](ADR-047-prisma-generate-in-docker-build.md) established
they must be. **`prisma`, `@prisma/config`, `deepmerge-ts` and `effect` are all absent.** Next's
build trace follows imports from `server.js`, the CLI is imported by nothing, and so the
vulnerable packages never enter the runner stage of the image. They exist on a developer's
machine and inside the builder stage, and nowhere else.

`npm audit --omit=dev` reports them anyway, and it is not wrong to — it reports the dependency
graph, and `prisma` is declared in `dependencies`. It simply is not reporting the shipped
artefact, and the two are not the same thing here.

**3. What is left is a CLI run twice, on trusted input.** `prisma generate` runs once per image
build (ADR-047), and `prisma migrate` runs when a developer types it. Both advisories are
runtime-behaviour bugs — a recursive merge blowing the stack, async context lost under
concurrent RPC. There is no untrusted input and no concurrency in either invocation. The
realistic exploitability is nil.

**4. The offered fix creates a version skew Prisma does not support.** `npm audit fix --force`
moves `prisma` to 6.12.0 — whose `@prisma/config@6.12.0` sits below the vulnerable
`>=6.13.0-dev.1` floor — and **leaves `@prisma/client` at 6.19.2**. That pairing was built in a
scratch directory with this repository's real `prisma/schema.prisma`:

- `prisma generate` **succeeds**, and `prisma-client-js` is fully supported in 6.12.0. The
  schema needs nothing newer — `provider = "prisma-client-js"`, `Decimal(10, 2)`, enums and
  `@map` are all long-settled features. The ADR-047 Docker step would still work.
- But the output announces itself: `Generated Prisma Client (v6.12.0) to ./node_modules/@prisma/client`.
  The 6.12.0 CLI overwrites the 6.19.2 package's generated portion.
- The emitted client then does `require('@prisma/client/runtime/library.js')` — a **v6.12.0
  client loading the v6.19.2 runtime**, alongside a v6.12.0 query engine from
  `@prisma/engines@6.12.0`.
- It smoke-tests clean: `OrderStatus` and `PaymentType` export correctly, `index.d.ts` carries
  all the types ADR-047 needs, and `new PrismaClient()` instantiates, reporting
  `_clientVersion = 6.12.0`.

Clean smoke test, unsupported configuration. Prisma requires the CLI and the client at the same
version, and engine/runtime skew is a well-known failure class that does not necessarily show up
until a query runs against a real database. **Trading a nil-exploitability build-time advisory
for a version-skewed data layer on the deployment's only source of order truth is a bad trade.**

**Decision: reject `prisma@6.12.0`. Do not downgrade.** If these advisories are ever to be
cleared, the supported move is `prisma` **and** `@prisma/client` together — forward to a
`@prisma/config` past the fix, not backward to 6.12.0 — and that is a Prisma-version prompt of
its own, not a footnote to this one.

**One free, honest improvement is available and is recommended for the follow-up prompt:**
`prisma` is currently declared in `dependencies`. It is a build-time CLI that provably does not
ship. Moving it to `devDependencies` would make `npm audit --omit=dev` describe the artefact
that actually runs in production, and the Dockerfile is unaffected because its deps stage runs a
full `npm ci` with dev dependencies included — deliberately, and the reason is already commented
there. This is reporting hygiene, not a security fix, and it should be labelled as such.

**One caveat that must travel with it:** ADR-047 left `prisma migrate deploy` outstanding as its
second build step. If a later prompt puts that command in the container's entrypoint, the CLI
*would* need to be in the runner image, this analysis inverts, and both the `devDependencies`
move and the "none of it ships" finding above have to be re-derived.

---

## Part 3 — what upgrading Next.js would actually cost

### Go to 15.5.23, not 16.3.2

`npm audit fix --force` offers `next@16.3.2`. That is two majors, and it is more than the
advisories require.

Reading the per-advisory floors rather than npm's union: the highest patched floor across all 21
is **15.5.21**. The `backport` dist-tag points at **15.5.23**, which exists and clears every one
of them. `next-14` still points at `14.2.35` — there is, as ADR-030 found, no 14.2.36 and there
never will be.

One major buys the entire security outcome. The second major buys Turbopack, the `proxy`
rename and a pile of `next/image` default-hardening, and costs a second round of breaking
changes. **These should be two prompts, in that order**, and only the first is
security-motivated.

Worth noting on the way past: Next 16's defaults would independently kill one of the two
reachable advisories. `images.qualities` defaults to `[75]` in 16, collapsing the 100-quality
variant space measured above to one; `minimumCacheTTL` rises from 60 s to 4 hours; and `16`
leaves the default `imageSizes`. No component in this repository passes a `quality` prop, so all
three defaults would apply cleanly with no code change.

### React is the open question, and ADR-030 was half right

ADR-030 recorded that *"both 15.5.23 and 16.3.1 declare `react: "^18.2.0 || ^19.0.0"`, so React
18.3.1 already satisfies the peer range and would not have to move."* The peer range is quoted
correctly — `npm view next@16.3.2 peerDependencies` confirms `^18.2.0 || 19.0.0-rc-… || ^19.0.0`
today. npm will not block the install.

But the official upgrade guide is unambiguous in the other direction: *"The minimum versions of
`react` and `react-dom` is now 19."* The permissive peer range exists for Pages Router
applications; the App Router in 15 and 16 is built against React 19 semantics, and Next 16's App
Router tracks a React 19.2 canary. This application is App Router on every route.

**Budget for React 18.3.1 → 19.x as part of the upgrade**, along with `@types/react` and
`@types/react-dom`. Trying React 18 first is cheap and worth ten minutes, but it should not be
the plan.

### Files this codebase would actually have to touch

Counted against the tree, not estimated from the guide.

**14 – 15, the async request APIs.** `cookies()`, `headers()`, `params` and `searchParams` all
become Promises. **14 source files**:

| File | What changes |
| --- | --- |
| `app/(storefront)/product/[id]/page.tsx` | `params` — page + `generateMetadata`; `ProductPageProps` becomes Promise-typed |
| `app/(storefront)/shop/page.tsx` | `searchParams` — page + `generateMetadata`; `ShopPageProps` becomes Promise-typed |
| `app/(storefront)/track/page.tsx` | `searchParams` **and** `headers()`; `TrackOrderPageProps` becomes Promise-typed |
| `app/admin/(protected)/layout.tsx` | `headers()` |
| `app/admin/(protected)/page.tsx` | `headers()` |
| `app/admin/(protected)/orders/page.tsx` | `searchParams` + `headers()` |
| `app/admin/(protected)/orders/[id]/page.tsx` | `params` — page + `generateMetadata` — + `headers()` |
| `app/admin/login/page.tsx` | `headers()` |
| `app/admin/not-found.tsx` | `headers()` |
| `app/admin/api/orders/[id]/address/route.ts` | `params` |
| `app/admin/api/orders/[id]/receipt/route.ts` | `params` |
| `app/admin/api/orders/[id]/status/route.ts` | `params` |
| `lib/admin-session.ts` | `cookies()` and `headers()` |
| `lib/admin-routing.ts` | the callback contract below |

The codemod handles most of it. The one place it will not is the pattern this codebase uses
seven times: `resolveRequestHostname((name) => headers().get(name))`. `resolveRequestHostname`
takes a **synchronous** header-reader by design — `lib/admin-routing.ts` says so in a comment,
because middleware has a `NextRequest` and a Server Component has `headers()`, and the callback
is what lets one function serve both. Once `headers()` is async, every call site must hoist it
(`const requestHeaders = await headers()`) before constructing the callback. That is a small,
mechanical edit repeated seven times, and it leaves the `admin-routing` contract intact — which
is the good outcome, and worth confirming early rather than discovering late.

Two things this codebase gets for free, both because earlier prompts were explicit:

- **`fetch` is no longer cached by default in 15.** Both server-side fetches already pass
  `cache: "no-store"` explicitly. No change, no behaviour drift.
- **Route Handler `GET` is no longer cached by default in 15.** All nine route handlers already
  pin `dynamic = "force-dynamic"` or, for `admin/robots.txt`, `force-static`. No change.

Neither was luck; both are ADR-042 and ADR-044 conventions doing their job across a major
version.

**15 – 16, the structural ones.** Beyond finishing the async migration (16 removes the
synchronous escape hatch entirely):

| Change | Impact here |
| --- | --- |
| **`middleware.ts` → `proxy.ts`** | Architecturally the largest item, and not a rename. `proxy` runs on **Node, and the Edge runtime is not supported in it**. `middleware.ts`'s own documentation, `CLAUDE.md`, `ADR-041` and `docs/api/admin-orders-id-status.md` all rest on *"Middleware runs on the Edge runtime, which has no database driver, so all it can see is whether a cookie is present."* Under `proxy` that premise is false, and the cheap-gate-then-authoritative-check ordering ADR-041 mandates becomes a deliberate choice rather than a platform constraint. Keeping the deprecated `middleware.ts` preserves Edge and defers this; either way it needs an ADR, not a codemod |
| **`next lint` removed** | `npm run lint` is `next lint` and would break. `.eslintrc.json` (`next/core-web-vitals`, `next/typescript`) must migrate to flat config; `next build` stops linting |
| **Turbopack by default** for `dev` and `build` | No custom webpack config here, so this should be clean — but it is a new bundler for the production build and the standalone trace, and ADR-047 already showed that this image's `node_modules` behaves differently from a developer's. Re-verify `.next/standalone` contents after the first Turbopack build |
| `scroll-behavior` override dropped | `app/globals.css:8` sets `scroll-behavior: smooth` globally, for the hero's anchor CTA (ADR-007). Restoring current navigation behaviour needs `data-scroll-behavior="smooth"` on `<html>` in `app/layout.tsx` |
| Node 20.9+, TypeScript 5.1+ | Both already satisfied — `node:20-alpine`, `typescript@^5` |
| `serverRuntimeConfig` / AMP / `devIndicators` / PPR flags removed | None used |
| Parallel-route `default.js` required | No parallel routes |

**Tests.** 75 test files, 1261 tests. **10 would need edits** — five construct route-handler
contexts as `{ params: { id } }` and would need Promise-wrapped params
(`admin-order-action-routes`, `admin-order-database-failure`, `admin-page-database-failure`,
`no-fabricated-reviews`, `product-seo`); seven mock `next/headers` and would need async mocks
(the first three above plus `admin-layout-shell`, `admin-orders-access`, `order-tracking-page`,
`tracking-database-failure`); three exercise middleware (`admin-routing` plus two already
counted).

**Config and docs.** `package.json`, `next.config.mjs`, `.eslintrc.json` → `eslint.config.mjs`,
`Dockerfile`, `app/layout.tsx`. Then `CLAUDE.md`, `ADR-041`, `docs/PROJECT-STATE.md`,
`docs/api/admin-orders-id-status.md` and `DEPLOY.md`, all of which currently assert the Edge
premise.

### Scope estimate

| Step | Files | Risk |
| --- | --- | --- |
| **14.2.35 → 15.5.23** — clears all 21 advisories | ~14 source + 10 test + 3 config + React 19 | **Moderate.** Almost entirely mechanical and codemod-assisted. The one judgement call is the `resolveRequestHostname` callback hoist. Highest-risk surface is the admin panel, where every `headers()`/`cookies()` call lives — and it is the surface with the best test coverage |
| **15.5.23 → 16.3.2** — no security benefit; Turbopack, `proxy`, image hardening | ~5 config + `middleware.ts` → `proxy.ts` + 5 docs + a new ADR | **Higher, and differently shaped.** Few files, but one of them re-decides an ADR-041 premise, and Turbopack changes how the production image is built |

Roughly **30 files across both steps**, of which about 24 are mechanical. The genuine
decision content is two items: whether React 19 lands with step one, and what happens to the
Edge/Node premise in step two.

---

## Timing, and the conditions attached to it

**Deferring the upgrade by four to six weeks is acceptable, because:**

- Nothing in the 21 threatens confidentiality, credentials, order data, admin sessions or price
  integrity. The `server-only` boundary and server-side price validation are untouched by every
  one of them.
- 13 of 21 are structurally unreachable, and 3 more are unreachable for a reason that was tested.
- The 3 cache-poisoning advisories are latent behind a Cloudflare default that currently holds.
- The 2 that are live are availability problems, and both have same-day mitigations that need no
  version bump.
- Doing it properly means React 19 and an ADR-041 re-reading. Rushing that into the same window
  as ADR-047's outstanding `prisma migrate deploy` work is how a deployment acquires two
  half-finished migrations at once.

**It should be prioritised immediately — not in four weeks — if any of these turns out to be
true.** All three are dashboard or shell checks that this repository cannot perform, and they
are the blocking external items of this assessment:

1. **A Cloudflare Cache Rule caches storefront HTML** ("Cache Everything", or any rule making
   extensionless paths cacheable). This flips three advisories live at once against a
   year-long `s-maxage`, and it is the highest-consequence finding here.
2. **A Cloudflare rule adds 307 to cacheable status codes**, or the middleware redirects are
   changed to 301/302/303 — either of which lands them inside Cloudflare's default cacheable
   set and makes the reproduced `x-nextjs-data` poisoning exploitable.
3. **VPS disk headroom is small, or unmonitored.** The image cache can reach the gigabyte range
   on unauthenticated `GET`s alone, and it shares a disk with the Postgres volume.

**And immediately, regardless of the above, if a Server Action is added to this codebase** — that
single change re-opens four "not reachable" rows and all three "probably not reachable" rows.

## Alternatives considered

**`npm audit fix --force`.** Installs `next@16.3.2` and `prisma@6.12.0` in one unreviewed step:
two majors forward on the framework and seven minors backward on the data layer, the latter into
a version skew with `@prisma/client`. Rejected on both halves.

**Upgrade to 16.3.2 now, in one move.** Fixes everything and lands Turbopack and the `proxy`
rename in the same change as the security fix, so a rollback for a Turbopack build problem is
also a rollback of the security fix. Rejected in favour of splitting at 15.5.23, where the
security outcome is complete and the blast radius is smaller.

**Upgrade to 15.5.23 immediately, this week.** Genuinely defensible, and the reason it was not
chosen is sequencing rather than risk appetite: ADR-047's second build step is still outstanding,
and the two reachable advisories have mitigations that cost hours instead of days. If the
Cloudflare checks come back badly, this becomes the decision.

**Mitigate at Cloudflare and never upgrade.** A WAF rate-limit on `/_next/image` and a rule
stripping `x-nextjs-data` would blunt everything currently reachable. Rejected as a destination —
it leaves the app on a framework major that receives no security patches at all, so the next
advisory has no answer — but the first half of it is worth doing anyway as interim cover.

**Silence the finding** with `--omit=dev` or an audit-level threshold. Rejected for the same
reason ADR-030 rejected it: the finding is real, and `--omit=dev` does not even change the output
here.

## Consequences

`npm audit` keeps reporting 5 high-severity findings. That number is now backed by a triage
that says which 2 of 21 actually matter, and it should not be read as "5 problems".

**Three interim mitigations are available before any version changes, and they are the follow-up
prompt's job:**

1. A `DEPLOY.md` Cloudflare note — do not enable "Cache Everything" on the storefront while on
   Next 14, and keep the middleware redirects at 307 — placed beside the existing SSL-mode and
   Rocket Loader guidance.
2. A Cloudflare rate-limit on `/_next/image`, which is currently uncached and origin-bound, and
   which caps both reachable advisories at once.
3. Disk monitoring on the VPS, or a periodic clean of `.next/cache/images` — the workaround the
   advisory itself recommends.

**What this makes easy:** the eventual upgrade prompt starts with a file list rather than a
survey, and knows the two decisions it has to make.

**What this makes hard:** the triage above is a snapshot with an expiry. It is pinned to this
tree, and three specific changes invalidate parts of it — adding a Server Action, adding a CSP
nonce, adding a remote image host. Any of them means re-reading the relevant rows rather than
trusting them.

**What would force revisiting this record:** any of the three Cloudflare/VPS conditions coming
back the wrong way; a Server Action, nonce or remote image host entering the codebase; a new
advisory landing on a surface listed as reachable; or the owner deciding to take 15.5.23 sooner.
ADR-030 closed by naming what would force a revisit, and this is that revisit — the same clause
is left here deliberately, for the same reason.

---

## Addendum (prompt 58) — two of the three interim mitigations are done

[Consequences](#consequences) listed three mitigations available before any version changes.
Two of them landed in the prompt immediately after this record was written, and neither touched
a dependency version or Next.js itself. The assessment above is unchanged; this notes what is no
longer outstanding.

**1. The Cloudflare trap is written down.** `DEPLOY.md` §4 gained
**"⚠️ Do not enable Cache Everything on this site"**, beside the existing SSL-mode and Rocket
Loader guidance. It states the mechanism rather than only the rule — that the same URL answers
`text/html` to a browser and `text/x-component` to a request carrying `RSC: 1`, that
`Vary: RSC` is what separates them, and that Cloudflare honours no `Vary` beyond
`Accept-Encoding` unless explicitly configured — because a rule whose reason is not written down
is a rule somebody switches off. It also carries the 307 constraint from
[Timing](#timing-and-the-conditions-attached-to-it), and names the upgrade as the point at which
the restriction lifts.

This closes mitigation 1 and converts external check 1 from "unknown" to "written down and
checkable". **It does not verify the current Cloudflare setting** — that is still a dashboard
the repository cannot read, and it remains an owner action.

**2. The image variant space is now bounded in configuration, not by luck.**
`next.config.mjs` declares `images: { qualities: [75] }`.

The value was not chosen for taste. `next/image` defaults to `q=75`; **no component passes a
`quality` prop** — verified across all ten render sites — and none uses `placeholder="blur"`, so
`BLUR_QUALITY = 70` never arises in production. 75 is therefore not a preference but the
complete set of values this site can emit. Confirmed against the running production build:
every one of the **379 distinct image URLs** emitted by the home page, shop, a filtered shop,
two product pages, cart, about and style-guide is `q=75`, spanning all 16 widths, and all 379
return 200 after the change.

Nothing breaks, and the reason is in Next's own loader: given one entry in `qualities`, an
absent `quality` prop resolves to the member nearest Next's default of 75 — which is 75. The
emitted URLs are byte-identical, which `lib/image-optimisation-config.test.ts` asserts by
calling Next's real `defaultLoader` rather than reimplementing the rule.

The effect on [GHSA-3x4c-7xq6-9pq8](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8), measured
above at 16 widths × 100 qualities × 68 images:

| | Reachable cache entries | Estimated ceiling at the observed 53 KB/entry |
| --- | --- | --- |
| Before | 108,800 | ~5.5 GB |
| After | 1,088 | ~56 MB |

A **99% reduction**, and more usefully a *bounded* one: the disk an unauthenticated `GET` sweep
can consume is now smaller than the container image, on a filesystem shared with the Postgres
volume. `q=90`, `q=100`, `q=1` and every other previously-accepted value now return
`400 "q" parameter (quality) of N is not allowed`.

**What this does not do.** It does not patch either image advisory —
[GHSA-h64f-5h5j-jqjh](https://github.com/advisories/GHSA-h64f-5h5j-jqjh), the per-request memory
cost of decoding and re-encoding, is untouched, because it is reachable at `q=75` like any other
quality. Only the disk-exhaustion multiplier is gone. The upgrade is still the fix, and the
[Timing](#timing-and-the-conditions-attached-to-it) conditions still stand unamended.

**Still outstanding:** mitigation 2 (a Cloudflare rate-limit on `/_next/image`, which is
uncached and origin-bound), mitigation 3 (VPS disk monitoring), and all three external checks.
Next 16 makes `qualities: [75]` its own default, so this line becomes a no-op at upgrade time
rather than something to unwind.
