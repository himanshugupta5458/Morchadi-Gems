# RESULT — 2026-08-24 — Pipeline health audit, post-pilot (images, docs, dead code)

**Scope.** The Draft A content pipeline only — Stage 0, extraction, Phase 2, publish, and the
docs, scripts and tests around them. Diagnose-first: only mechanical, zero-judgment fixes were
applied; everything needing a decision is reported for the owner. Nothing in `data/products.json`,
no extraction run, and the 531 still-queued products were inspected read-only.

**Verdict.** The pipeline's code paths are sound for the next five extraction sub-batches — no
data-corruption path was found. The real exposure is around the image *files*, not the image
*data*: the only copy of ~1,075 source photographs for 531 unpublished products sits untracked on
one machine, the staging layout does not scale for a human, and the published pilot left stale
artefacts behind in staging. A concrete restructure proposal is in Part D, awaiting the owner's
approval.

---

## Part A — Full image lifecycle trace (actual behaviour, verified against code and disk)

### A.1 The chain, step by step

**1. Odoo export → staging.** An external downloader (not in this repository) wrote, per source
listing, `content-pipeline/incoming/2026-08-23-batch-01/odoo-{originalId}/` containing
`raw/main.webp` (+ `raw/extra-N.webp`, `raw/variant-*.webp` where present), an `images.json`
manifest (file, bytes, source URL per image), and an empty `_complete` marker. Batch-level
downloader artefacts sit beside them: `download-report.csv` (skipped videos etc.),
`watch-pair-check.csv`, `variant-image-check.csv`, and `draft-a-input.jsonl` (the Phase B export
itself). **No repository code reads `images.json`, `_complete`, or the CSVs** — they are
downloader provenance for humans. Current inventory: 542 `odoo-*` dirs, 1,075 `.webp` files, 98 MB.

**2. Stage 0 (`scripts/prepare-migration-batch.mjs`).** Read-only with respect to image files: it
verifies every file the export names actually exists on disk
(`collectReferencedImageFiles` → `sourceImagePath` → injected `imageExists`, so all extras and
variant files are checked, not just `main.webp`). `buildImageSuggestions` then writes, into
`{batch}/PNNN/raw-block.json`, suggestion objects in ADR-006's path convention:

```json
{ "path": "/products/P198.webp", "confirmed": false,
  "sourceFile": "2026-08-23-batch-01/odoo-496/raw/main.webp", "role": "main" }
```

— `/products/PNNN.webp` for main, `/products/PNNN-{n}.webp` for extras (n from 2), and
`/products/PNNN-{valueSlug}.webp` keyed `"OptionName:value"` for variant images (attribute-prefixed
only when two values slugify identically). `verifiedDistinct` (the source's hash check) rides on
variant entries. Everything is `confirmed: false`. `confirmationState.imagesConfirmed: false` is
written once and — verified by grep — **never read or flipped by anything afterwards**; it is a
self-description of the file at creation, not a tracked state.

**3. Extraction (Draft A skill, human-supervised).** The images block is *carried* verbatim from
the raw block into `content-pipeline/drafts/PNNN.json`. `validateDraftA` (rule A3, renamed
`checkImagesAreUnconfirmed` by ADR-056) requires every suggestion to still be `confirmed: false`
pre-review.

**4. Owner review / image assignment.** Entirely manual, two disjoint actions with no tool
connecting them:
- edit `drafts/PNNN.json`, flipping each suggestion's `confirmed` to `true` (a declined suggestion
  is *deleted*, not left false — that is what makes `validatePublishReadiness`'s
  "every entry confirmed" satisfiable);
- copy the staged file to its suggested path by hand. Verified against the pilot: all 13 published
  `public/products/P1*.webp` files are **byte-identical** to their
  `odoo-*/raw/*` sources (straight `cp` + rename, no re-encode, no resize).

**5. Phase 2 (`lib/draft-a-to-product.ts` → `mapImagesToMedia`).** Pure data mapping, no file I/O.
Only `confirmed: true` entries become `media.images` / `media.variantImages` (plain path strings —
`sourceFile`/`role`/`verifiedDistinct` stop here, surviving only in the draft file). Unconfirmed
entries drop with an advisory; empty `images.general` is a hard error; every variant key must name
a declared option+value. `validate-products.mjs` is what later verifies the *files* exist under
`public/` (primary, extras and variant images all checked with `existsUnderPublic`).

**6. Publish (`scripts/publish-product.mjs`).** Touches no image files at all. Flips status,
regenerates the keyword map, moves `drafts/PNNN.json` → `completed/PNNN.json` (the similarity
report `PNNN-similarity.json` is deliberately left in `drafts/`).

**7. Post-publish.** Nothing cleans staging. Verified for the pilot: the 11 published products'
`{batch}/PNNN/raw-block.json` files still sit in `incoming/` claiming `stage: "queued"` /
`imagesConfirmed: false`, and their 11 `odoo-*` image dirs remain in place. The published `.webp`
files are committed (commit `3050b76`); their staging sources are untracked duplicates.

