# Stage 0's first real write run refused at the register append — 16 rows would have 7 cells against a 6-cell header

- **Date:** 2026-08-24
- **Prompt:** 78
- **Severity:** Blocker
- **Status:** Resolved

## Symptom

The first write-mode run of `scripts/prepare-migration-batch.mjs` against the real 542-record
batch validated everything — `queued 542`, `needs attention 0`, `ids assigned P101–P642`, the 11
known stubs accepted — and then exited 1 at the last write:

```
REFUSING TO WRITE — appending to /workspaces/Morchadi-Gems/docs/pipeline-prep/drafts-in-progress.md
would not produce a valid register table: line 47: row has 7 cell(s), header has 6; line 67: row
has 7 cell(s), header has 6; … line 161: row has 7 cell(s), header has 6; line 545: row has 7
cell(s), header has 6
```

Sixteen would-be rows, all refused by `appendRegisterRows`' own verification — the guard added
for the B-1 register-corruption fix, doing exactly what it was added to do. The register file was
left untouched. The refusal came *after* the raw blocks, `manifest.json` and `needs-attention.md`
were written, so the batch directory was left in a half-written state that the raw-block
collision guard would then refuse to re-run over.

## Investigation

The 16 refused line numbers were positions in the *would-be* document, not the current file, so
the offending content had to be in the appended rows. Grepping the source JSONL for `|` inside
`sourceNotes.referenceTitle` found exactly 16 records — a count matching the refusal exactly:
fifteen "DC Jewelry … – Rosegold Polish | Adjustable AD Fashion Ring"-pattern titles, plus
"Satrangi Sitare | Multicolor Glitter Glass Bangle Set of 12" and one title ending in a trailing
`|`. Nothing else in a row can carry source text: category is vocabulary-validated, the stage and
date are script constants, and every warning reason is a fixed script-authored string.

Why no test or prior run caught it: the synthetic fixtures' titles contain no pipes, and the
2026-08-23 reconciliation ran `--dry-run`, which exits before the register append and its
verification.

## Root cause

`renderDraftsInProgressRows` interpolated `referenceTitle` into a Markdown table row verbatim. A
literal `|` in a cell is a cell boundary to any Markdown renderer — and to
`parseMarkdownTables`, which `verifyRegisterRows` uses to check the append before keeping it. A
title with one pipe makes a 7-cell row under a 6-cell header.

The pre-write verification is what turned this from silent register corruption (the B-1 failure
mode) into a loud exit-1. The renderer bug and the guard that caught it were two halves of the
same B-1 work; only the guard's half was complete.

## Fix

`scripts/prepare-migration-batch.mjs` — a new exported `escapeRegisterCell` replaces `|` with the
HTML entity `&#124;`, applied to the title cell and the notes cell (the two that carry composed
text). The entity renders as the same character in the table while being unmistakable for a cell
boundary. A backslash escape (`\|`) was rejected deliberately: a renderer honours it but
`parseMarkdownTables` splits on the raw character, so the guard would still have refused the
write.

`lib/prepare-migration-batch.test.ts` — a new Part D test renders a plan whose title carries a
real pipe-bearing title from the export, appends it through `appendRegisterRows` against the
register-shaped fixture, and asserts the re-parsed row comes back at exactly 6 cells with the
entity in the title cell. Also updated: "the real file reserves only P050" now asserts the real
register reserves the example row plus P101–P642, since after the successful run that is its
true state; the prose-is-not-a-reservation property it guarded is covered by the synthetic test
beside it.

Recovery from the half-written state: the 542 `PNNN/` directories, `manifest.json` and
`needs-attention.md` from the refused run were deleted (the register had never been written), and
the run repeated from a clean slate. Planning is deterministic, so the re-run assigned the
identical P101–P642 mapping.

## Verification

The re-run completed with `PASS — every record queued`, exit 0, and 542 register rows appended.
`parseMarkdownTables` over the written register: 0 problems, register table 6 columns × 543 rows
(1 example + 542 queued, P101–P642 contiguous), 16 rows carrying `&#124;` in the title cell. The
full five-command gate is green (1,769 tests).

## Prevention

The escaping now lives in the one function that renders register rows, and the round-trip test
pins it with a real pipe-bearing title. The deeper protection was already in place and proved
itself here: `appendRegisterRows` re-parses the would-be document and refuses rather than writing
a table that does not survive parsing — any future cell-breaking character class fails the same
loud way instead of corrupting the register.
