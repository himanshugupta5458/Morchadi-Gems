# Diagnosis & Error Resolution Logs

## Purpose

One file per non-trivial problem: a build failure, a payment that did not settle, a
hydration mismatch, a Vercel deploy that behaved differently from local. The log captures
the diagnosis path so the next person — or the next agent — does not repeat it.

Write a log when a problem took real investigation, when the root cause was not what the
symptom suggested, or when the fix is surprising enough that someone might undo it later.
Skip it for typos and one-line mistakes caught immediately.

These are permanent. Never delete a log because the bug is fixed — the fixed bug is exactly
what makes it valuable.

## Naming convention

```
YYYY-MM-DD-short-kebab-case-symptom.md
```

Name the file after the **symptom**, which is what a future reader will search for, not
after the root cause, which is only known in hindsight. Example:
`2026-08-17-build-fails-on-vercel-only.md`.

If two logs share a date, append a suffix: `-2`.

## Required structure

```markdown
# Symptom stated as observed

- **Date:** YYYY-MM-DD
- **Prompt:** N
- **Severity:** Blocker | Major | Minor
- **Status:** Resolved | Mitigated | Open

## Symptom
Exactly what was observed, with the real error text.

## Investigation
What was checked, in order, and what each step ruled in or out — including the dead ends.

## Root cause
The actual mechanism, not the surface error.

## Fix
What changed, with file paths.

## Verification
How the fix was proven, with the command and its output.

## Prevention
What stops this class of bug recurring — a check, a convention, a doc change.
```

## Index

| Date | Symptom | Severity | Status |
| --- | --- | --- | --- |
| [2026-08-18](2026-08-18-buttons-render-with-no-padding.md) | Buttons render as thin labels with the text hugging the top and bottom edges | Major | Resolved |
| [2026-08-20](2026-08-20-password-prompt-never-appears.md) | `npm run seed:admin` looks stuck after the username — the password prompt never appears | Major | Resolved |
| [2026-08-20](2026-08-20-admin-shows-the-wrong-customer-name.md) | The admin panel shows a different customer name from the shipping address on the same order | Major | Resolved |
