# ADR-030: Dependency security — what a patch bump could fix, and why Next.js was not one of them

- **Status:** Accepted
- **Date:** 2026-08-18
- **Prompt:** 30

## Context

`npm audit` reported **5 high severity vulnerabilities** across three root packages:

| Package | Path | Advisories |
| --- | --- | --- |
| `next` | direct dependency, 14.2.35 | 21 |
| `postcss` | `node_modules/next/node_modules/postcss`, 8.4.31 | 4 |
| `glob` | `@next/eslint-plugin-next` → `glob`, 10.3.10 | 1 |

The plan for this change was to bump Next.js to the latest secure 14.2.x patch. That turned
out to be impossible, and finding out why is the substance of this record.

**We were already on the last 14.x that will ever exist.** `next@14.2.35` is the terminal
release of the 14 line: it is what the `next-14` dist-tag points at, and it was published
2025-12-11 — eight months before this prompt. There is no 14.2.36.

**Every Next.js advisory is patched only in 15 or later.** Reading the per-advisory ranges
rather than the union npm prints, the lowest patched version across all 21 is **15.0.8** and
the highest floor is **15.5.21**. Not one of them has a 14.x fix. Next.js 14 is out of
security support; Vercel is backporting to 15.5.x and shipping 16.x, and 14 receives nothing.

So the instruction to stay on 14.x and the instruction to resolve the Next advisories cannot
both be satisfied. The prompt anticipated this case and said so: a fix requiring a major bump
is to be listed, not applied.

## Decision

**Fix everything fixable inside its current major. Do not touch Next.js. Escalate.**

Two of the three root packages had patches available within their existing major version, so
both were taken via scoped npm `overrides`:

```json
"overrides": {
  "next": { "postcss": "^8.5.26" },
  "@next/eslint-plugin-next": { "glob": "^10.5.0" }
}
```

`postcss` needed `>= 8.5.23` to clear all four advisories; 8.5.26 is current. The project
already had `postcss@8.5.26` at the top level as a direct devDependency — the vulnerable
8.4.31 was a second, nested copy that `next` pins exactly. The declared devDependency range
was also raised from `^8` to `^8.5.26`, so a clean install cannot resolve backwards into the
vulnerable range.

`glob` needed `>= 10.5.0`, and 10.5.0 exists inside the same major.

**Both overrides are scoped rather than global, and that is not cosmetic.** A blanket
`"glob": "^10.5.0"` would also have hit `rimraf@3.0.2`, which requires `glob@^7` and would
have broken. The scoped form leaves `rimraf/node_modules/glob@7.2.3` untouched, which was
verified in the resulting tree. A blanket `"postcss"` override is rejected outright by npm as
conflicting with a direct dependency of the same name.

**The lockfile had to be regenerated.** Adding the overrides and reinstalling left
`next/node_modules/postcss` at 8.4.31 and flagged `invalid` — npm honoured the existing
resolution rather than the new constraint. Deleting `package-lock.json` and reinstalling
resolved it and deduped postcss to a single 8.5.26 copy. The full lockfile diff is five
version changes, four of which are hoisting shuffles where the same two versions swapped
between top-level and nested positions (`@emnapi/runtime`, `aria-query`, `lru-cache`,
`react-is`). The one substantive removal is `node_modules/next/node_modules/postcss@8.4.31`,
which is precisely the target.

### Result

**5 high → 1 high.** The remaining one is `next` itself, carrying all 21 of its advisories.

### Exposure triage on the 21 that remain

An advisory count is not a risk assessment. This application has **no middleware, no custom
server, no rewrites, no redirects, no custom headers, no `remotePatterns`, no i18n, no Server
Actions, no `next/script beforeInteractive`, no CSP nonces and no WebSocket upgrades** — all
verified by grep against `app/`, `components/`, `lib/` and `next.config.mjs`, which is empty.
Both API routes pin `runtime = "nodejs"` and `dynamic = "force-dynamic"`.

That makes the majority of the 21 unreachable here, including every SSRF advisory, both
middleware/proxy advisories, both rewrite advisories, all four Server Action advisories, and
the two XSS advisories.

What is **not** ruled out, and is the honest reason this still matters:

- The **RSC cache poisoning and cache confusion** advisories, which apply to any App Router
  application serving Server Components — which this is, on every route.
- The **Server Components denial of service** advisories, same reasoning.
- The **Image Optimization API denial of service** and **unbounded `next/image` disk cache
  growth**, since `next/image` is used on nine components and the optimizer is live.

None of these expose customer data or the Cashfree credentials — the secrets stay inside
`server-only` modules and route handlers, and server-side price validation is unaffected. They
are availability and cache-correctness problems on a public storefront.

## Alternatives considered

**`npm audit fix --force`.** Installs `next@16.3.1` and `eslint-config-next@16.3.1`, two major
versions in one unreviewed step. Explicitly out of scope. Rejected.

**Upgrading to 15.5.x now.** This is the right eventual answer and is left as the owner's
decision, as instructed. Worth recording for that decision: the minimum version clearing all
21 advisories is **15.5.21**, and the `backport` dist-tag currently points at **15.5.23** —
so the smallest sufficient move is 14.2.35 → 15.5.23, not 14 → 16. Both 15.5.23 and 16.3.1
declare `react: "^18.2.0 || ^19.0.0"`, so **React 18.3.1 already satisfies the peer range and
would not have to move**. That makes the migration narrower than a Next major usually implies.

**Doing nothing at all.** Would have left the postcss and glob advisories in place when both
had free fixes. Rejected.

**Pinning `postcss` by editing `next`'s own manifest, or vendoring.** Unreproducible across
installs. Rejected in favour of `overrides`, which is the supported mechanism and lives in
version control.

## Consequences

`npm audit` will keep reporting one high-severity finding until Next.js moves off 14. That is
now a known, documented state rather than an unread warning, and it should not be silenced
with `--omit=dev` or an audit-level threshold, because it is real.

The `overrides` block is load-bearing and must survive future dependency edits. If Next is
upgraded later, the `next → postcss` override should be removed rather than carried, since a
newer Next pins a newer postcss itself and a stale override would hold it back.

The regenerated lockfile means the next `npm ci` installs the tree recorded here. The gate was
run from a cleared `node_modules` and a cleared `.next` to confirm that tree builds.

The build output is **byte-identical** to the pre-change build — same page count, same chunk
hashes, same sizes. postcss 8.4.31 → 8.5.26 changed nothing in the emitted CSS, which is the
strongest available evidence that a minor bump of the CSS pipeline was safe.

What would force revisiting this: any advisory reaching the routes that *are* exposed, or the
owner's decision on 15.5.23. Until then the position is that four of five findings are fixed,
the fifth is understood, scoped, and cannot be fixed without the major bump that was
deliberately withheld.