### A.2 Naming/path assumptions across the chain — do they still hold?

| Assumption | Where | Holds? |
| --- | --- | --- |
| Main image path is exactly `/products/PNNN.webp` | Stage 0 suggestion ↔ `validate-products.mjs` exact-match check | ✔ consistent |
| Extras are `/products/PNNN-{n}.webp`, n≥2 | Stage 0 ↔ validator's `startsWith("/products/PNNN-") && endsWith(".webp")` | ✔ consistent |
| Variant paths `/products/PNNN-{valueSlug}.webp` pass the same `PNNN-` prefix check | Stage 0 ↔ validator | ✔ consistent |
| Extra numbering and variant slugs never collide (`PNNN-2.webp` as both extra-1 and a variant whose value slugifies to `2`) | `buildImageSuggestions` dedupes variant-vs-variant slugs only, not variant-vs-extra | ✔ in the real batch (verified: 0 collisions, 0 numeric variant suffixes across all 542 raw blocks) — but it is unguarded in code. MINOR finding |
| `sourceFile` is relative to `content-pipeline/incoming/` and includes the batch id | Written by Stage 0; read by no code afterwards (human provenance only) | ✔ — but it means any staging restructure must rewrite these strings in 531 raw blocks + any extracted drafts (Part D accounts for this) |
| `workingId` = `odoo-{originalId}` and equals the image dir name | Derived by Stage 0; reconciliation confirmed identity in all 542 records | ✔ |
| Image suggestions survive extraction with provenance inside them (ADR-056 confirmed-boolean design) | raw block ↔ draft schema ↔ `mapImagesToMedia` | ✔ consistent end to end |
| Surfaced/pending category split does not touch image paths | ADR-055 | ✔ no interaction found |
| Suggested paths are unique across the whole batch | verified: no cross-product duplicate suggested path, no shared `sourceFile` between two products | ✔ |

### A.3 Friction at 5-batch scale (what a human actually experiences)

- **Manual steps touching images, per product:** find the right `odoo-*` dir (requires opening
  `PNNN/raw-block.json` to learn the workingId — the P-dir and the image dir are decoupled
  siblings), eyeball each staged file against its suggestion, hand-edit `confirmed` per entry in
  the draft, hand-`cp`+rename each file into `public/products/`, then rely on
  `validate:products` to catch a missed copy. For the remaining 531 products that is ~1,062
  file copies and ~1,075 confirmed-flag edits spread over 5 sub-batches.
- **"All images for product X"** requires a different lookup at every stage: raw-block →
  workingId → `odoo-*/raw/` while queued; the draft's `sourceFile` strings while in review;
  `public/products/PNNN*.webp` once assigned. The batch dir's 1,090 sibling entries (542 `PNNN` +
  542 `odoo-*` + 6 files) make it unscannable by eye.
- **Abandoned batch / abandoned product:** nothing marks it. The raw block (deliberately, as the
  id reservation) and the image dir both linger indefinitely; the only signal is a hand-edited
  register row. The 11 published pilot products already demonstrate the leak — stale `queued`
  raw blocks and orphaned image dirs.
- **The 531 still-queued products' ~1,000 images** must stay staged for the full duration of all
  5 remaining sub-batches under the current design, because `sourceFile` pins them and no
  per-batch archival step exists. **They are untracked, exist on one machine only, and are the
  sole copy this side of the old site** — if `content-pipeline/` is lost, photographs for 531
  products are gone unless morchadijewels.com is still up to re-download from.
- **Duplicate photographs are systemic, not a one-off.** A byte-level sweep of all 1,075 staged
  files found 72 duplicate groups (171 files). For *main* images specifically: 17 groups —
  and 10 of the 11 published pilot products have a byte-identical main photo sitting in a
  still-queued product's staging (e.g. published P106/P120's shared photo — KI-001 — is also
  queued P160's main; published P108's main is queued P135's; P115's is P141's and P167's).
  Every one of those queued twins will re-raise the KI-001 decision at its own review.

---

## Part B — Documentation accuracy check

Every pipeline doc (ADR-051–056 with addenda, `docs/pipeline-prep/*`, the four
`content-pipeline` READMEs, the two registers, the pipeline skills) was checked claim-by-claim
against current code. Result: the *mechanism* descriptions are almost all accurate; what has
rotted is the *state* descriptions — a wave of docs still describe the world before the
2026-08-24 Stage 0 run and pilot publish.

### B.1 Confirmed inaccuracies (fixed where mechanical — see Part E "DONE"; else reported)

