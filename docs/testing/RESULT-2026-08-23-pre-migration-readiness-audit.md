# RESULT 2026-08-23 — Pre-migration readiness audit

- **Type:** Read-only audit. **Nothing was fixed, and no application code, schema, doc or data
  file was modified** other than this file and the `BUILD_LOG.md` row that records it.
- **Trigger:** The Odoo migration data (542 products, Phase B JSONL export) has not arrived. This
  audit exists to find the inconsistencies before it does.
- **Plan executed:** none — this is an audit, not a test-plan run. It reads the artefacts
  [ADR-051](../decisions/ADR-051-draft-a-content-pipeline.md) through
  [ADR-055](../decisions/ADR-055-category-vocabulary-and-surfacing.md) produced.
- **Gate state at time of audit:** green. `npm run test:run` → 1656 tests across 86 files, all
  passing. `npm run validate:products` → `PASS — all checks green`. Every finding below survives a
  green gate, which is the point of the exercise.

## Method

Every claim in this file was checked against the file it is about, and the three claims that are
measurements — the catalogue maximum, the validator's behaviour at 542 objects, and the register
append — were executed rather than reasoned about. Where a check was run, the command and its
output are quoted.

---

# Part A — Schema consistency

## A1. `CATEGORIES` against `SURFACED_CATEGORIES` — correct in every consumer

[ADR-055](../decisions/ADR-055-category-vocabulary-and-surfacing.md) split the vocabulary a
product record may carry from the list a shopper can browse. Every file that enumerates a category
was read and classified by which of the two questions it is asking.

| File | Uses | Question it asks | Correct? |
| --- | --- | --- | --- |
| `types/product.ts` | defines both | — | ✔ |
| `components/CategoryGrid.tsx` | `SURFACED_CATEGORIES` | what may a shopper browse | ✔ |
| `components/ShopFilterPanel.tsx` | `SURFACED_CATEGORIES` | what may a shopper browse | ✔ |
| `lib/navigation.ts` | `SURFACED_CATEGORIES` | what may a shopper browse | ✔ |
| `lib/sitemap.ts` | `SURFACED_CATEGORIES` | what may a crawler reach | ✔ |
| `lib/shop-query.ts` | `SURFACED_CATEGORIES`, `isSurfacedCategory` | what may `?category=` accept | ✔ |
| `app/(storefront)/shop/page.tsx` | `SURFACED_CATEGORIES` | copy and facets | ✔ |
| `app/(storefront)/style-guide/page.tsx` | `SURFACED_CATEGORIES` | what may a shopper browse | ✔ |
| `lib/breadcrumbs.ts` | `getCategoryLabel` | label a record's own slug | ✔ |
| `lib/structured-data.ts` | `getCategoryLabel` | label a record's own slug | ✔ |
| `lib/shop.ts` | `getCategoryLabel` | label a record's own slug | ✔ |
| `app/(storefront)/product/[id]/page.tsx` | `getCategoryLabel` | label a record's own slug | ✔ |
| `lib/draft-a-to-product.ts` | `isCategory` | may a record carry this slug | ✔ |
| `scripts/validate-draft-a.mjs` | local 11-slug `CATEGORY_SLUGS` | may a draft carry this slug | ✔ |
| `scripts/prepare-migration-batch.mjs` | local 11-slug `MIGRATION_CATEGORY_SLUGS` | may an export row carry this slug | ✔ |
| `scripts/generate-placeholders.mjs` | local 11-slug `CATEGORIES` | draw a tile for every slug in the vocabulary | ✔ |
| `scripts/validate-products.mjs` | both, locally declared | both directions of the gap | ⚠ see A1.1 |
| `prisma/schema.prisma` | neither | the catalogue is not in Postgres (ADR-040) | ✔ correct by absence |

`lib/category-vocabulary.test.ts` asserts that the four independent 11-slug enumerations agree
(`types/product.ts`, `validate-products.mjs`, `validate-draft-a.mjs`, `prepare-migration-batch.mjs`)
plus the placeholder generator's. Verified: it reads the plain scripts' declared arrays out of
source and compares them, so the lists cannot drift apart silently.

**Every surface asks the right question.** No file reads `CATEGORIES` where it should read
`SURFACED_CATEGORIES`, and none reads `SURFACED_CATEGORIES` where the full vocabulary is meant.

### A1.1 The one gap in the drift test — `validate-products.mjs` derives "surfaced" by name

`scripts/validate-products.mjs:110`:

```js
const SURFACED_CATEGORY_SLUGS = CATEGORY_SLUGS.filter((slug) => slug !== "gift-hampers");
```

The other four enumerations are compared to each other by `lib/category-vocabulary.test.ts`. This
one is not — the test asserts the script's `CATEGORY_SLUGS` holds all eleven, and never checks
that its notion of *surfaced* still matches `SURFACED_CATEGORY_SLUGS` in `types/product.ts`. The
subset is hardcoded to one slug's name rather than mirroring the `status` field that ADR-055 made
the source of truth.

Consequence, traced: flip `gift-hampers` to `surfaced` in `types/product.ts` and the storefront
starts rendering it, while `validate-products.mjs` still classes it pending. Its second loop then
fails with *"category `gift-hampers` is still pending but has N published product(s) — flip its
status to `surfaced` in `types/product.ts`"* — advice that has already been taken. The failure is
loud and blocks rather than corrupts, which is the safe direction, but the message misdirects, and
a second pending category added later would not be checked at all.

## A2. `subcategory` — captured three times, and it has nowhere to land

This is confirmed, and it is worse than "the mapper forgot it": there is no field for it to be
mapped into.

