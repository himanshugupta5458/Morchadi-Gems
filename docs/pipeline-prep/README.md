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

## Current contents

| File | What it holds |
| --- | --- |
| [`material-phrase-candidates.md`](material-phrase-candidates.md) | Every material, plating and stone phrase found in `Latest.xlsx`, verbatim, with occurrence counts, an unverified keyword category guess, an example in context, and the rows to spot-check |
| [`non-product-rows.md`](non-product-rows.md) | The rows excluded from that scan — two payment-policy notices and fifty empty rows — plus eleven short rows that were kept but read as titles rather than descriptions |
| [`source-data-notes.md`](source-data-notes.md) | Data-quality noise found while scanning, and honesty-relevant patterns outside the material question (karat claims on plated items, `American Diamond`, `skin-safe`, prices in prose) — flagged, not acted on |

The source workbook `Latest.xlsx` is an owner-supplied export sitting untracked at the repo
root. It is not referenced by any code and is not required to read these files.
