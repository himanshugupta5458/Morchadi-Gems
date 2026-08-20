# Test Result: Seed script prompts — 2026-08-20

- **Plan:** [PLAN-admin-auth.md](PLAN-admin-auth.md), the *Seed script* and *Seed script prompts*
  sections
- **Commit:** working tree on `main`, at `79aee9d` plus this prompt's change
- **Environment:** local, GitHub Codespaces, Node v24.14.0, local Docker Postgres. The
  interactive runs used a throwaway `morchadi_gems_seedtest` database on the same container so the
  development admin was never touched; it was dropped afterwards

## How the interactive cases were run

Every one of them through a **real pty** — `pty.fork()` from Python's standard library, executing
`node scripts/seed-admin.mjs` with no pipe, no redirect and no wrapper — capturing the raw byte
stream. The script's own `process.stdin.isTTY` guard passes, which is the point: piping stdin
makes it refuse to run, so a pty is the only way to exercise the prompts at all.

Assertions are against the **captured bytes**. This matters more than it sounds: the bug being
fixed was entirely invisible in a rendered transcript, because the terminal faithfully drew a
prompt and then faithfully erased it, and only the byte stream shows both events.

## Cases

| ID | Result | Notes |
| --- | --- | --- |
| TC-66 | Pass | Row created, username lowercased, exit 0 |
| TC-67 | Pass | No password appears anywhere in any captured transcript |
| TC-68 | Pass | Count reported, `n` creates nothing, exit 0 |
| TC-69 | Pass | `echo "hacker" \| node scripts/seed-admin.mjs` refuses, exit 1 |
| TC-70 | Pass | `password_hash` begins `$2b$12$`, 60 characters |
| TC-74 | Pass | All three prompts visible and each captures input |
| TC-75 | Pass | Not one escape sequence in the whole stream, on any run |
| TC-76 | Pass | Message shown, next password prompt visible |
| TC-77 | Pass | Message shown, next password prompt visible |
| TC-78 | Pass | `No matching password after 3 attempts.`, exit 1, no row |
| TC-79 | Pass | Proceeds and creates `seconduser` |
| TC-80 | Pass | Plural `administrators` correct, `Nothing was created.`, exit 0 |
| TC-81 | Pass | `compare` true for the typed password, false for a near miss |
| TC-82 | Pass | `gooduserXXX` + three deletes created `gooduser` |
| TC-83 | Pass | Nothing written for a backspace inside a password |
| TC-84 | Pass | Arrow keys dropped; `good<arrow>user<arrow>` created `gooduser` |
| TC-85 | Pass | `Cancelled.`, exit 130, no row created |
| TC-86 | Pass | Automated |
| TC-87 | Pass | Automated |
| TC-73 | Pass | Full gate green |

Also covered, outside the plan: a duplicate username entered in mixed case
(`GoodUser` → `An admin named "gooduser" already exists.`, exit 1) and a username failing the
pattern (`ab` → `A username needs at least 3 characters.`, exit 1).

## Transcripts

The failing run, before the fix — the two hidden prompts are written and then erased by
`\u001b[1G\u001b[0J`, with nothing redrawn after:

```
'Username: \u001b[11Gtestuser\r\r\nPassword (not shown): \u001b[1G\u001b[0J\u001b[1G\r\nConfirm password: \u001b[1G\u001b[0J\u001b[1G\r\n\r\nCreated admin "testuser".\r\n'
```

Rendered, that is what the operator saw — a blank line where each question should be:

```
Username: testuser



Created admin "testuser".
```

The same run after the fix, no escape sequences at all:

```
'Morchadi Gems — create an admin account\r\n\r\n\r\nUsername: testuser\r\nPassword (not shown): \r\nConfirm password: \r\n\r\nCreated admin "testuser".\r\nSign in at http://localhost:3000/admin/login while developing.\r\n'
```

Both retry paths, after the fix — each error is followed by a **visible** prompt, which is the
second symptom resolved:

```
Username: retryuser
Password (not shown):
  That is shorter than 12 characters. Try again.
Password (not shown):
Confirm password:
  The two entries did not match. Try again.
Password (not shown):
Confirm password:

Created admin "retryuser".
```

The existing-admin path, accepted and declined:

```
This database already holds 1 administrator.
The panel is designed around a single operator account (ADR-041).
Add another anyway? [y/N] y

Username: seconduser
Password (not shown):
Confirm password:

Created admin "seconduser".
```

```
This database already holds 2 administrators.
The panel is designed around a single operator account (ADR-041).
Add another anyway? [y/N]
Nothing was created.
```

Ctrl-C at the password prompt:

```
EXIT CODE: 130
Username: cancelme
Password (not shown):

Cancelled.
admins after Ctrl-C: 0
```

That the password survives the read byte-exact, checked against the row it produced rather than
inferred from the prompt returning a non-empty string:

```
correct password  -> true
wrong password    -> false
```

## The regression test was proven to fail on the old code

A test that passes on both implementations proves nothing. Before keeping
`lib/seed-admin-prompt.test.ts`, the old `createPrompt` was reconstructed from `git show HEAD` and
driven through the suite's central assertion — *the prompt is written and nothing afterwards
erases it* — alongside the new reader:

```
--- OLD implementation (readline + _writeToOutput mute)
  raw output          : "Password (not shown): \u001b[1G\u001b[0J\u001b[1G\n"
  answer captured     : "correcthorsebattery"
  emits erase sequence: true
  ASSERTION           : FAIL
--- NEW implementation (raw stdin reader)
  raw output          : "Password (not shown): \n"
  answer captured     : "correcthorsebattery"
  emits erase sequence: false
  ASSERTION           : PASS

PROOF: the assertion fails on the old code and passes on the new code.
```

Note the middle line of each: **both implementations captured the password correctly.** The old
one worked in every respect except being visible, which is exactly why a test asserting only on
return values would have stayed green through the entire life of the bug.

## What is automated and what is not

Twelve automated cases in `lib/seed-admin-prompt.test.ts`, over the reader's stream handling:
prompt text written, echo on and off, backspace echoed only when visible, escape sequences
dropped, consecutive prompts, pasted CRLF, type-ahead, Ctrl-C, end of input, and the
no-erase-sequence assertion above.

They exist only because the reader now takes its streams as arguments. The previous
implementation reached for `process.stdin` and `process.stdout` inside itself, and no test could
reach it — which is the honest reason a 895-test suite was green while the script was unusable.

What remains manual, and should stay so: that a **real terminal** renders it correctly. The
automated tests assert on bytes sent to a stream; a pty confirms a terminal does with those bytes
what is expected. Raw-mode behaviour, signal handling and cursor rendering are properties of the
terminal, not of the code, and a unit test that mocked them would be asserting its own mock.

## Summary

20 planned cases passed, 0 failed, 0 skipped, plus 2 unplanned. 12 new automated tests; the suite
is **907 passing across 47 files**, up from 895 across 46.

Full gate green: `typecheck && lint && test:run && validate:products && build`.

Shippable. The script is usable again, and the behaviour that broke is now covered by a test that
was demonstrated to fail without the fix.
