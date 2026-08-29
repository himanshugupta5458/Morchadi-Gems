# Test Result: Admin product management — 2026-08-29

- **Plan:** [PLAN-admin-product-management.md](PLAN-admin-product-management.md), TC-01–TC-59
- **Commit:** working tree of prompt 109 (uncommitted). The feature — repository, rules
  extraction, routes, pages, form and 7 test files — was already on disk from an interrupted
  prior session whose Codespace shut down before it reported. This session verified that work,
  ran the manual cases it had never run (TC-50–TC-59), and wrote the documentation it was still
  missing: [ADR-064](../decisions/ADR-064-admin-product-management.md), the
  [`admin-products-id.md`](../api/admin-products-id.md) contract, the
  [ADR-048](../decisions/ADR-048-database-health-and-failure-surfaces.md) addendum, the plan
  beside this file, and the build-log row.
- **Environment:** local. Node 24, Postgres 16 via `docker-compose.yml` (already running,
  healthy). `npx vitest run` for the automated cases; `npm run validate:products` and
  `npm run build` for the gate; `npx next dev` on port 3000 driven over HTTP with `curl` for the
  manual cases, with `ADMIN_USERNAME`/`ADMIN_PASSWORD` supplied in the server process's
  environment only — no file was written and no credential was committed.

## Automated cases

| ID | Result | Notes |
| --- | --- | --- |
| TC-01 | Pass | 15 files enumerated (both route directories recursively + 12 named modules). Forbidden patterns matched as import specifiers, so the doc comments that mention `lib/products.ts` are correctly not violations |
| TC-02 | Pass | Both pages and the route each contain `productRepository` and import `@/lib/product-repository` |
| TC-03 | Pass | Only `lib/product-repository.ts` imports `node:fs/promises`; no other feature file calls `writeFile`/`rename` |
| TC-04 | **Pass — and it actually ran this time** | See "The skipped case" below. Against real production chunks: no client bundle carries a product id beside a `"cost"` key |
| TC-05 | Pass | `listProducts` returns a value written to the file behind the running repository |
| TC-10 | Pass | All 449 shipped records pass the rules the panel enforces; zero failures |
| TC-11 | Pass | The gate imports the shared module and retains **no validate function of its own**; the panel's wrapper imports the same module |
| TC-12 | Pass | 11 record-level rules, each refused with the gate's own wording |
| TC-13 | Pass | Duplicate primary keyword, duplicate meta title, duplicate id, emptied merchandising row |
| TC-14 | Pass | A pre-existing failure does not make an unrelated product uneditable |
| TC-15 | Pass | A floor breach naming no product id still blocks the save |
| TC-20 | Pass | 401, and the catalogue is never opened |
| TC-21 | Pass | A body cannot claim an identity |
| TC-22 | Pass | All six mappings: 200 `UPDATED`, 200 `UNCHANGED`, 404, 422, 409, 503 |
| TC-23 | Pass | The URL's product is edited whatever the body names |
| TC-24 | Pass | A non-JSON body is refused as an empty submission, never a 500 |
| TC-25 | Pass | Shape coerced, values passed through untouched for the real rules to judge |
| TC-30 | Pass | All 449 records survive `toProductEdit(toProductDraft(p))` unchanged, SEO block included |
| TC-31 | Pass | A blank amount becomes `NaN` → `null` → the validator's own message, not `0` |
| TC-32 | Pass | Three cases: one tab, two tabs, and a checkbox on a left tab |
| TC-33 | Pass | One `PATCH`, JSON, carrying all three tabs |
| TC-34 | Pass | The returned version is adopted, so a second consecutive save is not a false conflict |
| TC-35 | Pass | Every broken rule shown in the build's words; the operator's typed edits stay on screen |
| TC-36 | Pass | Save disabled rather than accepting an edit it would discard |
| TC-37 | Pass | Product code, provenance and photographs render as facts, not fields |
| TC-38 | Pass | Rows recomputed from the draft; a stranded variant image is dropped |
| TC-40 | Pass | 25 rows, real totals, every row linked |
| TC-41 | Pass | Tab counts match each view's real contents; category filter filters |
| TC-42 | Pass | An empty result reads as an empty catalogue view, not an error |
| TC-43 | Pass | A `draft` product opens, which the storefront would refuse |
| TC-44 | Pass | `AdminCatalogueError` on both screens, and **not** worded as a database outage |

**Full suite: 102 files, 2071 passed, 0 skipped, 0 failed** — see below.

### The skipped case — resolved, and the reason corrected

The prior session reported *2061 passed, 10 skipped*, and this session reproduced that figure
exactly on its first run (13:48). It then established what the 10 actually were, which was not
what an earlier reading of them assumed.

