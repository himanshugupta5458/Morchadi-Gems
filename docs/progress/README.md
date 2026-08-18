# Build Progress

## Purpose

The chronological record of how this project was built, prompt by prompt. It answers
"what exists already, and when did it land?" without reading the whole git history.

[`BUILD_LOG.md`](BUILD_LOG.md) is the single running file. **Every prompt appends exactly
one row to it before finishing** — this is the one documentation obligation that has no
exceptions.

## Naming convention

- `BUILD_LOG.md` — the running table. Append only; never rewrite past rows.
- `MILESTONE-NN-short-title.md` — optional deeper write-up when a phase is large enough
  that a single table row cannot carry it (e.g. `MILESTONE-01-checkout-flow.md`). Link it
  from the relevant `BUILD_LOG.md` row.

## Row conventions for BUILD_LOG.md

| Column | Convention |
| --- | --- |
| Prompt # | Sequential integer, starting at 1 |
| Date | Absolute `YYYY-MM-DD` — never "today" or "last week" |
| What was built | Concrete deliverables, not intentions |
| Docs updated | Relative paths to every doc touched, or `—` |
| Status | `Complete`, `Partial — <reason>`, or `Blocked — <blocker>` |

Mark a row `Partial` or `Blocked` honestly. A row that claims `Complete` when a build is
failing or a task was skipped makes the log worse than useless.
