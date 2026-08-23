# Pipeline prep

## Purpose

Raw extraction output from bulk exports of migrated listing content — the working material the
owner reads *before* deciding anything. Files here answer "what does the source data actually
say, and how often", never "what should we do about it".

Nothing in this folder is a decision, a policy, or an input any code reads. In particular:

- A candidate list here is **not** an allow-list. `data/material-phrases.json` is built by the
  owner *from* these files; it is never generated from them automatically.
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
| [`drafts-in-progress.md`](drafts-in-progress.md) | Manual register of Draft A objects currently in `content-pipeline/drafts/`, with the five-stage vocabulary and the retired-id list |
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
| 1 | **Raw content** is assembled — a listing's original copy from the `Latest.xlsx` export (`sourceType: "migrated"`), or photographs put through [`fresh-listing-image-prompt.md`](fresh-listing-image-prompt.md) plus an `<owner-stated-facts>` block (`sourceType: "fresh"`) | Owner | ✔ |
| 2 | **Draft A skill** ([`.claude/skills/draft-a-skills.md`](../../.claude/skills/draft-a-skills.md)) converts it to one structured object. Every material, treatment and stone value is a candidate carrying the exact source phrase it came from; prices are quarantined to `pricing.referencePrice` as a string; images stay empty | Skill, run by hand | ✔ |
| 3 | **Saved as `content-pipeline/drafts/PNNN.json`** — one object per file, filename matching the object's own `productId`. The id is the next unused number (**P050** today) and is assigned by pipeline code, never by the model | Owner | folder ✔, id-assignment code ✘ |
| 4 | **Validated:** `node scripts/validate-draft-a.mjs content-pipeline/drafts` — structure and provenance, including the check that every `quotedPhrase` appears verbatim in `sourceNotes.rawContent` | Script | ✔ |
| 5 | **Row added to [`drafts-in-progress.md`](drafts-in-progress.md)** at stage `extracted` | Owner | ✔ |
| 6 | **Owner reviews and confirms** each candidate against its quoted source phrase, flipping `confirmed` to `true` one attribute at a time. Stage moves `in-review` → `confirmed`. Nothing bypasses this step; there is no auto-trusted path | Owner | ✔ |
| 7 | **Price and images assigned by hand.** Stage `priced-and-shot`. This sits *between* the two validator passes, which is why a value that fails the first check is required by the second | Owner | ✔ |
| 8 | **Phase 2 orchestration** turns the confirmed draft into a `data/products.json` entry — the honesty rules of [ADR-018](../decisions/ADR-018-honest-product-description.md) and [ADR-035](../decisions/ADR-035-catalogue-content-pass.md), and the SEO metadata of [ADR-036](../decisions/ADR-036-product-seo-metadata-pass.md) | — | **✘ not designed** |
| 9 | **Owner approves** the finished product entry | Owner | ✔ |
| 10 | **Publish step** flips the entry's `status` from `"draft"` to `"active"` and moves the file from `content-pipeline/drafts/` to `content-pipeline/completed/` | — | **✘ no script; both halves are manual today** |
| 11 | **Row moved by hand** out of `drafts-in-progress.md` and into [`products-completed.md`](products-completed.md) | Owner | ✔ |

### Where this stops today

Steps 8 and 10 have no implementation, and steps 1–7 and 9–11 are people and hand-run scripts.
Three things named in this table do not exist and should not be assumed:

- **Phase 2 orchestration.** Not designed, per ADR-051 decision 5. Step 8 is a person writing a
  product record.
- **The publish script.** Nothing flips `status` and nothing moves a file. Both are `git mv` and
  an edit today. The `status` field it would flip **does** exist —
  [ADR-052](../decisions/ADR-052-product-status-field.md) added it, and a `"draft"` product in
  `data/products.json` is already invisible to every public surface — so a product can be landed
  in the catalogue at step 8 and published at step 10 as two separate commits.
- **Id assignment code.** ADR-051 decision 4 requires `productId` to be set by pipeline code
  rather than by the model. There is no such code, so the number is currently chosen and typed by
  the owner — with the reservation rule (never reuse a rejected id) enforced by nothing but the
  [rejected-ids table](drafts-in-progress.md#rejected-ids).

`data/stone-terms.json` also does not exist. Under the skill's revised "always propose, always
confirm" design its absence no longer blocks a run — every stone candidate simply falls back to
`stoneSource: "unverified-guess"` — but it means step 6 carries more weight on those candidates
than it eventually should.

**No Draft A object has ever been created in this repository.** The workflow above has not been
run end to end, and both registers are empty templates.

## Tracking recommendation — owner decision needed

`content-pipeline/` holds unpublished and unconfirmed product data: candidate claims nobody has
approved, source text quoted out of a third-party export, and prices that are not real prices.
The recommendation is to keep it **untracked**, the way `.env.local` is — working files, not
committed history.

`.gitignore` implements that as a contents-level ignore with three exceptions, rather than
ignoring the directory outright:

```
/content-pipeline/*
!/content-pipeline/README.md
!/content-pipeline/drafts/
!/content-pipeline/completed/
/content-pipeline/drafts/*
!/content-pipeline/drafts/README.md
/content-pipeline/completed/*
!/content-pipeline/completed/README.md
```

The shape matters: git does not descend into an ignored *directory*, so `/content-pipeline/`
would make every negation below it dead and a fresh clone would have no folders at all. Ignoring
the contents and re-admitting the three `README.md` files means the structure and its
explanation survive a clone while none of the working data does.

**This is a proposal, not a settled rule, and the owner should decide it.** The argument the
other way is real and worth stating rather than burying:

| Untracked (recommended) | Tracked |
| --- | --- |
| Unconfirmed claims never enter git history, where they are awkward to remove | The draft is the **provenance trail** behind a live product — the only mechanical evidence of where a published claim came from. Untracked, it exists on one machine |
| A rejected draft leaves no trace, matching the "its number dies with it" rule | A lost `content-pipeline/completed/` cannot be rebuilt; `sourceNotes.rawContent` is not recoverable from the published product |
| Source text quoted from `Latest.xlsx` is owner-supplied third-party data | The validator's containment check proves a quote is real, but only while the draft still exists to check |
| Registers stay small and readable | The two registers in this folder are tracked precisely because the drafts are not — they are the fallback record, and they are hand-maintained, which is a weaker guarantee than git |

A middle option the owner may prefer: ignore `drafts/` and **track** `completed/`, so
work-in-progress stays local but the provenance behind anything actually published is committed.
That is a one-line change to the block above and is not what ships today.

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
