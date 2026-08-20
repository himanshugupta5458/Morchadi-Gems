# The password prompt never appears — `npm run seed:admin` looks stuck after the username

- **Date:** 2026-08-20
- **Prompt:** 46
- **Severity:** Major
- **Status:** Resolved

## Symptom

Running `npm run seed:admin` in a GitHub Codespaces terminal, the username prompt appears and
accepts input. Then nothing. The cursor sits on a blank line with no prompt text, and the script
appears hung. Typing a password and pressing Enter does work — the value is captured — but there
is no way to know that from the screen, so the run reads as frozen.

Where a retry was triggered, the second symptom appeared: the error text arrived with no prompt
before it, so the terminal showed a validation message for a question that was never visibly
asked.

```
Morchadi Gems — create an admin account

Username: retryuser

  That is shorter than 12 characters. Try again.


  The two entries did not match. Try again.
```

Every one of `Password (not shown): ` and `Confirm password: ` is missing.

## Investigation

Reproduced first, under a real pty — `pty.fork()` driving `node scripts/seed-admin.mjs` with no
pipes, no redirects and no wrapper, capturing the raw byte stream rather than the rendered
screen. The rendered screen is what hides the mechanism; the bytes state it outright.

The captured output of the failing run, verbatim:

```
'Username: \x1b[11Gtestuser\r\r\nPassword (not shown): \x1b[1G\x1b[0J\x1b[1G\r\n'
```

That single line ruled everything else in and out at once.

- **`_writeToOutput` interacting badly with readline's state across consecutive `question()`
  calls — ruled out.** The answers were captured correctly every time, in the right order, on
  every attempt. No callback was dropped and no `question()` was discarded. Node's
  `[kQuestionCallback]` is cleared before the callback runs, so a `question()` issued from inside
  a previous question's callback is accepted normally.
- **A race between the async callback and the synchronous `isMuted = true` — ruled out.** The
  prompt text *is* written, and it is written before the mute is set. It appears in the byte
  stream, in the right place. Nothing suppressed the write.
- **Input from the previous prompt bleeding into the next — ruled out.** The username is
  terminated by a single `\r`, and the password read began cleanly.
- **Environment-specific behaviour — ruled out.** The escape sequences involved are emitted by
  Node unconditionally whenever `terminal: true` and `TERM` is not `dumb`. Codespaces is not
  implicated; any terminal reproduces this.

What remains is the three escape sequences sitting between the prompt text and the newline, and
they are the whole bug.

## Root cause

`askSecret` wrote its own prompt with `process.stdout.write(question)`, set `isMuted = true`, and
then called `readline.question("")` to read the line with readline's echo suppressed.

`readline.question()` calls `Interface.prototype.prompt()`, which — with `terminal: true` — calls
`_refreshLine()`. `_refreshLine` redraws the current line in three steps:

1. `cursorTo(this.output, 0)` — emitted as `\x1b[1G`, written **directly to the output stream**
2. `clearScreenDown(this.output)` — emitted as `\x1b[0J`, also written **directly to the output
   stream**
3. `this._writeToOutput(line)` — the prompt and buffer redrawn, this one routed **through**
   `_writeToOutput`

The override only governs step 3. Steps 1 and 2 bypass it entirely, because readline calls the
`cursorTo` and `clearScreenDown` helpers against `this.output`, not against its own writer.

So the sequence was: write `Password (not shown): `, move the cursor back to column 1, erase from
there to the end of the screen — **which deletes the prompt that was just written** — and then
decline to redraw it, because the mute was already on. The prompt was printed and erased inside
the same tick, leaving a bare cursor on an empty line.

The username prompt was unaffected for the mirror-image reason: `ask()` passes its question into
`readline.question(query, …)`, so readline owns that text and redraws it through
`_writeToOutput` while unmuted. It is erased by step 2 and immediately restored by step 3. That
asymmetry is why only the hidden prompts vanished, and it is visible in the bytes as
`\x1b[1G\x1b[0J` **followed by** `Username: ` on the working path, versus `\x1b[1G\x1b[0J` with
nothing after it on the broken one.