| # | Doc | Claim | Reality | Status |
| --- | --- | --- | --- | --- |
| 1 | `content-pipeline/completed/README.md` | `validatePublishReadiness` "exported but not wired to any CLI or pipeline, because Phase 2 is not designed" | It has two callers: the orchestration skill's gate 1 and `scripts/publish-product.mjs:122` (`checkDraftStillReady`); ADR-053 designed Phase 2 | **FIXED** |
| 2 | `docs/pipeline-prep/README.md:46` | six-stage vocabulary "`queued` through `published`" | Sixth stage is `awaiting-publish`; `published` is not a stage | **FIXED** |
| 3 | `content-pipeline/incoming/README.md:23` | image provenance "beside them" | Rides *inside* each suggestion (ADR-056 decision 2) — the same file said so correctly 18 lines later | **FIXED** |
| 4 | `content-pipeline/README.md:21` + `docs/pipeline-prep/README.md` step 2 | Draft A "images stay empty" | Rule A3 retired by ADR-056: suggestions are carried populated, all `confirmed: false` | **FIXED** |
| 5 | `docs/decisions/README.md` (ADR-051 row) | "Still not built: `data/stone-terms.json` and the phase-three similarity calibration" | `stone-terms.json` seeded 2026-08-24; calibration has measurements, threshold deliberately unset | **FIXED** |
| 6 | `content-pipeline/drafts/README.md` | "`data/products.json` holds P001–P049"; "P642 is an expectation … the export has not arrived" | Catalogue holds 60 (11 migrated actives); all of P101–P642 assigned | **FIXED** |
| 7 | `docs/pipeline-prep/README.md:106` | "end to end short of publish", 11 records "as `status: "draft"`" | All 11 published `active` on 2026-08-24 (commit `3050b76`) | **FIXED** |
| 8 | ADR-053:231, ADR-051:330–333 | "No Draft A object has ever been created in this repository" / "stone-terms.json does not exist" | 11 real drafts in `completed/`; the file exists | REPORTED — ADR bodies are immutable; needs owner-approved addenda |
| 9 | ADR-056:176–178, ADR-054:270+364 | "No real batch has been prepared — the Phase B export has not arrived" | 542 records queued; ADR-054's *later* addendum acknowledges it, so ADR-054 self-contradicts | REPORTED — addendum territory |
| 10 | ADR-051 addendum:280 | "one of the **ten** fixed slugs" | Eleven since ADR-055 | REPORTED — addendum territory |
| 11 | `.claude/skills/draft-a-skills.md:132` | "`data/products.json` holds P001–P049" | 60 records — this line feeds fresh-id selection | REPORTED — skill files steer extraction; edit needs owner sign-off |
| 12 | `docs/pipeline-prep/drafts-in-progress.md:43` | example row `~~P050~~` says stone-terms "does not exist yet"; row says "delete when the first real one is added" | Deletion is blocked: `lib/prepare-migration-batch.test.ts:1538-1541` pins the row's presence | REPORTED — must be paired with that test's fix (finding I-2) |
| 13 | `docs/design/IMAGES.md:8–22` | "55 files", "every one of the 49 products" | 69 files, 60 products, 13 migrated `P1xx*` photos | REPORTED — MINOR |
| 14 | ADR-056:182 | provenance count "is `0` today" | 11 records carry `migrationProvenance` | REPORTED — dated "today", harmless |
| 15 | ADR-054:305, both `content-pipeline` READMEs, `incoming/README.md` | Stage 0 presented as a runnable command with no spent-override caveat | Every invocation (incl. `--dry-run`) now refuses, correctly — documented only in `pipeline-prep/README.md:113` | REPORTED — MINOR |
| 16 | `RESULT-2026-08-24-phase2-pilot-batch.md:10,121` | "publish-product.mjs was not run" | It ran later the same day | REPORTED — dated record, convention is not to rewrite RESULTs |