| Layer | Carries `subcategory`? | Evidence |
| --- | --- | --- |
| Phase B export schema (ADR-054) | **yes** | `"subcategory": "string \| null"` |
| Stage 0 validation | **yes** | `prepare-migration-batch.mjs:231` validates it is a non-empty string, `null`, or absent |
| Stage 0 raw block | **yes** | `buildRawBlock` writes `subcategory: record.subcategory ?? null` |
| Draft A output schema | **yes** | `.claude/skills/draft-a-skills.md`, and rule 13 governs when it is set |
| Draft A validator | **no** | `scripts/validate-draft-a.mjs` never reads the field — neither `validateDraftA` nor `validatePublishReadiness` |
| `DraftA` TypeScript interface | **yes** | `lib/draft-a-to-product.ts` declares `subcategory: string \| null` |
| `buildProductFromDraft` | **no** | the identifier `subcategory` appears in the interface and nowhere in the function body |
| `Product` interface | **no** | `types/product.ts` has no such field |
| `validate-products.mjs` | **no, and actively refuses it** | `PRODUCT_KEYS` is a strict allow-list; `unknown keys subcategory` is a hard failure |

Verified against the real catalogue: `data/products.json` has 0 of 49 records carrying a
`subcategory` key.

**The drop is documented, not accidental.** `.claude/skills/draft-a-to-product-skills.md` states
it plainly: *"`draft.subcategory`, `sourceNotes`, `flaggedContent` and `notes` do not become part
of the record either. They stay in the draft, which is why the draft is filed rather than deleted
at publish."* So this is a decision that was taken — but it was taken in a skill file, not in an
ADR, and it was taken before the field's cost was 542 products wide.

**What makes it a finding rather than a note.** `content-pipeline/` is untracked. Confirmed:

```
$ git check-ignore -v content-pipeline/drafts/X.json
.gitignore:50:/content-pipeline/drafts/*	content-pipeline/drafts/X.json
```

Only the four `README.md` files in that tree are tracked. So "it stays in the draft" means the
subcategory for 542 migrated products lives exclusively in working files that git does not hold,
that `docs/pipeline-prep/README.md` recommends keeping untracked, and that the registers describe
as *"a human index over an untracked directory"*. Nothing in the repository will ever record what
subcategory any migrated product had.

The same is true of four more fields Stage 0 transcribes into `sourceNotes` — `originalId`,
`originalSku`, `originalUrl` and `originalCategories` (see Part F).

**This needs an owner decision before extraction runs, not after.** Adding `subcategory` to the
record later means re-reading 542 raw blocks; deciding now that it is genuinely not wanted costs
nothing. The decision is not "did the mapper forget a line" — it is a schema question with a
strict-key validator behind it, so the change would touch `types/product.ts`, `PRODUCT_KEYS` in
`validate-products.mjs`, the mapper, and would want an ADR.

## A3. `status` — consistent, and `archived` was never built

`archived` was **discussed and never implemented**. Traced to its three mentions, all of which
correctly describe it as absent:

- `docs/decisions/ADR-052-product-status-field.md:81` names it as the obvious third value the
  type could grow, in *Alternatives considered*.
- `ADR-052:113` lists it under *what would force a revisit*, noting it needs a routing decision
  (410, or 301 to the category) that has not been taken.
- `docs/testing/RESULT-2026-08-23-product-status-field.md:99` states outright: *"The `archived`
  state named as future work in ADR-052 does not exist and is not tested."*

No code, type, validator, or schema anywhere in the repository mentions it. The remaining `archive`
hits (`lib/notify-message.ts`, `docs/api/notify-admin.md`) are about a notification archive and are
unrelated.

Consistency of the two states that do exist, across every consumer:

| Consumer | Handling | Consistent? |
| --- | --- | --- |
| `types/product.ts` | `ProductStatus = "draft" \| "active"`, `PRODUCT_STATUSES`, `isProductStatus` | ✔ |
| `Product.status` | required, not optional | ✔ |
| `scripts/validate-products.mjs:119` | `PRODUCT_STATUSES = ["draft", "active"]`, required on every record | ✔ |
| `lib/products.ts:25` | `product.status !== "draft"` — a missing status reads as active, deliberately, and the validator is what stops anything relying on it | ✔ documented in both places |
| `lib/draft-a-to-product.ts` | always writes `"draft"`, ignores `draft.status` entirely | ✔ matches ADR-053 decision 3 |
| `scripts/publish-product.mjs:83–94` | refuses an already-`active` record, refuses anything that is neither, flips `draft` → `active` | ✔ the third branch is the one that would catch an `archived` value arriving from nowhere |
| Draft A schema | `"status": "draft"` | ✔ but unvalidated — see MINOR-2 |

Current catalogue: 49 records, all `active`, 0 `draft`.

---

# Part B — Pipeline documentation consistency

## B4. Contradictions found

### The allow-list mechanism — mostly retired, three references still live