The muting approach was therefore not merely fragile — it was self-defeating. The same flag that
hid the typed characters also hid readline's redraw of its own prompt, while the erase that made
the redraw necessary could not be muted at all.

## Fix

The override is gone rather than repaired. Muting an echo that has already been written is the
wrong shape for the problem; not writing it in the first place is the right one.

- **`scripts/tty-prompt.mjs`** (new) reads a line directly from the input stream in raw mode,
  collecting code points until Enter and echoing them only when asked to. It uses documented
  public API — `setRawMode`, `setEncoding`, `data` events — and no readline internals. It never
  moves the cursor and never clears a line, so there is no erase for a prompt to lose to. A
  hidden character is hidden by never being written.

  It also handles what raw mode makes this file's responsibility: backspace (erasing the echoed
  character only when echoing), escape sequences from arrow and function keys (dropped, rather
  than appended as their literal bracket and letter), Ctrl-C (raw mode raises no signal, so the
  read rejects and the script exits 130), and end of input. The remainder of the chunk carrying
  the Enter is discarded, which absorbs the line feed of a pasted CRLF and stops characters typed
  ahead of a password prompt reaching the prompt after it.

- **`scripts/seed-admin.mjs`** now delegates to it; `createPrompt` is four lines and the
  `node:readline` import is gone. Its one behavioural addition is exit code 130 on Ctrl-C, which
  raw mode requires — the terminal no longer raises `SIGINT` for the script to die from.

No dependency was added. See the BUILD_LOG row for why a package was weighed and declined.

Every other behaviour is untouched: the twelve-character minimum, three attempts, the
confirmation match, existing-admin detection and its `[y/N]` prompt, the username pattern and its
four error messages, the non-TTY refusal, and credentials never being read from `process.argv`.

## Verification

Driven through a real pty, twelve runs, asserting on captured bytes rather than on how a screen
looked. Full transcripts in
[RESULT-2026-08-20-seed-admin-prompt.md](../testing/RESULT-2026-08-20-seed-admin-prompt.md).

The fresh run, after the fix — all three questions present, and not one escape sequence in the
entire stream:

```
'Morchadi Gems — create an admin account\r\n\r\n\r\nUsername: testuser\r\nPassword (not shown): \r\nConfirm password: \r\n\r\nCreated admin "testuser".\r\n'
```

That the captured password is byte-exact was proven against the row it produced, rather than
assumed from the prompt returning a string:

```
correct password  -> true
wrong password    -> false
```

The regression test was proven to fail on the old code before being kept. Both implementations
were driven through the same assertion:

```
--- OLD implementation (readline + _writeToOutput mute)
  raw output          : "Password (not shown): \u001b[1G\u001b[0J\u001b[1G\n"
  emits erase sequence: true
  ASSERTION           : FAIL
--- NEW implementation (raw stdin reader)
  raw output          : "Password (not shown): \n"
  emits erase sequence: false
  ASSERTION           : PASS
```

Gate: `typecheck && lint && test:run && validate:products && build`, all green, 907 tests across
47 files.

## Prevention

`lib/seed-admin-prompt.test.ts` — 12 cases — is the standing guard, and it exists only because
the reader now takes its streams as arguments. The old `createPrompt` reached for
`process.stdin` and `process.stdout` directly, which is why nothing could test it and why the bug
survived a green suite.

Its sharpest assertion is the general one rather than a re-statement of this bug: **the prompt
must emit no cursor-positioning or erase sequence at all.** Any future change that reintroduces a
line-redrawing reader fails on that line, whether or not it fails the same way.

The wider lesson is the convention worth keeping: overriding an undocumented method
(`_writeToOutput`) buys behaviour that the library's documented paths are free to route around,
and here one of them did, in the same function call. A hand-rolled reader on public API is the
smaller risk, not the larger one.
