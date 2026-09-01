# Pipeline prep

## Purpose

Raw extraction output from bulk exports of migrated listing content — the working material the
owner reads *before* deciding anything. Files here answer "what does the source data actually
say, and how often", never "what should we do about it".

Nothing in this folder is a decision, a policy, or an input any code reads. In particular:

- A candidate list here is **not** an allow-list, and there is no longer an allow-list for it to
  become. [ADR-051's addendum](../decisions/ADR-051-draft-a-content-pipeline.md#addendum-2026-08-23--the-validator-exists-and-the-allow-list-gate-does-not)
  retired the pre-approval gate: every candidate phrase goes to owner review whatever any curated
  file says, `data/material-phrases.json` was never built and is not a prerequisite for anything,
  and `scripts/validate-draft-a.mjs` reads neither it nor `data/stone-terms.json`. These files are
  raw extraction output kept for reference.
- Phrases are recorded verbatim, grouped by exact string equality only. No fuzzy matching, no
  semantic merging, no normalisation, no correction of the source text.
- A claim appearing here has **not** been checked against the honesty rules of
  [`ADR-018`](../decisions/ADR-018-honest-product-description.md) or
  [`ADR-035`](../decisions/ADR-035-catalogue-content-pass.md).
- Rows the extraction could not treat as product content are listed, never silently dropped.

Where a file draws a boundary — what counted as a phrase, what counted as non-product — it
states the rule it used, so the owner can overrule it rather than guess at it.

## Naming convention

| Kind | Pattern | Example |
| --- | --- | --- |
| Candidate list | `<subject>-candidates.md` | `material-phrase-candidates.md` |
| Rows held back for review | `<reason>-rows.md` | `non-product-rows.md` |
| Observations about a source file | `source-data-notes.md` | `source-data-notes.md` |
| Manual register of pipeline state | `<subject>-<state>.md` | `drafts-in-progress.md` |

## Current contents

| File | What it holds |
| --- | --- |
| [`material-phrase-candidates.md`](material-phrase-candidates.md) | Every material, plating and stone phrase found in `Latest.xlsx`, verbatim, with occurrence counts, an unverified keyword category guess, an example in context, and the rows to spot-check |
| [`non-product-rows.md`](non-product-rows.md) | The rows excluded from that scan — two payment-policy notices and fifty empty rows — plus eleven short rows that were kept but read as titles rather than descriptions |
| [`source-data-notes.md`](source-data-notes.md) | Data-quality noise found while scanning, and honesty-relevant patterns outside the material question (karat claims on plated items, `American Diamond`, `skin-safe`, prices in prose) — flagged, not acted on |
| [`fresh-listing-image-prompt.md`](fresh-listing-image-prompt.md) | The owner-authored companion prompt for the fresh intake path — turns product photographs into the text the Draft A skill reads. Forbids the descriptive pass from naming any metal or stone (`gold-toned`, never `gold`) |
| [`similarity-calibration-report.md`](similarity-calibration-report.md) | Phase-three calibration measurements over the 49 live products. **Measurements only — no threshold is set by it**, and ADR-051's "not calibrated" state is unchanged |
| [`similarity-scores-all-pairs.json`](similarity-scores-all-pairs.json) | The raw pairwise scores behind that report. Nothing reads it |
| [`drafts-in-progress.md`](drafts-in-progress.md) | Manual register of Draft A objects currently in `content-pipeline/drafts/`, with the six-stage vocabulary — `queued` through `awaiting-publish`, per [ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md) — and the retired-id list |
| [`batch-01-confirmation-groups.md`](batch-01-confirmation-groups.md) | Every `attributes` candidate across all `extracted`-stage Draft A objects from batch `2026-08-23-batch-01`, grouped by exact `(label, value)` equality per skill rule 17, so the owner can batch-confirm identical candidates instead of reviewing each product from scratch |
| [`known-issues-post-publish.md`](known-issues-post-publish.md) | The durable record of issues the owner has **explicitly accepted publishing with**, each with evidence, the acceptance decision and an open/resolved status. The post-publish review pass works through this file |
| [`products-completed.md`](products-completed.md) | Manual register of drafts whose product has been published into `data/products.json` |

The source workbook `Latest.xlsx` is an owner-supplied export sitting untracked at the repo
root. It is not referenced by any code and is not required to read these files.

## The manual workflow: raw content to published product

Every step below is done by hand. **There is no orchestration, no queue, and no automation
connecting any two steps** — where a script exists it is invoked manually, and where one does not
the step is a person editing a file. The pipeline's three phases and their build state are
[ADR-051 decision 5](../decisions/ADR-051-draft-a-content-pipeline.md); this section is the
operating procedure for the part of it that can be run today.

| # | Step | Done by | Exists? |
| --- | --- | --- | --- |
| 0 | **Stage 0, migration path only.** `node scripts/prepare-migration-batch.mjs <export.jsonl> <batch-id>` validates the Phase B JSONL export, refuses bad records into `needs-attention.md`, assigns real product ids from **P101**, transforms the Odoo variant and image shapes, and writes one `raw-block.json` per queued product into `content-pipeline/incoming/`. It runs **no extraction**. Stage `queued` ([ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md)) | Script | ✔ |
| 1 | **Raw content** is assembled — a listing's original copy from the `Latest.xlsx` export (`sourceType: "migrated"`), or photographs put through [`fresh-listing-image-prompt.md`](fresh-listing-image-prompt.md) plus an `<owner-stated-facts>` block (`sourceType: "fresh"`) | Owner | ✔ |
| 2 | **Draft A skill** ([`.claude/skills/draft-a-skills.md`](../../.claude/skills/draft-a-skills.md)) converts it to one structured object. Every material, treatment and stone value is a candidate carrying the exact source phrase it came from; prices are quarantined to `pricing.referencePrice` as a string; image suggestions are carried through unconfirmed — `confirmed: false` on every entry ([ADR-056](../decisions/ADR-056-image-confirmation-provenance-and-draft-similarity.md)) | Skill, run by hand | ✔ |
| 3 | **Saved as `content-pipeline/drafts/PNNN.json`** — one object per file, filename matching the object's own `productId`. On the migration path the id was already assigned at step 0 and the draft inherits it; on the fresh path it is still chosen by hand, above the migrated range. **P050–P100 are retired** | Owner | folder ✔, id-assignment code ✔ **on the migration path only** |
| 4 | **Validated:** `node scripts/validate-draft-a.mjs content-pipeline/drafts` — structure and provenance, including the check that every `quotedPhrase` appears verbatim in `sourceNotes.rawContent` | Script | ✔ |
| 5 | **Row added to [`drafts-in-progress.md`](drafts-in-progress.md)** at stage `extracted`. On the migration path the row already exists at `queued` from step 0 and is advanced by hand instead | Owner | ✔ |
| 6 | **Owner reviews and confirms** each candidate against its quoted source phrase, flipping `confirmed` to `true` one attribute at a time. Stage moves `in-review` → `confirmed`. Nothing bypasses this step; there is no auto-trusted path | Owner | ✔ |
| 7 | **Price and images assigned by hand.** Stage `priced-and-shot`. Confirming an image means flipping its suggestion's `confirmed` to `true` in the draft, and deleting suggestions that are declined. **The copy from the staged `sourceFile` to the path under `public/products/` is no longer yours to remember**: `npm run stage:images -- PNNN` performs it, and step 10's publish performs it again for whatever is still outstanding ([ADR-074](../decisions/ADR-074-publish-stages-its-own-photographs.md)). It used to be a hand-typed `cp` that no script performed, and skipping it is how 206 products came to ship a generated placeholder over a real photograph. `npm run validate:products` now verifies that the file at each confirmed path **is** the file the record stages, not merely that something is there. This sits *between* the two validator passes, which is why a value that fails the first check is required by the second | Script + Owner | ✔ |
| 8 | **Phase 2 orchestration** turns the confirmed draft into a `data/products.json` entry — the honesty rules of [ADR-018](../decisions/ADR-018-honest-product-description.md) and [ADR-035](../decisions/ADR-035-catalogue-content-pass.md), and the SEO metadata of [ADR-036](../decisions/ADR-036-product-seo-metadata-pass.md) | Skill ([ADR-053](../decisions/ADR-053-draft-a-to-product-orchestration.md)), run by hand | ✔ |
| 9 | **Owner approves** the finished product entry | Owner | ✔ |
| 10 | **Publish step** copies every confirmed photograph to the path the record claims ([ADR-074](../decisions/ADR-074-publish-stages-its-own-photographs.md)), flips the entry's `status` from `"draft"` to `"active"`, regenerates the keyword map, moves the file from `content-pipeline/drafts/` to `content-pipeline/completed/`, and archives the product's whole staging directory `incoming/{batch}/PNNN/` into `completed/PNNN/` ([ADR-057](../decisions/ADR-057-staging-colocation-and-completed-tracking.md)) — `node scripts/publish-product.mjs PNNN` ([ADR-052](../decisions/ADR-052-product-status-field.md)). The photograph is staged **before** anything is written, so a record whose confirmed photograph cannot be found refuses the publish rather than leaving a hole at the path | Script, run by hand | ✔ |
| 11 | **Row moved by hand** out of `drafts-in-progress.md` and into [`products-completed.md`](products-completed.md) | Owner | ✔ |

### Where this stops today

Every step now exists, and every one of them is still a person or a hand-run script — there is
no orchestration connecting any two steps. Two earlier gaps in this table have since closed:
Phase 2 orchestration was designed in [ADR-053](../decisions/ADR-053-draft-a-to-product-orchestration.md)
and first ran on real data on 2026-08-24, and the publish step is
`scripts/publish-product.mjs`. A `"draft"` product in `data/products.json` is invisible to
every public surface ([ADR-052](../decisions/ADR-052-product-status-field.md)), so a product
lands in the catalogue at step 8 and is published at step 10 as two separate decisions. One
gap remains:

- **Id assignment code, on the fresh path.** ADR-051 decision 4 requires `productId` to be set by
  pipeline code rather than by the model. `scripts/prepare-migration-batch.mjs` now does that for
  the Odoo migration ([ADR-054](../decisions/ADR-054-stage-0-migration-batch-preparation.md)), with
  a safety assertion that refuses to run if `data/products.json` has moved past P049. The **fresh**
  path still has no such code: a hand-made draft's number is chosen and typed by the owner, with
  the reservation rule (never reuse a rejected id) enforced by nothing but the
  [rejected-ids table](drafts-in-progress.md#rejected-ids).

`data/stone-terms.json` now exists, seeded 2026-08-24 with its first entry:
`"American Diamond" -> "cubic zirconia"`. The entry was added on the owner's explicit
confirmation of that mapping during the 11-product pilot-batch review (P106–P122
duplicate-title group), not curated by the pipeline on its own — the file is owner-curated by
design, and every future entry needs the same explicit confirmation. Its role is unchanged from
the skill's revised design: a HELPER that lets a matching stone candidate arrive as
`stoneSource: "known-trade-term"` instead of `"unverified-guess"`, never a gate — a phrase
absent from it still produces a candidate, and `scripts/validate-draft-a.mjs` still does not
read it. The shape is the flat trade-name-to-technical-value map that skill rule 3 describes,
matched by exact string equality on the trade name.

**The pipeline has now run on real data, end to end, publish included.** Step 0 ran for real on
2026-08-24 (542 records queued from `2026-08-23-batch-01`), the 11-product pilot group
(P106–P122, the duplicate-title ring group) went through extraction, owner review, pricing and
image assignment, and Phase 2 wrote all 11 into `data/products.json` as `status: "draft"`
([RESULT-2026-08-24-phase2-pilot-batch.md](../testing/RESULT-2026-08-24-phase2-pilot-batch.md)).
All 11 were then published the same day — `scripts/publish-product.mjs` flipped each to
`status: "active"`, filed their drafts into `content-pipeline/completed/`, and their rows moved
to [`products-completed.md`](products-completed.md); the accepted deviations are recorded in
[`known-issues-post-publish.md`](known-issues-post-publish.md).
Before that, one synthetic product was taken through the whole workflow in prompt 70 and removed
again ([RESULT-2026-08-23-content-pipeline-e2e.md](../testing/RESULT-2026-08-23-content-pipeline-e2e.md)).
Note that landing P106–P122 in the catalogue **spent the Stage 0 one-time override by its own
design**: `scripts/prepare-migration-batch.mjs` now refuses to run, correctly, because the
catalogue's maximum id is past P049. The already-queued raw blocks are unaffected; a future
export batch needs a new decision, not a loosened assertion.

## Tracking decision

Decided by the owner on 2026-08-24
([ADR-057](../decisions/ADR-057-staging-colocation-and-completed-tracking.md)), taking what an
earlier revision of this section called "the middle option": **`completed/` is tracked in
full**, while `incoming/` and `drafts/` stay untracked the way `.env.local` is. Unpublished and
unconfirmed product data — candidate claims nobody has approved, source text quoted out of a
third-party export, prices that are not real prices — never enters git history; the provenance
bundle behind a product (draft, raw block, source images) is committed at the moment of
publish, exactly when its claims go live.

`.gitignore` implements this as a contents-level ignore with exceptions, rather than ignoring
the directory outright:

```
/content-pipeline/*
!/content-pipeline/README.md
!/content-pipeline/drafts/
!/content-pipeline/completed/
!/content-pipeline/incoming/
/content-pipeline/drafts/*
!/content-pipeline/drafts/README.md
/content-pipeline/incoming/*
!/content-pipeline/incoming/README.md
```

The shape matters: git does not descend into an ignored *directory*, so `/content-pipeline/`
would make every negation below it dead and a fresh clone would have no folders at all.
Ignoring the contents and re-admitting the untracked folders' `README.md` files means the
structure and its explanation survive a clone; `completed/` has no ignore line at all, so
everything the publish step files there is tracked.

The durability of the ~1,000 still-queued source images in `incoming/` is handled outside the
repository: an external backup taken 2026-08-24, to be refreshed after each sub-batch's review
edits (audit finding B-1).

### One stale sentence above, flagged rather than rewritten

The Purpose section's closing line — *"The source workbook `Latest.xlsx` is an owner-supplied
export sitting untracked at the repo root"* — **is no longer true.** `Latest.xlsx` was committed
in `d6398d1` along with that prompt's other in-flight files. The sentence is left as written
because this section is an addition to an existing document rather than a rewrite of it, and
because the fix depends on a decision only the owner can make: untrack the workbook and restore
the sentence, or accept it as tracked and correct the sentence. A 115 KB binary export of
third-party listing copy is the same class of file this section recommends keeping out of git,
so the first is the consistent answer — but it is the owner's call, and it involves history that
is already written.