**All 10 are missing-build-artefact guards. None is a database guard.** The confusion is a name:
`lib/track-build-output.test.ts` declares its own `unavailableReason` meaning *this `.next` file is
not there*, which reads identically to the `unavailableReason` the admin and checkout suites use
for *no database at `DATABASE_URL`*. The 10 break down as:

| File | Sites | Guard |
| --- | --- | --- |
| `lib/track-build-output.test.ts` | 8 | a missing `.next/server/app/*.body` artefact |
| `lib/track-build-output.test.ts` | 1 | a missing `.next/standalone/…` copy |
| `lib/product-repository-boundary.test.ts` | 1 | `.next/BUILD_ID` or `.next/static/chunks` missing (TC-04) |

TC-04's guard:

```ts
const buildMissing = !existsSync(".next/BUILD_ID") || !existsSync(".next/static/chunks");
ctx.skip(buildMissing, "run `npm run build` first — this reads real build output");
```

The mechanism was confirmed directly rather than inferred: running `next dev` for the manual cases
replaced `.next` with dev artefacts and deleted `BUILD_ID` outright, which is exactly the state
that produces all 10 skips. **The gate runs vitest before `next build`, so on a clean checkout
these 10 have nothing to read.**

With a production build present, they do. The final run of this session (13:54, after the build at
13:50) reports:

```
Test Files  102 passed (102)
     Tests  2071 passed (2071)
```

**Zero skips. TC-04 executed and passed**, as did the nine `/track` build-output cases. The file
was also re-run on its own immediately after the build — `22 passed (22)`, 0 skipped — so the
margin seal of [ADR-040](../decisions/ADR-040-postgres-for-orders.md) is verified against genuine
production chunks rather than merely guarded by a case that never ran. That was the one real gap in
the prior session's green gate, and it is now closed.

Nine Postgres-guarded suites did run against the live local database throughout; none skipped.

## Manual cases

Driven over HTTP against `npx next dev` on `localhost:3000` — real middleware, real Server
Component renders, the real route handler, a real Postgres-backed session cookie. **Limitation,
stated plainly:** the requests were issued with `curl` rather than by clicking in a browser, so
React's own `onChange` and submit handlers were not exercised here. Those are covered by TC-30–TC-38
against a rendered DOM. Every request body below is the exact `{ edit, expectedVersion }` payload
`submitAdminProductEdit` sends, built by replicating `toProductEdit(toProductDraft(product))`.

| ID | Result | Notes |
| --- | --- | --- |
| TC-50 | Pass | `POST /admin/api/login` → `200 {"status":"SIGNED_IN"}`, `morchadi_admin_session` set `HttpOnly; SameSite=lax`. `GET /admin/products` → 200, 103,487 bytes, 25 distinct product links, *"Showing 1–25 of 449 · page 1 of 18"* |
| TC-51 | Pass | Page carried `version: "f4c817691c2e586e"`. Independently recomputed `sha256(JSON.stringify(P001)).slice(0,16)` in a separate Node process: **identical** |
| TC-52 | Pass | `200 {"status":"UPDATED","version":"09ed546338859774"}`. `git diff data/products.json` → **1 file changed, 1 insertion(+), 1 deletion(-)** — one line, no reordering |
| TC-53 | Pass | Same response carried `advisories: ["P001: 24 words, outside the 150-300 word house range"]`. Surfaced, attributed to P001, and **did not block** |
| TC-54 | Pass | Re-`GET` of the edit page rendered the new description, and its token was `09ed546338859774` — the exact value the save returned |
| TC-55 | Pass | `GET /product/P001` (the storefront) rendered the new description, 3 occurrences, no restart. Finding 1's dev half, confirmed live |
| TC-56 | Pass | Changing a secondary keyword moved `data/keyword-map.json` md5 `0876c812…` → `d1aeb309…`; diff shows `"alphabet ring"` → `"alphabet initial ring"` for P001, in correct sorted position |
| TC-57 | **Pass** | The lost-update case. See below |
| TC-58 | **Pass** | The runtime rule check. See below |
| TC-59 | Pass | No `data/*.tmp` at any point. After `git checkout -- data/`, both md5s returned to their committed values and `git status data/` is clean; the full `git status --short` is byte-for-byte the 32 entries it began with |

### TC-57 — two tabs, one product

Both tabs "opened" at version `09ed546338859774`.

1. **Tab B saves first** (changes a spec, `expectedVersion: 09ed546338859774`) →
   `200 UPDATED`, new token `1030bd4c136b8392`.
2. `md5sum data/products.json` → `9304ce71109f259e4d986c199306a58d`.
3. **Tab A now saves** its own unrelated edit (a meta title), still holding the stale
   `09ed546338859774`:

```
HTTP 409
{"status":"REJECTED","error":"CONCURRENT_CHANGE",
 "message":"This product changed on disk after this form was opened, so the save was refused
            rather than overwriting it. Reload the page and make the edit again.",
 "failures":[]}
```

4. `md5sum data/products.json` → `9304ce71109f259e4d986c199306a58d` — **byte-identical**.
5. Tab A's meta title: **0 occurrences** in the file. Tab B's spec: **1 occurrence**, intact.

The refusal is real, not cosmetic: the write did not happen, the earlier writer's change was not
clobbered, and the later writer was told to reload rather than being silently overwritten or
silently overwriting.

### TC-58 — the real gate rules, at runtime, through the panel

One request setting both a karat claim and a fractional price:

```
HTTP 422
{"status":"REJECTED","error":"VALIDATION_FAILED",
 "message":"That edit would break a rule the catalogue is built on, so nothing was saved.
            The reasons are below, in the same words the build would use.",
 "failures":[
   "P001: \"18K Hallmarked Gold Wave Band Initial Ring\" makes a precious-metal claim this catalogue cannot support",
   "P001: pricing.price must be a positive whole number of rupees"]}
```

`md5sum data/products.json` identical before and after (`49fe03ab…`).

Two things this establishes that no unit test does. First, the honesty rules of
[ADR-018](../decisions/ADR-018-honest-product-description.md) and
[ADR-035](../decisions/ADR-035-catalogue-content-pass.md) fire through the **running panel**, in
`scripts/product-record-rules.mjs`'s own wording, having travelled through the HTTP boundary, the
body coercion and the repository — so the extraction of decision 2 in
[ADR-064](../decisions/ADR-064-admin-product-management.md) holds end to end and not merely at the
import level. Second, `210.5` reached the validator **as `210.5`** and was rejected by the
catalogue's own rule, rather than being silently rounded to `210` or coerced to `0` by the request
handler — which is the specific failure `readProductEdit`'s shape-only coercion exists to prevent.

Both failures were returned together, which is why `failures` is an array rather than a message.

## Failures

**None.** No case failed, and no log was written to `../logs/`.

Two corrections were made to documentation during this session, both to claims about the
repository rather than to code. Recording them because a result file that quietly fixes its own
premises is worth less than one that says what it got wrong.

1. **The advisory count.** An early draft of
   [ADR-064](../decisions/ADR-064-admin-product-management.md) described 404 records as carrying a
   gate advisory the panel would surface. Measured against real gate output, that is wrong: the
   404 figure is the priced-copy re-check list, which the panel does **not** surface. What an
   operator actually sees is the 9 above the discount house style and the 4 outside the description
   word range. Corrected before this result was written.
2. **What the 10 skips were.** They were first read as nine Postgres guards plus one build guard.
   They are in fact **ten build-artefact guards and no database guard** — `track-build-output.test.ts`
   uses the name `unavailableReason` for a missing `.next` file, which reads exactly like the
   database guard of the same name in the admin suites. Established by inspecting every skip site
   and confirmed by the suite reporting **0 skips** once a build existed. Corrected above.

## Gate, after the documentation was added

| Step | Result |
| --- | --- |
| `npx vitest run` | **102 files, 2071 passed, 0 skipped, 0 failed** (90.5s). The earlier run of this session, before a production build existed, was the prior session's 2061 passed / 10 skipped — same suite, the 10 build-artefact guards firing |
| `npm run validate:products` | **PASS — all checks green.** 449 products, 449 unique ids, 5 advisory groups (9 discount, 4 description, 84 shared secondary keywords, 15 near-match pairs, 404 priced-copy) — all pre-existing, none introduced |
| `npm run build` | **✓ Compiled successfully. ✓ Generating static pages (476/476).** 449 `/product/[id]` paths, 467 routes in `prerender-manifest.json`, middleware 27.1 kB, shared first-load JS 87.4 kB |
| `npx vitest run lib/product-repository-boundary.test.ts` (post-build) | **22 passed, 0 skipped** — TC-04 executed against real chunks |

The documentation added in this session is Markdown only and touches no code path — no test
reads `docs/`. The suite is the prior session's, and the only difference in the numbers is that
every build-artefact-guarded case now has a build to read.

## Summary

**59 of 59 cases pass, 0 fail, 0 skipped**, against a full suite of **2071 passed, 0
skipped**. TC-04, skipped in the prior session's gate, was executed against a real
production build and passed.

Shippable. The feature does what
[ADR-064](../decisions/ADR-064-admin-product-management.md) says it does, including the two
properties that could only be established against a running server: an edit made through the panel
genuinely reaches `data/products.json` as a minimal diff and is visible on the next read, and a
save holding a stale version token is genuinely refused rather than silently winning.