Clean checks: **no doc presents the retired `material-phrases.json` allow-list as current** (all
mentions are explicit negations; the file does not exist); the **always-propose-always-confirm**
design is consistent everywhere (the only deviation was #4, now fixed); the **six-stage
vocabulary** is identical everywhere (the only deviation was #2, now fixed); the
**gift-hampers / surfaced-vs-pending split** is consistent across `types/product.ts`, both
validators, Stage 0 and ADR-055, cross-checked mechanically by `lib/category-vocabulary.test.ts`.

### B.2 Register ↔ catalogue reconciliation — clean

`drafts-in-progress.md` holds 531 rows (P101–P642 minus the 11 published);
`products-completed.md` holds exactly those 11; 531 + 11 = 542 = the manifest count; no id in
both; names match `data/products.json`; all 60 catalogue records `active`, zero `draft`;
`EXPECTED_PRODUCT_COUNT = 60` matches; keyword map `productCount: 60` matches.

### B.3 known-issues-post-publish.md — verified accurate, both entries correctly open

- **KI-001 (P106/P120 shared photo): accurate and still open.** Verified:
  `public/products/P106.webp` and `P120.webp` are byte-identical, sha256
  `e57b5878…0650`, matching the recorded hash character for character. **New fact from this
  audit:** the same photograph is also queued P160's `main.webp`, and the pattern is systemic —
  see Part A.3 (17 duplicate main-image groups; 10 of 11 published products have queued twins).
- **KI-002 (P121 at ₹99): accurate as written; marking it resolved is the owner's call.**
  Verified: P121 is `{price: 99, mrp: 99, cost: 59}` — the ₹99/₹59 split is 3/8 exactly as the
  entry describes, and the governing rule ("price = each product's reference price") was
  followed; the ₹59 figure in the batch summary was the tally that was wrong. On the earlier
  established reading this is not a real defect and can be marked
  `resolved (2026-08-24)` — **flagged for explicit owner confirmation, deliberately not marked
  resolved in this audit.**

---

## Part C — Dead code / redundancy / hardcoded assumptions / fixture ids

### C.1 Dead code — one confirmed-dead item, deleted; everything else referenced

- **`scripts/migration/` — CONFIRMED DEAD, removed.** Empty directory, never tracked
  (`git ls-files` empty, no commits), zero references repo-wide (`grep -rn "scripts/migration"`
  over code, docs, skills and `package.json` returns nothing). Distinct from the live
  `data/migration/` path. Deleted (`rmdir` — it was untracked, so no diff).
- Everything else checked is referenced and stays: the two `scripts/fixtures/*.jsonl` (≈19 call
  sites in `lib/prepare-migration-batch.test.ts`), `calibrate-similarity.mjs` (`package.json`,
  sole consumer of six `lib/content-similarity.ts` exports), `backfill-keyword-map.mjs` (three
  code importers), `validate-draft-a.mjs` (two code importers + README commands),
  `material-phrase-candidates.md` and `similarity-scores-all-pairs.json` (documented reference
  artefacts — the latter is *written* by the calibration script and documented as "nothing reads
  it", deliberately), and the batch-level downloader CSVs + 542 `_complete` markers (inert
  upstream artefacts, documented as such in the Stage 0 reconciliation RESULT, untracked).
- `data/stone-terms.json` has **zero programmatic readers** — by design: it is consulted by the
  extraction *skill*, not by code, and `validate-draft-a.mjs` says in code that it does not read
  it. Not dead; noted so nobody "cleans it up".
- ~24 exports across the pipeline modules have no caller outside their own file (e.g.
  `parseProductId`, `sourceImagePath`, `insertRegisterRows`, the five path helpers in
  `publish-product.mjs`). None is dead logic — all are used internally; the surface is merely
  over-exported. MINOR, listed for completeness, no action taken.

### C.2 Hardcoded assumptions vs the 60 → ~591 growth

- **`EXPECTED_PRODUCT_COUNT = 60` is confirmed still the only hardcoded catalogue *count*** —
  an exhaustive search for length comparisons against 49/60/11/122/591 found nothing else in
  scope; catalogue-reading tests use open-ended assertions. Deliberate, per ADR-053's addendum.
- **But the "only one line to update" claim is no longer the whole story:**
  `lib/prepare-migration-batch.test.ts:1530-1541` asserts the real register's **exact id set**
  (all 542 ids minus a hardcoded literal list of the 11 published pilot ids, plus the `~~P050~~`
  example row). Publishing *any* product from the next sub-batch makes the gate fail until this
  literal is hand-edited — ~531 more edits (or 5 bulk edits) over the remaining migration. The
  single largest maintenance liability found; it is a snapshot of mutable state written as a
  literal. Needs an owner decision on approach (derive the expected set from
  `data/products.json` + the batch manifest at run time, or drop the exact-set assertion for an
  invariant-based one). The `~~P050~~` example-row deletion (B.1 #12) is coupled to the same
  test.
- **Stage 0's spent override is correct and must stay spent.** `CATALOGUE_MAX_ID_CEILING = 49`
  now refuses every invocation; that is the documented, designed end state, and **no Stage 0
  re-run is needed for the remaining 5 sub-batches** — all 542 ids are already assigned and
  extraction sub-batches just consume the existing queue. The real risk is someone "fixing" the
  refusal by raising the ceiling. Side effect worth knowing: the CLI happy path is no longer
  covered by any test (the three CLI tests now only assert the refusal), and
  `checkDraftStillReady` — the last gate before the irreversible publish — has no direct test.
- The batch id `2026-08-23-batch-01` appears in code only inside one comment and one opaque
  fixture string — no drift risk. The eleven-slug category vocabulary is cross-checked
  mechanically in one test — safe.
- **Tuned-on-49 numbers to review before 531 migrated products land** (owner decisions, not
  bugs): `validate-products.mjs` price band `MIN_PRICE 25 / MAX_PRICE 25000`, discount ceilings
  `60/80%`, description length `150–300` words. `MAX_PRICE` in particular hard-fails any
  genuine high-value piece.
- `scripts/calibrate-similarity.mjs:236-237` pins its control pair to `P002`/`P003` **with a
  positional fallback** (`?? products[1]`) — if either id is ever retired the control silently
  changes meaning instead of failing.
- `validate-products.mjs:82` uses `/^P\d{3}$/` (exactly three digits) while Stage 0 uses
  `/^P(\d{3,})$/` — inconsistent only past P999; harmless at P642. MINOR.

### C.3 Test-fixture ids vs live territory (P001–P049 + P101–P642)

`scripts/fixtures/*.jsonl` contain zero `P###` literals (ids are assigned by the script) —
clean. The **P9xx convention is followed for every subject-under-test** (P900–P905 across seven
test files; P906–P998 unused headroom). `lib/prepare-migration-batch.test.ts`'s P101–P642
literals are legitimate — they assert what the assignment algorithm must produce. Real-catalogue
lookups (`catalogue.find(p => p.id === "P001")` style) are legitimate by the stated convention.

**Stragglers — fabricated fixtures carrying live ids (flagged, not changed, per the audit's
mandate):**

1. `lib/content-similarity-gate.test.ts:31,33,272` — fabricated `NEIGHBOURS`/`CATALOGUE`
   entries as `P001`/`P002`. Highest priority: this is the exact failure class the file's own
   comment (its earlier `P050` collision) was written to prevent, and a synthetic id colliding
   with a real one in the similarity population *silently shrinks the comparison set* rather
   than failing.
2. `lib/keyword-collision-check.test.ts:48-53,179-180` — fixture map on `P001/P002/P003/P009`,
   with `P001`'s *real* primary keyword string, blurring the synthetic/real boundary.
3. `lib/publish-product.test.ts:123,168,251` — fabricated neighbours `P001`/`P002` (hermetic
   temp-repo catalogue).
4. `lib/draft-a-to-product.test.ts:599-600` — fixture keyword map on `P001`.
5. `lib/product-gallery.test.tsx:39,52` — fabricated entries as `P010`/`P002` (storefront
   scope, lowest priority).

All five are hermetic today (fixtures passed explicitly, so no live collision is currently
triggered); the risk is a refactor that lets them meet the real catalogue. Renaming to P9xx is
a small mechanical change but touches test semantics in five files — left for a follow-up the
owner approves.

---

## Part D — Image restructure proposal (PROPOSAL ONLY — nothing here is implemented)

Written to be implementable by a follow-up prompt verbatim, once the owner approves. Each item
is independent; approve any subset.

### D1 — Co-locate images with their product (one directory per product)

Merge each `odoo-{originalId}/` directory into its product's directory:

```
incoming/2026-08-23-batch-01/
├── manifest.json, needs-attention.md, draft-a-input.jsonl, *.csv   (unchanged)
└── P198/
    ├── raw-block.json
    ├── images.json          (the downloader's per-product manifest, moved along)
    └── raw/                 (main.webp, extra-N.webp, variant-*.webp, moved along)
```

- Implemented as a one-off `scripts/`-style `.mjs`: for each of the 542 raw blocks, read
  `sourceNotes.workingId`, `git`-safe move `odoo-{id}/raw` → `PNNN/raw` and `images.json`
  alongside, rewrite every `images.*[].sourceFile` from
  `{batch}/odoo-{id}/raw/{file}` to `{batch}/PNNN/raw/{file}` in the raw block (and in any
  extracted draft under `drafts/`, of which there are currently none), drop the inert
  `_complete` markers, then verify **every rewritten `sourceFile` resolves to a file on disk**
  (same check Stage 0 ran) and that file *counts* match before/after. Safe because — verified
  in Part A — **no code reads `sourceFile` after Stage 0**; it is human-facing provenance, and
  `sourceNotes.workingId`/`originalId` remain in the raw block so the odoo identity is not lost.
- Payoff: "everything for product X" is one directory at every pre-publish stage; the batch
  root drops from 1,090 entries to 548; no more raw-block-open-to-find-the-workingId hop.

**Grouping choice — by product, not by category or extraction sub-batch.** Category is mutable
until review (P123 is queued with `category: null`) and sub-batch membership is not decided
until each sub-batch starts, so either would mean re-moving files mid-review. Sub-batch
grouping is better served by a *listing* (a `sub-batch-N.md` naming its product ids) than by a
directory move.

### D2 — A real per-product lifecycle: staging empties as products ship

On publish, move the product's whole staging directory out of `incoming/`:

```
publish PNNN  ⇒  content-pipeline/completed/PNNN.json           (already happens)
                 content-pipeline/completed/PNNN/               (NEW: raw-block.json,
                                                                 images.json, raw/*)
```

- `incoming/{batch}/` then *is* the work-remaining list — its product-directory count is the
  531 → 0 countdown — and `completed/` becomes the full provenance bundle (draft + raw block +
  source images) per shipped product. An abandoned product's directory simply stays in
  `incoming/` and is visibly stale, instead of being indistinguishable from pending work.
- The id-reservation rule survives untouched: a file named after the id still exists at every
  moment (raw block → completed bundle → the active record in `data/products.json`).
- Cheapest implementation: extend `scripts/publish-product.mjs` (it already does the
  draft-JSON move) with the directory move; it must locate the raw block by scanning
  `incoming/*/PNNN/` so it stays batch-agnostic. Alternative if the owner prefers publish to
  stay minimal: a separate `npm run archive:staging PNNN` run alongside — but a step that can
  be forgotten will be, 531 times.
- **Backfill:** apply the same move to the 11 published pilot products' leftovers (their
  raw blocks still claim `stage: "queued"` in `incoming/`, and their image dirs are orphans).

### D3 — Keep all 531 products' images staged from day one; fix the durability instead

**Recommendation: do NOT defer or re-download images per sub-batch.** The download already
happened; deleting and re-fetching per batch saves only ~98 MB of local disk and re-introduces
a dependency on morchadijewels.com staying up for the whole migration — the one thing this
pipeline should not assume. The actual problem is that these ~1,000 files are the **sole copy,
untracked, on one machine** (BLOCKING-1 in Part E). Owner options, cheapest first:

1. **One-time external backup now** (zip `content-pipeline/incoming/` to a drive/cloud), plus a
   re-zip after each sub-batch's review edits. No repo change.
2. **Track `completed/` in git** (the middle option `docs/pipeline-prep/README.md` already
   proposes): with D2 in place, each product's source images enter git *at publish* — exactly
   when their claims go live — growing the repo only by what is actually shipped (~181 KB/product
   average). Unpublished candidate data stays out of history, preserving the original
   untracked-recommendation's rationale.
3. Track all of `incoming/` (or via Git LFS) — full durability, but ~98 MB of unreviewed
   third-party data in history; runs against the repo's own reasoning. Not recommended.

Recommended combination: **1 now, 2 with D2.**

### D4 — The `confirmed` boolean is sufficient as *data*; the workflow around it needs a report

Keep the ADR-056 shape unchanged — it is correct, consistently enforced, and mirrors the
attribute pattern. What does not scale is *finding* work with `grep` across ~1,064 remaining
suggestions. **Flagged as warranted (not built, out of scope):** a read-only
`report:images` script in the spirit of `needs-attention.md`, printing per batch/sub-batch:
each product's suggestions with confirmed status; **duplicate-hash groups across staged files**
(this audit found 72 groups / 171 files, 17 of them main-image groups — every one is a future
KI-001 conversation the reviewer should walk into knowing); confirmed paths whose
`public/products/` file is missing (pre-empting the validator); and orphaned staging dirs. A
second candidate: a `stage-images PNNN` helper that performs the manual `cp` of confirmed
`sourceFile`s to their `path`s — 531 products ≈ 1,062 hand-copies otherwise, each a chance for
a wrong-file-under-right-name mistake that **no gate can catch** (the validator checks
existence, not content).

### D5 — Document the copy step (smallest possible fix, applied)

The staging → `public/products/` copy was performed by nothing and described nowhere except a
dated RESULT file; workflow step 7 said only "assigned by hand". One sentence was added to
`docs/pipeline-prep/README.md` step 7 naming the destination and the validator that checks it
(see DONE list). Everything beyond that sentence is D4's tooling question.

---

## Part E — Prioritised findings

### DONE — mechanical fixes applied in this audit (all doc/cleanup, zero behaviour change)

| # | Fix |
| --- | --- |
| D-1 | `content-pipeline/completed/README.md` — replaced the stale "validatePublishReadiness is not wired to any CLI" paragraph with its two real callers |
| D-2 | `docs/pipeline-prep/README.md` — stage vocabulary corrected `published` → `awaiting-publish` |
| D-3 | `content-pipeline/incoming/README.md` — image provenance "beside them" → "inside them" (ADR-056) |
| D-4 | `content-pipeline/README.md` + `docs/pipeline-prep/README.md` step 2 — retired "images stay empty" replaced with the unconfirmed-suggestions rule |
| D-5 | `docs/decisions/README.md` ADR-051 row — stone-terms.json seeded / calibration measured-not-thresholded |
| D-6 | `content-pipeline/drafts/README.md` — catalogue contents and the P101–P642 reservation brought current |
| D-7 | `docs/pipeline-prep/README.md` — "end to end short of publish" paragraph brought current (publish ran 2026-08-24) |
| D-8 | `docs/pipeline-prep/README.md` step 7 — the actual image-copy step documented (destination + verifying gate) |
| D-9 | `scripts/migration/` — empty, untracked, zero-reference directory removed (evidence in C.1) |

### BLOCKING — would halt or break the next 5 batches if unaddressed

| # | Finding | Detail |
| --- | --- | --- |
| B-1 | **The only copy of 531 unpublished products' photographs is untracked, on one machine.** | `content-pipeline/incoming/` (98 MB, 1,075 webp) is gitignored by design; the upstream is the old site, which the migration exists to replace. A lost working directory strands all 5 remaining batches with no mechanical recovery. Mitigation options in Part D3 (backup now; track `completed/` with D2). |
| B-2 | **The gate breaks on the very next publish.** | `lib/prepare-migration-batch.test.ts:1530-1541` hardcodes the real register's exact id set (542 ids minus the 11 published, plus the example row). Every future publish requires hand-editing this literal or the suite fails — contradicting the documented "EXPECTED_PRODUCT_COUNT is the only line to update". Loud failure, not corruption. Fix direction (owner to pick): derive the expected set from `data/products.json` + the batch manifest, or assert invariants instead of the exact set. The `~~P050~~` example-row deletion (its own instruction says to delete it) is coupled to the same test. |

No data-corruption path was found: id assignment, register append, keyword-map regeneration and
the publish flip all re-derive their guards from the files at run time.

### IMPORTANT — real friction or real risk, not corruption (owner decisions)

| # | Finding |
| --- | --- |
| I-1 | **Shared photographs are systemic, not a P106/P120 one-off**: 72 duplicate-hash groups (171 files) across staging; 17 duplicate *main*-image groups; 10 of the 11 published products have a byte-identical main queued under another id (P106/P120 ≡ queued P160; P108 ≡ P135; P115 ≡ P141 ≡ P167; …full list in A.3). Each is a future KI-001 decision — and possibly a duplicate listing to curate rather than migrate. |
| I-2 | **~1,062 manual image copies with no tooling and no content check** — the validator verifies a file exists, not that it is the right file. D4 flags a report/copy helper as warranted. |
| I-3 | **Post-publish staging leftovers**: the 11 published products' raw blocks still sit in `incoming/` claiming `stage: "queued"`, with their image dirs orphaned. D2 proposes the lifecycle fix + backfill. |
| I-4 | **KI-002 (P121 ₹99)**: verified correct as priced; ready to be marked `resolved` — awaiting the owner's explicit confirmation (deliberately not done here). |
| I-5 | **Stage 0's CLI happy path is no longer covered by any test** (the spent override makes the three CLI tests assert only refusal), and `checkDraftStillReady` — the last gate before irreversible publish — has no direct test. |
| I-6 | **Fixture-id stragglers on live ids** (P001/P002/P003/P009/P010) in 5 test files, worst in `lib/content-similarity-gate.test.ts` where an id collision *silently shrinks* the similarity population — the exact defect class its own comment records. Rename to P9xx (P906+ free). |
| I-7 | **Validator bands tuned on the 49 hand-written products** — `MAX_PRICE 25000`, discount 60/80%, description 150–300 words — should be reviewed before 531 migrated records hit them. |
| I-8 | **ADR staleness needing addenda** (bodies are immutable): ADR-051/053 "no Draft A object exists / stone-terms.json does not exist", ADR-054/056 "no real batch has been prepared", ADR-051 addendum "ten slugs". Plus `.claude/skills/draft-a-skills.md:132` "P001–P049" (skill edit → owner sign-off). |
| I-9 | **`Latest.xlsx` tracked vs the untracked recommendation** — already flagged in `docs/pipeline-prep/README.md`; still awaiting the owner's call, restated here because the same decision governs D3's durability options. |

### MINOR — cosmetic / documentation / future-proofing

| # | Finding |
| --- | --- |
| M-1 | `docs/design/IMAGES.md` file counts stale (55 → 69 files; 49 → 60 products). |
| M-2 | Stage 0 still presented as a runnable command without a spent-note in ADR-054 and both `content-pipeline` READMEs. |
| M-3 | `calibrate-similarity.mjs` control pair pinned to P002/P003 with a *positional* fallback that silently changes meaning if either retires; calibration report/scores are still the 49-product run. |
| M-4 | `PRODUCT_ID` regex `\d{3}` (validator) vs `\d{3,}` (Stage 0) — diverges only past P999. |
| M-5 | Variant-slug vs extra-number path collision (`PNNN-2.webp`) unguarded in `buildImageSuggestions` — zero occurrences in the real batch (verified), theoretical only. |
| M-6 | Similarity reports (`PNNN-similarity.json`) stay in `drafts/` after publish by design — 11 now orphaned beside no draft; consider filing them with D2's bundle. |
| M-7 | `validate-draft-a.mjs` is the only pipeline entry point without an `npm run` alias; ~24 over-exported internal functions (C.1). |
| M-8 | `data/stone-terms.json` has no programmatic reader (by design — skill-consulted); noted to prevent a future "cleanup". |
| M-9 | `RESULT-2026-08-24-phase2-pilot-batch.md` pre-publish claims are now dated; convention keeps RESULTs unrewritten. |
| M-10 | Out of pipeline scope, observed in passing: `lib/admin-order-detail.test.ts` ("carries no cost figure of any kind") is flaky under the full parallel run (DB-fixture contention) — failed once in the baseline gate, passes in isolation and on re-run. |

## Gate

Full five-command gate (`npm run typecheck && npm run lint && npm run test:run &&
npm run validate:products && npm run build`) run after the mechanical fixes: **GREEN** —
typecheck clean, lint clean, **1769/1769 tests across 87 files**, `validate:products` PASS
(Active 60 / Draft 0), build 86 static pages. A baseline run before any change hit only the
M-10 flake (1 admin test of 1,769, passes in isolation and did not recur); all changes in this
audit are documentation/cleanup, touching no executable code path.

---

## Resolved — 2026-08-24, owner-approved restructure (same day, follow-up prompt)

The owner approved the audit's proposals item by item; the follow-up prompt implemented them
as one coordinated restructure ([ADR-057](../decisions/ADR-057-staging-colocation-and-completed-tracking.md),
BUILD_LOG row 86). Status of each finding:

| Finding | Status |
| --- | --- |
| **B-1** (sole copy of staged images) | **Resolved (mitigated).** External backup `content-pipeline-incoming-backup-2026-08-24.tar.gz` (84 MB, 4,336 entries, all 1,075 webp) written to the Codespace home directory *before* the restructure; the owner must copy it off the Codespace for it to count — see the prompt's report. Structurally, D3 (below) puts every *published* product's images into git from now on |
| **B-2** (hardcoded register id set in `lib/prepare-migration-batch.test.ts`) | **Resolved.** The test now derives the expected set at run time — the contiguous block from P101 to the register's own highest row, minus `data/products.json` ids and rejected-table ids. Publishing no longer breaks the gate; `EXPECTED_PRODUCT_COUNT` is again the only line a publish updates. The coupled `~~P050~~` example row was deleted from `drafts-in-progress.md` per its own instruction (B.1 #12 closed) |
| **D1** (co-locate images per product) | **Implemented.** `scripts/colocate-staged-images.mjs` merged all 542 `odoo-*` dirs into their `PNNN/` dirs, rewrote 1,075 `sourceFile` strings (all verified resolving on disk afterward), dropped 542 `_complete` markers. "No code reads `sourceFile` after Stage 0" was re-verified against the codebase directly before the run. Batch root: 1,090 → 548 entries |
| **D2** (staging empties on publish + backfill) | **Implemented.** `scripts/publish-product.mjs` now archives `incoming/*/PNNN/` → `completed/PNNN/` on publish (batch-agnostic scan; fresh-path products without staging publish unchanged; three new tests). The 11 pilot products' orphaned bundles were backfilled to `completed/` — I-3 closed. Batch root now 537 = 531 queued + 6 batch files |
| **D3** (durability) | **Implemented as recommended (option 1 now + option 2).** Backup above, plus `.gitignore` narrowed: `completed/` fully tracked, `incoming/` and `drafts/` untracked as before |
| **D4** (image report) | **Implemented.** `scripts/report-images.mjs` / `npm run report:images`: per-product confirmation counts, cross-product duplicate-hash groups (main-image and spans-published groups flagged), confirmed-but-missing-under-`public/` paths, orphaned staging entries. First run post-restructure: 531 products all fully unconfirmed, **38 cross-product duplicate groups, 18 involving a main image, 11 spanning a published product** (KI-001's hash `e57b5878…` now visibly clusters P106+P120+queued P160), zero missing paths, zero orphans. (The audit's 72-group figure counted within-product duplicates too; the report deliberately shows only cross-product clusters) |
| **I-3** (post-publish leftovers) | **Resolved** via D2's backfill |
| **I-4** (KI-002) | **Resolved.** Owner confirmed ₹99 correct; `known-issues-post-publish.md` updated to `resolved (2026-08-24)` |
| **I-6** (fixture ids on live territory) | **Resolved.** All five files moved to P9xx synthetics: P001→P906, P002→P907, P003→P908, P009→P909, P010→P910, `lib/content-similarity-gate.test.ts` included |
| **I-8, skill-file part** (`draft-a-skills.md:132`) | **Resolved.** Now states 60 published (P001–P049 + 11 migrated), 542 assigned, 531 still queued; its two example `sourceFile` strings updated to the co-located layout. The ADR-addenda part of I-8 remains open (owner sign-off per addendum still needed) |

Not touched, by explicit instruction: **I-7** (validator threshold review — owner judgement),
the **duplicate-photo curation question** (which clusters are true duplicates vs distinct
designs — a separate report), **I-5**, **I-9**, the ADR addenda of I-8, and all MINOR items.
One related observation from the implementation, reported rather than fixed:
`scripts/prepare-migration-batch.mjs` still *writes* the old `odoo-{id}/` sibling layout; it is
permanently spent for this migration, but a future export batch should fold co-location into
Stage 0 (noted in ADR-057).
