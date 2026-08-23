# RESULT 2026-08-23 — Image confirmation, migration provenance, and draft-to-draft similarity

- **Type:** Implementation of three findings from the
  [pre-migration readiness audit](RESULT-2026-08-23-pre-migration-readiness-audit.md) — BLOCKING-2,
  BLOCKING-3 and IMPORTANT-1. Design recorded in
  [ADR-056](../decisions/ADR-056-image-confirmation-provenance-and-draft-similarity.md).
- **Plan executed:** none. The audit is the plan — each finding names the fix it needs.
- **Gate:** all five commands green. Full output in
  [The five-command gate](#the-five-command-gate) below.
- **Suite:** 1695 tests across 87 files, up from 1656 across 86. One new file,
  `lib/product-provenance.test.tsx`.
- **`data/products.json` is unchanged.** It was modified during the client-bundle verification and
  reverted; `git status --short data/` is empty and the catalogue still holds 49 products.

---

## What was verified, by finding

| Finding | Fix | Where it is checked |
| --- | --- | --- |
| BLOCKING-2 — image suggestions and their `verified_distinct` evidence have no path across extraction | Every image suggestion carries `confirmed`, provenance rides inside it, rule A3 checks the flag rather than the length of the list | `lib/validate-draft-a.test.ts` (A3, D4), `lib/draft-a-to-product.test.ts` (`mapImagesToMedia`), `lib/prepare-migration-batch.test.ts` (Stage 0 emits `confirmed: false`) |
| BLOCKING-3 — `subcategory` and four `original*` fields captured then dropped | Both become record fields, provenance as one nested server-only group | `lib/draft-a-to-product.test.ts` (the mapper), `lib/product-provenance.test.tsx` (the seal), `scripts/validate-products.mjs` (the allow-list and shape) |
| IMPORTANT-1 — the similarity gate never compares migrated drafts to each other | `selectSimilarityComparisonPopulation` replaces `selectActiveSimilarityInputs` as the gate's population | `lib/content-similarity-gate.test.ts`, the `draft-to-draft comparison` block |

---

## Part A — images: confirmed and unconfirmed gate the two checks in opposite directions

The rule now mirrors the attribute rule exactly. Both checks were run over the same object to prove
the mirror holds rather than asserting each half separately.

| Draft state | `validateDraftA` (pre-review) | `validatePublishReadiness` (post-review) |
| --- | --- | --- |
| `images.general: []` | **PASS** | FAIL — D4, `images.general` must hold at least one |
| suggestions present, all `confirmed: false` | **PASS** — the expected state of a Stage-0-prepared migrated product | FAIL — D4, `images.general[0].confirmed` |
| any suggestion `confirmed: true` | **FAIL** — A3, `images.general[0].confirmed` | **PASS** |
| a variant suggestion `confirmed: true`, general empty | FAIL — A3, `images.variantImages["Colour:Golden"].confirmed` | FAIL — D4 (no general image) |
| a bare path string, no `confirmed` at all | FAIL — A3, `images.general[0]` | FAIL — D4 |

The case that matters most is row two, because it is the one the audit said would fail all 542
drafts and it now passes:

```
it("accepts a Stage-0-prepared draft whose every suggestion is confirmed: false")
  → validateDraftA(draft).errors === []
```

The existing *"the two checks are inverses on the fields review changes"* case still holds and its
expected rule list is unchanged at `["A2", "A2", "A3", "B1", "B1"]` — the reviewed draft still fails
the extraction check on A3, now because its image is confirmed rather than because it exists.

`mapImagesToMedia` carries confirmed entries only. Four cases: a confirmed general image is carried;
an unconfirmed one is dropped with an advisory naming it; an unconfirmed variant image is dropped
without taking the confirmed one beside it; a draft whose every general suggestion is unconfirmed
produces the same hard `images.general` error as an empty list, so the failure is loud rather than a
product published with no photograph.

Stage 0 was checked at its own end: every entry it writes is `confirmed: false`, `verifiedDistinct`
is inside the entry, and a missing `verified_distinct` in the export still reads as `false`.

---

## Part B — provenance: the empirical client-bundle verification

This is the part that could not be settled by a unit test, and it was run the way `pricing.cost` was
run: **inject, build, grep, revert.**

### Method

A probe was written into `data/products.json` — P001, an ordinary active product — with values
chosen so no substring of them could occur naturally anywhere in the repository:

```json
"subcategory": "PROVPROBESUBCAT",
"migrationProvenance": {
  "originalId": "PROVPROBEID9987",
  "originalSku": "PROVPROBESKU9987",
  "originalUrl": "https://provenance-probe.invalid/9987",
  "originalCategories": ["PROVPROBECATEGORY"]
}
```

`npm run validate:products` was run against the probe first, to confirm the new fields pass the
allow-list rather than being tolerated by accident:

```
With provenance     1 (migrated, server-only)
PASS — all checks green.
```

Then `rm -rf .next && npm run build` — a real production build, 75 static pages — and the grep. Three
targets, because they are three different ways a value can reach a browser:

- `.next/static` — the JavaScript and CSS the browser downloads
- `.next/server/**/*.html` — the prerendered markup, 64 files
- `.next/server/**/*.rsc` — the React flight payloads, 62 files. **This is the one a
  `toCatalogueEntry` unit test cannot see**: a field can reach a browser through a prerendered flight
  payload without passing through `toCatalogueEntry` at all

```bash
probe() {
  local token="$1"
  static=$(grep -rlF "$token" .next/static | wc -l)
  html=$(find .next/server -name '*.html' -exec grep -lF "$token" {} + | wc -l)
  rsc=$(find .next/server -name '*.rsc'  -exec grep -lF "$token" {} + | wc -l)
  printf '%-34s static=%-3s prerendered-html=%-3s rsc-flight=%s\n' "$token" "$static" "$html" "$rsc"
}
```

### The evidence

```
--- NEGATIVE CONTROLS: values that DO reach a browser (proves the grep is not vacuous) ---
product name "Wave Band Initial Ring" static=0   prerendered-html=61  rsc-flight=61
CatalogueEntry key "variantImages"     static=2   prerendered-html=61  rsc-flight=61
CatalogueEntry key "inStock"           static=4   prerendered-html=61  rsc-flight=61

--- POSITIVE CONTROL: the field already sealed (pricing.cost) ---
"cost" as a key                        static=0   prerendered-html=0   rsc-flight=0

--- SUBJECT: ADR-056 fields ---
migrationProvenance                    static=0   prerendered-html=0   rsc-flight=0
subcategory                            static=0   prerendered-html=0   rsc-flight=0
```

And per value rather than per field name, because a grep for `migrationProvenance` alone would pass
while the old shop's URL sat in the markup under some other name:

```
migrationProvenance          static=0  prerendered-html=0  rsc-flight=0  server-chunks=2
PROVPROBEID9987              static=0  prerendered-html=0  rsc-flight=0  server-chunks=2
PROVPROBESKU9987             static=0  prerendered-html=0  rsc-flight=0  server-chunks=2
provenance-probe.invalid     static=0  prerendered-html=0  rsc-flight=0  server-chunks=2
PROVPROBECATEGORY            static=0  prerendered-html=0  rsc-flight=0  server-chunks=2
PROVPROBESUBCAT              static=0  prerendered-html=0  rsc-flight=0  server-chunks=2
```

**The controls are what make the zeros mean something.** `variantImages` and `inStock` are
`CatalogueEntry` keys and appear in the browser chunks and in all 61 prerendered product pages. The
product's own name appears in 61 prerendered pages and 61 flight payloads. The same greps, over the
same build, return zero for every provenance token and for `subcategory`.

`server-chunks=2` is the expected and correct residue. Listed in full, every file anywhere under
`.next` that contains the probe SKU:

```
$ grep -rlF PROVPROBESKU9987 .next | sort
.next/server/chunks/3483.js
.next/server/chunks/7966.js
.next/standalone/.next/server/chunks/3483.js
.next/standalone/.next/server/chunks/7966.js
.next/standalone/data/products.json
```

Two server chunks, their two copies inside the standalone output, and the copy of
`data/products.json` the standalone server reads. `data/products.json` is bundled into the server
chunks that read it, which is exactly where `pricing.cost` lives too, and the standalone tree is the
container's server — `ADR-032`'s runner stage. None of these five files is ever served to a browser.
The identical five-file list comes back for `migrationProvenance` itself, and `.next/static` — the
58 files a browser downloads — contains neither.

### Reverted, and re-verified clean

```
$ git checkout -- data/products.json
$ git status --short data/          # (no output)
$ node -e "...":  probe removed: true
```

A second build with the clean catalogue finds neither token anywhere in `.next` at all — `static=0
server=0` for both — because no product carries them yet. That is the state the repository ships in;
the probe build is what proves the seal will hold when one does.

### `subcategory` — the deliberate choice, stated

`subcategory` reaches no client bundle today. **That is a consequence of `toCatalogueEntry`'s
whitelist, not of any rule about the field**, and it is permitted to reach one. It is not sensitive:
it is this shop's own second-tier label, not another shop's identifier. A future surface that wants
to render it may add it to `CatalogueEntry` without reopening
[ADR-056](../decisions/ADR-056-image-confirmation-provenance-and-draft-similarity.md).

`migrationProvenance` may not, ever. `lib/product-provenance.test.tsx` names both facts in separate
assertions so neither can be read as the other.

### The regression test that runs on every commit

`lib/product-provenance.test.tsx`, 13 cases:

- a product carrying populated `migrationProvenance` renders through `ProductCard` normally — name,
  price and image alt all correct
- none of the six provenance strings, and no subcategory, appears in the rendered markup
- `toCatalogueEntry` returns only keys from the `CatalogueEntry` whitelist — checked as a whole key
  set, so a field added to `Product` tomorrow has to be named there before it can reach a browser
- the serialised entry contains none of the provenance names or values, and no `subcategory`
- the real catalogue index contains no `migrationProvenance`, no `subcategory` and no `cost`
- eight Client Component files are read as text and asserted to contain `"use client"` and not to
  contain `migrationProvenance` — this is the check that would fail first, since a Client Component
  naming the field is the only way the build grep could ever start finding it

---

## Part C — similarity: draft-to-draft comparisons are scored

The synthetic pair the audit asked for. Two `status: "draft"` products, P901 and P902, sharing one
templated description, against a single active product P001 whose copy is unrelated. The candidate
is a third draft carrying the same templated copy.

| Population | `comparedAgainst` | highest peak | against |
| --- | --- | --- | --- |
| `selectActiveSimilarityInputs` — what this replaced | 1 | **< 0.1** | P001 (active) |
| `selectSimilarityComparisonPopulation` | 3 (1 active, 2 draft) | **1.000** | P901 (**draft**) |

The first row is the finding, reproduced as a test so it stays reproduced: on the active-only
population a verbatim duplicate of a sibling draft scored below 0.1 against the only thing it was
allowed to see, and passed unremarked.

Two drafts that exist only in the current session — neither written to `data/products.json` — score
against each other too:

```
evaluateSimilarityGate(first, selectSimilarityComparisonPopulation([], [first, second]))
  → comparedAgainst 1, comparedAgainstDraft 1, against P905, raw 1.0
```

**Nothing is refused.** `SIMILARITY_THRESHOLD` is still `null`, `blocked` is `false`, `advisory` is
`true`, and the descriptive line reads:

```
ADVISORY (SIMILARITY_THRESHOLD is null, nothing blocks): highest raw 1.000 against P905 (draft),
across 1 product(s): 0 active, 1 draft.
```

That is the point of the fix and the limit of it: the comparison population is now correct, so the
data accumulating for the calibration run that E12 still requires is about the right catalogue.
Setting a number remains a separate decision that has not been earned.

---

## The five-command gate

```
$ npm run typecheck
> tsc --noEmit
                                                                    exit 0

$ npm run lint
> next lint
✔ No ESLint warnings or errors                                      exit 0

$ npm run test:run
> vitest run
 Test Files  87 passed (87)
      Tests  1695 passed (1695)
   Duration  79.43s                                                 exit 0

$ npm run validate:products
Products            49
Unique ids          49
Active              49
Draft               0
With options        5
With collections    8
With provenance     0 (migrated, server-only)
PASS — all checks green.                                            exit 0
  (7 advisory blocks unchanged from before this change: 9 discounts above the
   60% house style, 4 short descriptions, 9 shared secondary keywords, 1
   word-order pair, 9 price-dated copy entries)

$ npm run build
 ✓ Generating static pages (75/75)
+ First Load JS shared by all            87.4 kB
ƒ Middleware                             27.1 kB                    exit 0
```

`npm run test:run` was 1656 across 86 files before this change and is 1695 across 87 after: 39 net
new cases, one new file. No test was deleted; six fixtures were reshaped for the new image schema
(`lib/validate-draft-a.test.ts`, `lib/draft-a-to-product.test.ts`,
`lib/prepare-migration-batch.test.ts`, `lib/publish-product.test.ts`,
`lib/category-vocabulary.test.ts`).

---

## What this run did not do

- **BLOCKING-1 is still open.** `appendRegisterRows` still writes 542 rows outside the register's
  table. Different mechanism, different fix, its own change.
- **I-2 through I-9 and M-1 through M-6 are still open**, including `docs/decisions/README.md:106`
  still describing `scripts/validate-draft-a.mjs` as *"not built"*, and the *"ten fixed slugs"*
  message in `lib/draft-a-to-product.ts`.
- **No threshold was set.** Deliberately, per Part C.
- **No real migration data was involved.** The Phase B export has not been delivered, every fixture
  here is synthetic, and no real Odoo listing has been through any of this.