The `material-phrases.json` / `stone-terms.json` **gate** was removed in favour of "always propose,
always confirm". `ADR-051` records the change correctly: its body is left intact (an accepted ADR
is not rewritten), a banner at line 23 points forward, and the
[addendum](../decisions/ADR-051-draft-a-content-pipeline.md#addendum-2026-08-23--the-validator-exists-and-the-allow-list-gate-does-not)
retires the row. `scripts/validate-draft-a.mjs` opens by stating what it does *not* do. Both are
right, and neither is a finding.

Three places still describe the mechanism as live:

| File | Line | Text | Why it is stale |
| --- | --- | --- | --- |
| `docs/decisions/README.md` | 106 | *"turns the candidate lists of prompt 63 into a stated requirement for two owner-curated allow-lists. `data/material-phrases.json`, `data/stone-terms.json`, **`scripts/validate-draft-a.mjs`** and the phase-three similarity calibration are **not built**"* | `validate-draft-a.mjs` **is built**, with 100 tests, per ADR-051's own addendum. The index row contradicts the record it indexes |
| `docs/pipeline-prep/README.md` | 11 | *"A candidate list here is **not** an allow-list. `data/material-phrases.json` is built by the owner *from* these files"* | Present tense about a file the ADR-051 addendum marks *"No longer a dependency — not built, and under the current skill nothing is waiting for it"* |
| `docs/pipeline-prep/material-phrase-candidates.md` | 4 | *"Generated as raw extraction input for the owner-built `data/material-phrases.json`."* | Same — states a purpose that no longer exists |

`data/stone-terms.json` references are **not** stale: it survives by design as a helper, and every
reference correctly says it does not exist yet.

### The next product id — three documents, three different answers

This is the most consequential documentation contradiction, because it is about id assignment,
which ADR-051 decision 4 makes irreversible.

| Source | Says | Status |
| --- | --- | --- |
| `ADR-054` decision 3, `content-pipeline/incoming/README.md`, `content-pipeline/README.md`, `docs/pipeline-prep/README.md` step 0, `scripts/prepare-migration-batch.mjs` | migrated ids start at **P101**; **P050–P100 permanently retired** | ✔ current |
| `docs/pipeline-prep/drafts-in-progress.md` | the P050 row is struck through and explicitly labelled *"not a reservation, and P050 is no longer next"* | ✔ current and well handled |
| `.claude/skills/draft-a-skills.md` rule 14 | *"`productId` follows the site's sequential convention (**continuing from the next available number after P049**)"* | ✗ **stale — that number is P050, which is retired** |
| `.claude/skills/draft-a-skills.md` worked example | `"productId": "P050"` | ✗ **stale — a retired id used as the canonical example** |
| `content-pipeline/drafts/README.md:29` | fresh path: *"Next fresh id is **P111** or higher; take the next unused number above the last migrated one"* | ✗ **stale and arithmetically wrong at this batch size** |

The `P111` figure assumes a batch of about ten. 542 records from P101 occupies **P101–P642**, so
P111 sits in the middle of the migration range. The trailing clause ("take the next unused number
above the last migrated one") is the rule that actually keeps it safe, but the number is what a
reader takes away, and a fresh draft created at P111 would collide with a migrated one.

### Other references to renamed, redesigned or removed mechanisms

- **`ADR-052-content-similarity-engine.md`** — a filename that was planned and never written; the
  real ADR-052 is the product status field. Both surviving references are already annotated with
  the correction, in `lib/content-similarity.ts:10` and in `similarity-calibration-report.md`.
  Correctly handled, no action.
- **`CATEGORIES_UNKNOWN_DOWNSTREAM`** — deleted from `prepare-migration-batch.mjs`, and ADR-054's
  addendum records the deletion. Verified absent from the script. Correctly handled.
- No doc references a script or path that does not exist. Every `scripts/` and `content-pipeline/`
  path named in the pipeline docs resolves.

## B5. Stage vocabulary — one stale count

The six stages (`queued` → `extracted` → `in-review` → `confirmed` → `priced-and-shot` →
`awaiting-publish`) are defined identically in the two places that define them:

- `docs/pipeline-prep/drafts-in-progress.md` § Stages — six rows, `queued` first, with the note
  that it is the one stage a script writes.
- `content-pipeline/drafts/README.md` § The stage vocabulary — *"has **six** values"*, six rows,
  plus the reason `queued` was added rather than reusing `extracted`.

`scripts/prepare-migration-batch.mjs` exports `QUEUED_STAGE = "queued"` and writes it into the raw
block, the manifest and the register row — one constant, three uses, no literal drift.

**One contradiction:** `docs/pipeline-prep/README.md:42` still describes the register as holding
*"the **five-stage** vocabulary"*. It is six. (`ADR-054:209` also says "five stages", but correctly
— it is describing the state *before* the change it makes.)

## B6. The two skills against each other and against the 11-category reality

Read for mutual consistency. They agree on the handoff — `draft-a-skills.md` produces the object,
`draft-a-to-product-skills.md` consumes it; the field names, the `confirmed: false` → `true`
inversion, the `displayTerm`-is-never-a-claim rule, the price and image quarantine, and the
"gates refuse rather than repair" stance all line up. Three problems:

1. **`draft-a-to-product-skills.md` says "ten slugs" twice** — at line 49 (describing what
   `validatePublishReadiness` checks) and line 257 (the `category` row of the record-mapping
   table: *"Must be one of the ten slugs; anything else is a hard error"*). The vocabulary is
   eleven. `draft-a-skills.md` rule 5 was updated and lists all eleven including `gift-hampers`;
   its counterpart was not. Since this skill is the executable spec a model follows in Phase 2, an
   agent reading line 257 has a written instruction to hard-error a valid `gift-hampers` draft.
2. **`lib/draft-a-to-product.ts:583`** carries the same stale count in the error message a person
   actually reads: *"category must be resolved to one of the ten fixed slugs before publish"*.
   The code is correct — it calls `isCategory`, which accepts all eleven — only the message is
   wrong.
3. **The id contradiction in `draft-a-skills.md` rule 14 and its worked example**, covered in B4.

`draft-a-skills.md` rule 5 is otherwise exemplary on the surfaced/pending split: *"Whether a
shopper can browse a category is a separate, storefront-side question (ADR-055) and never affects
this choice — a draft records what a piece is."* That matches ADR-055 decision 4 and matches what
the code does.

---

# Part C — productId sequencing

## C7. The maximum is P049, and the assertion matches

Measured, not assumed:

```
$ node -e '...' data/products.json
count: 49
min: P001 max: P049
numeric max: 49
gaps below max: none
status: { active: 49 }
```

**`data/products.json`'s current actual maximum productId is `P049`.** 49 records, P001 through
P049, contiguous, no gaps.

`scripts/prepare-migration-batch.mjs` asserts exactly this:

```js
export const MIGRATION_ID_START = 101;
export const CATALOGUE_MAX_ID_CEILING = 49;
```

`assertCatalogueBelowOverrideFloor` throws unless `readMaxCatalogueProductId(products) <= 49`, and
`readMaxCatalogueProductId` throws on any id that is not a `PNNN` string rather than stepping over
it. There is no override flag. The refusal message names the id found, the range the script
assigns, and ADR-054. **Confirmed correct: max is P049, ceiling is 49, first assigned id is P101.**

Two further double-run guards sit past the assertion: the script refuses to overwrite an existing
`raw-block.json`, and `appendRegisterRows` refuses if the register already names any id it is about
to add. Both fail before writing anything. (The second guard is correct; the function's *insertion*
is not — see BLOCKING-1.)

## C8. P050–P100 — retired everywhere, with two documents still pointing a real product at P050

Every occurrence of `P050`–`P100` in the repository was enumerated. Only three distinct ids appear
at all: `P050`, `P099`, `P100`.

| Category | Files | Verdict |
| --- | --- | --- |
| States the retirement | `ADR-054` (8), `content-pipeline/drafts/README.md` (5), `content-pipeline/incoming/README.md` (2), `docs/pipeline-prep/README.md` (2), `docs/decisions/README.md` (2), `scripts/prepare-migration-batch.mjs` (3) | ✔ correct |
| Historical record of prompts that predate the retirement | `BUILD_LOG.md` (13), `RESULT-2026-08-23-content-pipeline-e2e.md` (30), `RESULT-…-orchestration.md` (4), `PLAN-stage-0-migration-batch.md` (2), `ADR-051` (2), `ADR-053` (4), `docs/testing/README.md`, `docs/design/IMAGES.md` | ✔ correct — a result file is a snapshot and is never edited |
| The register's example row | `docs/pipeline-prep/drafts-in-progress.md` (4) | ✔ **exemplary** — struck through, labelled `EXAMPLE ROW — not a real draft`, and followed by a paragraph stating *"The example row is not a reservation, and P050 is no longer next"* |
| Boundary-value tests | `lib/prepare-migration-batch.test.ts` (4) | ✔ correct — P050 is the meaningful first-id-above-the-ceiling, not a fixture |
| Fixture ids | `lib/validate-draft-a.test.ts` (6) | ⚠ violates ADR-053's stated rule — see MINOR-1 |
| **Instructs that a real product take P050** | `.claude/skills/draft-a-skills.md` — rule 14 and the worked example | ✗ **the one place that does claim it** |

**Answer to the question as asked:** P050–P100 is genuinely and permanently retired in every ADR,
README and register, and no *code* will ever assign an id in that range — `MIGRATION_ID_START` is
101 and the fresh path has no id-assigning code at all. The single exception is
`.claude/skills/draft-a-skills.md`, which tells the reader the next id is the one after P049 and
demonstrates it with `"productId": "P050"`. It is a documentation defect rather than an active
one, because rule 14 of that same skill forbids the skill from assigning ids at all — but it is
the one file in the repository that points a real product at a retired number.

`lib/content-similarity-gate.test.ts:40` mentions P050 only in a comment explaining why it *stopped*
using it — the fix ADR-053's addendum records. Correct.

---

# Part D — Validator and gate readiness at 542

## D9a. `scripts/validate-draft-a.mjs` — scales cleanly

Executed rather than reasoned about. 542 synthetic well-formed Draft A objects were generated into
a scratch directory (P101–P642) and the validator run over them:

```
$ node scripts/validate-draft-a.mjs drafts542
  ...
  Batch summary
    objects checked   542
    passed clean      542
    failed (hard)     0
    with warnings     0
  PASS — every Draft A object is well-formed and its provenance checks out.

real  0m0.075s
```

**Behaves correctly at scale.** `resolveBatchFiles` walks a directory recursively, handles a glob
or a single file, and sorts; `readBatchFile` accepts either one object or an array per file and
labels array elements by index so a finding stays traceable; the summary counts are correct;
exit code 1 on any hard failure, 2 on usage error. Findings carry a rule id, the field, the
truncated value, the message and the productId — enough to fix a run without opening the script.

Two things it does **not** do, both by omission rather than by decision (MINOR-2): it never checks
`productId` for presence, format or **uniqueness across a batch**, and it never reads `subcategory`,
`sourceType` or `status`. The synthetic run above included `subcategory: "band"` on all 542 objects
and the validator did not look at it once. Duplicate-id protection at Stage 0 is real (in-batch
duplicate detection, plus the raw-block-exists and register guards), so this is a second line of
defence that does not exist rather than a hole in the first.

It prints one line per object — 542 lines before the summary. Legible, but worth knowing before
running it.

## D9b. `scripts/validate-products.mjs` — correct at scale, with one measurable slowdown

`EXPECTED_PRODUCT_COUNT` is **confirmed correct and confirmed singular**:

- Declared once, `scripts/validate-products.mjs:29`, currently `49`.
- Read in exactly two adjacent lines, `242`–`245`, forming one `check()`.
- Grep across `*.mjs`/`*.ts` returns those plus one reference in `lib/product-schema.test.ts:16`
  — a comment stating the count lives there and is deliberately not repeated.
- The message is exact and directive in both directions. Too many: *"set `EXPECTED_PRODUCT_COUNT`
  to 50 in `scripts/validate-products.mjs`. Nothing else in the repository hardcodes a catalogue
  count."* Too few: *"A record has gone missing from `data/products.json` — check the diff before
  touching `EXPECTED_PRODUCT_COUNT`."*

**It fails in exactly one clear place with a clear message. Confirmed.** The consequence at this
batch size is that landing 542 products means 542 one-line bumps, one per orchestration run —
intended per ADR-053's addendum, and the reason it is intended (a record cannot appear or vanish
without someone meaning it) holds just as well at 542 as at 50.

The strict-key allow-list (`PRODUCT_KEYS`, line 783) is the reason A2 matters: an unknown top-level
key is a hard failure, so `subcategory` cannot be quietly added to a record — it needs a real
schema change.

**The one scale problem.** Lines 884–905 compare every keyword against every other keyword
pairwise, calling `normaliseKeywordLoosely` twice inside the inner loop with no memoisation.
Measured with the real normalisation function:

| Entries | Pairs | Time |
| --- | --- | --- |
| 200 (≈ today, 245 actual) | 19,900 | 0.16s |
| 800 | 319,600 | 1.7s |
| 2,400 | 2,878,800 | 20.5s |

Today's catalogue yields 245 keyword entries (49 primary + 196 secondary). At 591 products the
same ratio gives roughly 2,950 entries — about 4.4M pairs, extrapolating to **~30 seconds**, on a
check that runs in the gate on every commit and produces advisories only. Correctness is
unaffected; this is a cost finding, and hoisting the normalisation into a precomputed map would
make it linear-ish.

Everything else in the script is linear in the catalogue: per-record field checks, `existsSync` per
image, the keyword-map freshness comparison.

## D10. Keyword collision against many simultaneous drafts — correct

`checkCandidatePrimaryKeyword` in `lib/draft-a-to-product.ts` runs two independent checks:
`published` against the committed `data/keyword-map.json`, and `pendingDrafts` against a map built
on the fly by `buildDraftKeywordMap` from every `status === "draft"` record in the catalogue.

**It handles arbitrarily many in-progress drafts, not one or two.** Traced:

- `buildDraftKeywordMap` filters the *whole* catalogue to drafts and indexes all of them — there is
  no slice, no head, no assumption of a single draft.
- Both indexes are `Record<keyword, string[]>`, so one keyword claimed by N drafts yields all N
  ids, and the failure message names every one of them.
- `claimantsOf` returns every claimant minus the ignored product; `findLooseMatches` scans every
  key in the index.
- `blocked` is `published.blocked || pendingDrafts.blocked` — either index finding a hard collision
  refuses.
- `ignoreProductId` correctly stops a record colliding with itself on a rewrite.

Cost at scale is negligible: the draft map is rebuilt per call, O(drafts), and `findLooseMatches`
is O(distinct keywords) — roughly 3,000 normalisations per check against 591 products.

One structural note, which is a design consequence rather than a defect: a keyword only exists once
the orchestration skill has written a record into `data/products.json`. Drafts at `queued`,
`extracted`, `in-review`, `confirmed` and `priced-and-shot` have no SEO block yet, so there is
nothing for them to collide on. The gate therefore sees every keyword that exists at the moment it
runs, which is the correct coverage.

---

# Part E — Similarity gate

## E11. Threshold is still null, and the never-blocks path is unaltered

Verified line by line in `lib/content-similarity.ts`:

```ts
export const SIMILARITY_THRESHOLD: number | null = null;
```

`evaluateSimilarityGate` (line 409):

```ts
const exceeded = threshold === null ? [] : comparisons.filter((c) => c.peak.score > threshold);
return { productId, threshold, advisory: threshold === null, blocked: exceeded.length > 0, ... };
```

With `threshold === null`, `exceeded` is unconditionally `[]`, so `blocked` is unconditionally
`false` and `advisory` is `true`. **Nothing can be refused while the threshold is null**, and every
score is still computed and returned. `describeSimilarityGate` renders the advisory case as
*"ADVISORY (SIMILARITY_THRESHOLD is null, nothing blocks)"*. The blocking branch is present, uses
strictly-greater-than so a score equal to the threshold passes, and is exercised by tests.
`.claude/skills/draft-a-to-product-skills.md` step 4 matches: compute, write the file, report the
highest pair, continue. **Unaltered and correct.**

## E12. The calibration is against the 49 test products, and a fresh run is still needed

Stated plainly, as asked:

> **`docs/pipeline-prep/similarity-calibration-report.md` measures the 49 hand-written products in
> `data/products.json` and nothing else — 1,176 pairs, all of them survivors of a hand-authored
> catalogue pass. It is not representative of the final catalogue. A fresh calibration run is
> still required once real migrated products exist in meaningful numbers, and no threshold may be
> set from the existing report.**

The repository already says this in three places, and all three are accurate:

- The report's own title and first section: *"No threshold is set here… does not gate anything."*
- `lib/content-similarity.ts:322–329`: the 49 products are *"the survivors of a hand-written
  catalogue pass and not the population this gate will police — several hundred migrated listings
  whose copy came off one old site. A threshold fitted to 49 hand-tuned descriptions would be a
  number about the wrong catalogue."*
- `ADR-053` § *The threshold is null, and a number requires a calibration run that has not
  happened.*

The measured distribution reinforces it: raw similarity max 0.0178, mean 0.0007, p99 0.0107 —
every number so close to zero that, as the report puts it, the within-category signal is *"a shape
in the noise"*. Migrated copy off a single template will not look like this.

## E13 (not asked, found while checking E11) — the gate cannot see the batch it most needs to see

`selectActiveSimilarityInputs` filters to `status === "active"`:

```ts
return catalogue.filter((product) => product.status === "active").map(toSimilarityInput);
```

and the orchestration skill's step 4 passes exactly that as the comparison population.

Every migrated product is written as `status: "draft"` and stays that way until a human runs
`publish-product.mjs`. So each of the 542 candidates is scored against **the 49 original active
products only**, and never against the other 541 migrated drafts — the population whose copy came
off one old site and is by far the most likely to be templated. By the time a duplicate pair is
both active, the gate has already passed both.

The keyword gate solves precisely this problem, deliberately: ADR-053 decision 4 added a second
index over draft records *"because the committed map cannot see drafts"* and *"two drafts claiming
one keyword is a collision that only surfaces at publish, when it is expensive."* The identical
argument applies to descriptions and was not made. The docstring *"Drafts are not live copy"* is a
correct statement about a 49-product catalogue and a costly one about a 591-product migration.

This does not block today — the gate is advisory and refuses nothing — but it means the
similarity data being accumulated for the future calibration run is measured against the wrong
population, so E12's eventual calibration inherits the gap.

---

# Part F — Draft A → Product mapping completeness

`lib/draft-a-to-product.ts` read in full. Every field the Odoo export is expected to produce,
traced from the Phase B schema in ADR-054 to its destination in `Product`:

| Expected field | Stage 0 | Draft A | Mapper | `Product` | Verdict |
| --- | --- | --- | --- | --- | --- |
| `originalId` | `sourceNotes.originalId` | **no slot** — the skill's `sourceNotes` is `{rawContent, referenceTitle}` only | — | — | ✗ **no path** |
| `originalSku` | `sourceNotes.originalSku` | **no slot** | — | — | ✗ **no path** |
| `originalUrl` | `sourceNotes.originalUrl` | **no slot** | — | — | ✗ **no path** |
| `originalCategories` | `sourceNotes.originalCategories` | **no slot** | — | — | ✗ **no path** |
| `referenceTitle` | `sourceNotes.referenceTitle` | ✔ `sourceNotes.referenceTitle` | not read by the mapper | not a record field | ✔ **correct by design** — orchestration step 2 uses it as raw material for the name, and ADR-053 is explicit that review renames things |
| `subcategory` | ✔ validated and written | ✔ in schema, in the `DraftA` interface | **never read** | **no field** | ✗ **captured then dropped** (Part A2) |
| `suggestedCollections` | ✔ carried | ✔ | ✔ `mapCollections` | ✔ `collections` | ✔ **complete** — only `gifting`/`anti-tarnish` accepted, derived collections hard-error |
| `category` = `gift-hampers` | ✔ accepted, no warning | ✔ rule 5 lists it | ✔ `isCategory` accepts it | ✔ valid, `status: "pending"` | ✔ **works**; the refusal message and the skill still say "ten slugs" |
| `verified_distinct` | ✔ → `imageSuggestionProvenance[].verifiedDistinct`, deliberately beside the images, not inside | **no slot** — `DraftImages` is `{general, variantImages}` | `mapImagesToMedia` never reads provenance | `ProductMedia` has no provenance field | ✗ **no path** — see BLOCKING-2 |
| `images.main` / `extra` / `variantImages` | ✔ suggested paths in ADR-006 conventions | ✔ but **must be empty** at extraction (rule A3) | ✔ `mapImagesToMedia`, with variant-key validation | ✔ `media` | ⚠ **path exists but is severed mid-pipeline** — BLOCKING-2 |
| `referencePrice` | ✔ `pricing.referencePrice` | ✔ | not read — correct, it is a descriptive string, never money | — | ✔ **correct by design** |
| `attributes` | ✔ transcribed as `variants` shapes | ✔ produced by extraction | ✔ `mapAttributesToSpecs` | ✔ `specs` | ✔ **complete** — synonym table, duplicate-key refusal, `displayTerm` never written |
| variants | ✔ `toVariants` | ✔ | ✔ `mapVariantsToOptions` | ✔ `options` | ✔ **complete** — `type` must be supplied per option, absence is a refusal |
| `knownStub` | ✔ `sourceNotes.knownStub` | no slot | — | — | ✔ correct — a Stage 0 gate input, not product data |

**Fields with a real, working mapping path:** `referenceTitle`, `suggestedCollections`, `category`
(including `gift-hampers`), `referencePrice`, attributes → `specs`, variants → `options`, images →
`media`.

**Fields with no corresponding handling, flagged as asked:** `originalId`, `originalSku`,
`originalUrl`, `originalCategories`, `subcategory`, `verified_distinct`.

The four `original*` fields are provenance, and there is a reasonable argument that a catalogue
record should not carry the old shop's identifiers. But that argument was never made in an ADR,
and the effect at 542 products is that the only link between a Morchadi product and the Odoo
listing it came from lives in an untracked `raw-block.json`. Answering *"which old SKU is P387?"*
after `content-pipeline/` is cleaned up would be impossible.

---

# Part G — Prioritised findings

## BLOCKING

### BLOCKING-1 — `appendRegisterRows` writes 542 rows outside the register's table, silently

**Where:** `scripts/prepare-migration-batch.mjs:718–735`, against
`docs/pipeline-prep/drafts-in-progress.md`.

The function inserts rows immediately above the marker `"## Rejected ids"`. That marker is at line
50 of the register. The register's table ends at line 43, and lines 45–48 are the four-line
paragraph beginning *"**The example row is not a reservation, and P050 is no longer next.**"*

I ran the exact insertion the script performs against a copy of the real register. Result:

```
| ~~P050~~ | ~~Gold Plated AD Studs…~~ | … |          <- table ends here

**The example row is not a reservation, and P050 is no longer next.** An id is reserved by the
first file named after it, never by appearing in a table. ADR-054 retired **P050–P100**
permanently and starts the Odoo migration at **P101**; the reconciled rule for both intake paths
is in [`content-pipeline/drafts/README.md`](…#id-reservation-two-paths-one-rule).
| P101 | Example A | `rings` | `queued` | 2026-08-23 | batch `odoo-1`, Odoo id `205` |
| P102 | Example B | `earrings` | `queued` | 2026-08-23 | batch `odoo-1`, Odoo id `206` |
```

The rows land *after* the paragraph, with no blank line between them, so Markdown treats them as
lazy continuation of that paragraph. They render as literal inline text, not as table rows, and
not as a table at all — there is no header row above them.

**Why the test suite is blind to it.** `lib/prepare-migration-batch.test.ts:798` writes its own
register fixture:

```js
writeFileSync(registerPath, "## Register\n\n| a | b |\n\n## Rejected ids\n\n| x | y |\n");
```

In that fixture nothing sits between the table and the heading, so insert-above-the-marker lands
inside the table and the assertion (`P101` appears before `## Rejected ids`) passes. The fixture
does not have the real file's shape. All 1,656 tests pass and the defect is live.

**If unaddressed and real data arrives:** the first real `prepare-migration-batch.mjs` run appends
542 rows below a paragraph. The script exits 0 and reports success — there is no error, no warning,
nothing to notice. `docs/pipeline-prep/drafts-in-progress.md` becomes one 542-row run-on paragraph.
That file is, in ADR-054's own words, *"the human index that survives if `content-pipeline/` is
lost"* and the register whose accuracy `queued` rows exist to guarantee. Recovering it means
hand-reconstructing the table or re-deriving it from `manifest.json`. Worse, the id-collision
guard on the next run (`new RegExp("\\bP101\\b").test(existing)`) still matches text inside a
paragraph, so a second run refuses correctly — meaning the corruption cannot be fixed by re-running.

### BLOCKING-2 — the image suggestions and their `verified_distinct` evidence have no way across the extraction step

**Where:** `ADR-054` decision 5, `scripts/prepare-migration-batch.mjs` `buildImageSuggestions`,
against `scripts/validate-draft-a.mjs` rule A3 and `ADR-051` Phase 1.

Stage 0 deliberately populates `images.general`, `images.variantImages` and a parallel
`imageSuggestionProvenance` carrying each source file and the source system's hash-check flag as
`verifiedDistinct`. ADR-054 argues carefully for why this is not a violation: *"That rule is about
drafts. A raw block's images are suggestions being carried **to** the manual image-assignment
step."*

But the next artefact in the pipeline is a Draft A object, and `checkImagesAreEmpty` hard-fails
any Draft A whose `images.general` is non-empty — *"image assignment never happens in this skill"*.
The Draft A schema has no slot for `imageSuggestionProvenance` at all, and `mapImagesToMedia` never
reads one. So the suggestions must cross from `raw-block.json` to the manual image-assignment step
by going *around* the Draft A object, and **nothing — no script, no README, no ADR — says how.**
`content-pipeline/incoming/README.md` describes the raw block as *"the input extraction will
read"*, and the register moves the row from `queued` to `extracted` with no instruction to return
to `incoming/`.

There is no code anywhere that converts a `raw-block.json` into a Draft A object. The whole
handoff is an undocumented manual step, and the images are only the sharpest instance — the same
gap swallows `sourceNotes.originalId`, `originalSku`, `originalUrl`, `originalCategories` and
`subcategory` (Part F).

**If unaddressed and real data arrives:** one of two things, depending on how extraction is
implemented on the day, and neither is good.

- *Extraction carries the images across* (the natural reading of "the input extraction will
  read"): `validate-draft-a.mjs` fails **all 542** on rule A3, the batch stalls at the
  `queued` → `extracted` boundary, and the obvious way to unstick it — relax A3 — deletes the
  Phase 1 guarantee that no image is attached by something with no business attaching it.
- *Extraction drops them* (what A3 forces): the transformed paths and the `verifiedDistinct`
  evidence stay stranded in `content-pipeline/incoming/`, and the manual image-assignment step for
  542 products starts from nothing — re-deriving paths ADR-054 built specifically so it would not
  have to. The `verified_distinct` hash check, the one piece of trusted evidence in the whole
  import, never reaches the person deciding which photograph represents which variant.

### BLOCKING-3 — `subcategory` and the four `original*` fields are captured, then permanently lost

**Where:** Part A2 and Part F above.

`subcategory` is validated by Stage 0, written into every raw block, declared in the Draft A schema,
governed by skill rule 13, and declared in the `DraftA` TypeScript interface — and then read by
nothing. `Product` has no such field and `validate-products.mjs`'s strict `PRODUCT_KEYS` allow-list
would hard-fail any record carrying one. The same is true of `originalId`, `originalSku`,
`originalUrl` and `originalCategories`.

`content-pipeline/` is gitignored (verified with `git check-ignore`; only four `README.md` files are
tracked), and `docs/pipeline-prep/README.md` recommends keeping it that way.

**If unaddressed and real data arrives:** 542 products are extracted, reviewed, priced, published
and their drafts filed into `content-pipeline/completed/` — an untracked directory. The repository
ends up holding 542 products with no record of their subcategory, no link to the Odoo listing they
came from, no original SKU, and no original URL. Nothing fails; nothing warns. The question *"which
old product is P387, and what subcategory did it have?"* becomes unanswerable the first time
someone cleans up a working directory. Reversing it later means re-reading 542 raw blocks, if they
still exist.

The decision itself may well be the right one — a catalogue record arguably should not carry
another shop's identifiers. But it is currently recorded in one line of a skill file, not in an
ADR, and it was made when the field cost one product rather than 542.

## IMPORTANT

| # | Finding | Where | Effect |
| --- | --- | --- | --- |
| I-1 | **The similarity gate never compares migrated drafts to each other.** `selectActiveSimilarityInputs` filters to `status === "active"`, so each of 542 candidates is scored against the 49 originals only — never against the other 541, which came off one old site and are the likeliest duplicates. The keyword gate solved exactly this with a second draft index (ADR-053 decision 4); the identical argument was never made for descriptions | `lib/content-similarity.ts:432`, skill step 4 | Advisory today so nothing breaks, but the data accumulating for the future calibration run is measured against the wrong population, and templated copy passes unremarked |
| I-2 | **`draft-a-to-product-skills.md` instructs a hard error on eleven-slug categories.** Line 49 and line 257 both say "one of the ten slugs". `draft-a-skills.md` rule 5 was updated to eleven; its counterpart was not | `.claude/skills/draft-a-to-product-skills.md:49,257` | This skill is the executable spec for Phase 2. An agent following line 257 has a written instruction to refuse a valid `gift-hampers` draft |
| I-3 | **The same stale count in the error message a person reads.** `"category must be resolved to one of the ten fixed slugs before publish"`. The code is correct (`isCategory` accepts eleven); only the message is wrong | `lib/draft-a-to-product.ts:583` | Anyone debugging a category refusal is told to check against a list that is one slug short |
| I-4 | **Three documents disagree about the next product id.** `draft-a-skills.md` rule 14 says "the next available number after P049" (= P050, retired); its worked example uses `"productId": "P050"`; `content-pipeline/drafts/README.md:29` says the next fresh id is "P111 or higher" — inside the P101–P642 range this batch will occupy | see Part B4 | The only place in the repository pointing a real product at a retired id, and a fresh-path floor that would collide with a migrated id |
| I-5 | **`validate-products.mjs` derives "surfaced" by hardcoded slug name**, `CATEGORY_SLUGS.filter(slug => slug !== "gift-hampers")`, rather than from ADR-055's `status` field — and `lib/category-vocabulary.test.ts` compares the four vocabularies but not this subset | `scripts/validate-products.mjs:110` | Flipping `gift-hampers` to surfaced produces a hard failure whose message tells you to do the thing you just did. A second pending category would not be checked at all. Fails safe, but misdirects |
| I-6 | **The keyword near-match loop is O(n²) with no memoisation** — measured at 20.5s for 2,400 entries; ~2,950 entries are expected at 591 products, extrapolating to **~30s** per gate run, for advisories only | `scripts/validate-products.mjs:884–905` | `npm run validate:products` runs on every commit; a half-minute of it would be one uncached pairwise loop |
| I-7 | **`docs/decisions/README.md:106` says `scripts/validate-draft-a.mjs` is "not built"** — it is built, with 100 tests, per ADR-051's own addendum. The same row presents `data/material-phrases.json` as a live requirement | `docs/decisions/README.md:106` | The ADR index contradicts the ADR it indexes, on the one question ("what exists?") an index is read for |
| I-8 | **Two more live references to the retired allow-list mechanism**: `docs/pipeline-prep/README.md:11` and `docs/pipeline-prep/material-phrase-candidates.md:4` both describe `data/material-phrases.json` in the present tense as a file the owner builds from those candidates | as listed | A reader concludes an allow-list is still a prerequisite, when ADR-051's addendum retired it |
| I-9 | **`docs/pipeline-prep/README.md:42` says the register holds "the five-stage vocabulary"** — it holds six; `queued` was added by ADR-054 and is documented correctly in both places that define it | `docs/pipeline-prep/README.md:42` | The only place in the repository where the Stage vocabulary is miscounted |

## MINOR

| # | Finding | Where |
| --- | --- | --- |
| M-1 | `lib/validate-draft-a.test.ts` still uses `P050` as its fixture `productId` (6 occurrences), violating ADR-053's stated rule that *"a product id that stands for a fixture, in any test, is `P9xx`"*. The addendum moved `content-similarity-gate`, `draft-a-to-product` and `publish-product` off it and missed this file. Hermetic, so it cannot collide — but it is a retired id used as a placeholder | `lib/validate-draft-a.test.ts:38,84,120,228,237,795` |
| M-2 | `validate-draft-a.mjs` never checks `productId` presence, format or **uniqueness across a batch**, and never reads `subcategory`, `sourceType` or `status`. Confirmed empirically: 542 objects each carrying `subcategory: "band"` passed without the field being looked at. Stage 0's guards are the real defence; this is a second line that does not exist | `scripts/validate-draft-a.mjs` |
| M-3 | Product-id regexes diverge: `validate-products.mjs` requires exactly three digits (`/^P\d{3}$/`), `prepare-migration-batch.mjs` allows three or more (`/^P(\d{3,})$/`). Harmless at 542 (P101–P642), a hard failure above P999 | `scripts/validate-products.mjs:82`, `scripts/prepare-migration-batch.mjs:84` |
| M-4 | Stale test *names* saying "ten": `lib/catalogue-ia.test.ts:52` *"accepts all ten slugs"* and `lib/draft-a-to-product.test.ts:412` *"refuses a category outside the ten fixed slugs"*. Both assertions are correct — they iterate `CATEGORY_SLUGS` rather than hardcoding a count — only the names are stale | as listed |
| M-5 | `validate-draft-a.mjs` prints one PASS/FAIL line per object: 542 lines before the summary. The summary block at the end makes it usable, but the run is not quiet | `scripts/validate-draft-a.mjs` `printResult` |
| M-6 | Landing 542 products requires 542 separate one-line bumps of `EXPECTED_PRODUCT_COUNT`, one per orchestration run. Intended per ADR-053's addendum and the reasoning still holds, but worth stating as a known cost of the batch | `scripts/validate-products.mjs:29` |

## What was checked and found correct

Recorded so a later reader knows these were examined rather than skipped.

- Every category enumeration uses the right list for its purpose (18 files, Part A1).
- `archived` was discussed in ADR-052 and never built; all three references correctly describe it
  as absent, and no code mentions it.
- `status` is consistent across the type, the validator, `lib/products.ts`, the mapper and
  `publish-product.mjs`, including the deliberate missing-status-reads-as-active fallback.
- `data/products.json`'s maximum is P049, contiguous from P001; the Stage 0 ceiling assertion
  matches exactly and offers no override.
- P050–P100 is retired in every ADR, README and register; the register's example row is handled
  exemplarily.
- `EXPECTED_PRODUCT_COUNT` fails in exactly one place, with a message naming the line and the
  number to set it to, in both the too-many and too-few directions.
- `validate-draft-a.mjs` handles 542 objects correctly in 75ms.
- The keyword collision check handles arbitrarily many simultaneous drafts, names every claimant,
  and refuses on either index.
- `SIMILARITY_THRESHOLD` is `null`; the never-blocks-while-logging path is unaltered and the
  blocking branch is intact behind it.
- The similarity calibration report, `lib/content-similarity.ts` and ADR-053 all state clearly
  that the 49-product calibration is not the population the gate will police.
- Prisma holds no catalogue, no category and no status — correct by absence per ADR-040.
- The `ADR-052-content-similarity-engine.md` filename confusion and the deleted
  `CATEGORIES_UNKNOWN_DOWNSTREAM` warning are both correctly recorded where they occurred.
- Full gate green: 1656 tests across 86 files, `validate:products` PASS.

## The single most important thing to fix before real data arrives

**BLOCKING-1 — the register insertion.**

It is the only finding that is a live code defect rather than a documentation drift or a schema
decision; it fires on the very first real run; it fails **silently** with exit code 0; the test
suite is structurally blind to it because the fixture does not have the real file's shape; and it
destroys the one artefact ADR-054 designates as the record that survives if `content-pipeline/` is
lost. It is also the cheapest to fix — insert into the table rather than above a heading, and make
the test use a fixture shaped like the real register.

BLOCKING-2 and BLOCKING-3 are more consequential in the long run, but both are decisions to take
rather than bugs to repair, and both are still open on the day the export lands.

---

*Read-only audit. No application code, schema, or data was modified.*
