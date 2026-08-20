/**
 * Reading a line from a terminal, with the echo under this file's control.
 *
 * Plain JavaScript rather than TypeScript because `scripts/seed-admin.mjs` is run directly by
 * node and cannot import a compiled module. It is its own file rather than a closure inside
 * that script so `lib/seed-admin-prompt.test.ts` can drive it with ordinary streams and assert
 * what reaches the terminal — which is the whole of the behaviour that broke.
 *
 * It does not use `node:readline`, and that is the point of the file. Hiding a password with
 * readline means overriding `_writeToOutput`, an undocumented internal, to swallow the echo;
 * but readline redraws a prompt by writing an erase-to-end-of-screen sequence *directly* to the
 * output stream, past that override, and then rewriting the line *through* it. Muted, the erase
 * still lands and the rewrite does not, so the prompt is wiped the instant it is asked for. See
 * [docs/logs/2026-08-20-password-prompt-never-appears.md](/docs/logs/2026-08-20-password-prompt-never-appears.md).
 *
 * Reading the bytes here instead means nothing ever moves the cursor, nothing ever clears a
 * line, and a hidden character is hidden by never being written rather than by being written
 * and suppressed downstream.
 */

const CARRIAGE_RETURN = "\r";
const LINE_FEED = "\n";
const BACKSPACE = "\u0008";
const DELETE = "\u007f";
const CANCEL = "\u0003";
const END_OF_TRANSMISSION = "\u0004";
const ESCAPE = "\u001b";

const ERASE_ONE_ECHOED_CHARACTER = "\b \b";

/**
 * An escape sequence — an arrow key, a paste marker, a mouse report — ends at the first letter
 * or tilde. Everything from the escape to that byte is dropped, so pressing an arrow key adds
 * nothing to the answer instead of appending its bracket and letter as if they had been typed.
 */
const ESCAPE_SEQUENCE_FINAL_BYTE = /[A-Za-z~]/;

const LOWEST_PRINTABLE_CODE_POINT = 0x20;

/**
 * Any readable stream, plus the two members a TTY adds. Both are optional, which is what lets a
 * test drive the prompt with an ordinary `PassThrough` while `process.stdin` still satisfies it.
 *
 * @typedef {import("node:stream").Readable & {
 *   isRaw?: boolean,
 *   setRawMode?: (mode: boolean) => unknown,
 * }} PromptInput
 */

/**
 * The one method this file asks of a writable stream, so that what was written can be read back
 * in a test without standing up a terminal.
 *
 * @typedef {{ write: (text: string) => unknown }} PromptOutput
 */

/**
 * Ctrl-C, or input that ended before the answer did. Raw mode stops the terminal from turning
 * Ctrl-C into a signal, so a script reading this way has to end itself; a prompt that could not
 * be interrupted would be a worse bug than the one this file exists to fix.
 */
export class PromptCancelledError extends Error {
  constructor(message) {
    super(message);
    this.name = "PromptCancelledError";
  }
}

/**
 * Resolves with everything typed before Enter, echoing it only when `echo` is true.
 *
 * The rest of the chunk carrying the Enter is discarded on purpose. It absorbs the line feed of
 * a pasted carriage-return-line-feed pair, which would otherwise sit in the buffer and satisfy
 * the *next* prompt with an empty answer before that prompt could be read — and it means
 * characters typed ahead of a password prompt cannot arrive at whichever prompt follows it.
 *
 * @param {{ input: PromptInput, output: PromptOutput, question: string, echo: boolean }} options
 * @returns {Promise<string>}
 */
function readLine({ input, output, question, echo }) {
  return new Promise((resolve, reject) => {
    output.write(question);

    const canSetRawMode = typeof input.setRawMode === "function";
    const rawModeBefore = input.isRaw === true;

    if (canSetRawMode) input.setRawMode(true);
    input.setEncoding("utf8");
    input.resume();

    /** @type {string[]} */
    const typed = [];
    let isInsideEscapeSequence = false;

    function stopReading() {
      input.removeListener("data", onData);
      input.removeListener("end", onEnd);
      input.removeListener("error", onError);
      if (canSetRawMode) input.setRawMode(rawModeBefore);
      input.pause();
    }

    function finishLine() {
      stopReading();
      output.write(LINE_FEED);
      resolve(typed.join(""));
    }

    function abandonLine(error) {
      stopReading();
      output.write(LINE_FEED);
      reject(error);
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (isInsideEscapeSequence) {
          if (ESCAPE_SEQUENCE_FINAL_BYTE.test(character)) isInsideEscapeSequence = false;
          continue;
        }

        if (character === ESCAPE) {
          isInsideEscapeSequence = true;
          continue;
        }

        if (character === CARRIAGE_RETURN || character === LINE_FEED) {
          finishLine();
          return;
        }

        if (character === CANCEL) {
          abandonLine(new PromptCancelledError("Cancelled."));
          return;
        }

        if (character === END_OF_TRANSMISSION) {
          if (typed.length === 0) {
            abandonLine(new PromptCancelledError("Input ended before the answer did."));
            return;
          }
          continue;
        }

        if (character === BACKSPACE || character === DELETE) {
          const removed = typed.pop();
          if (removed !== undefined && echo) output.write(ERASE_ONE_ECHOED_CHARACTER);
          continue;
        }

        const codePoint = character.codePointAt(0);
        if (codePoint === undefined || codePoint < LOWEST_PRINTABLE_CODE_POINT) continue;

        typed.push(character);
        if (echo) output.write(character);
      }
    }

    function onEnd() {
      abandonLine(new PromptCancelledError("Input ended before the answer did."));
    }

    function onError(error) {
      abandonLine(error);
    }

    input.on("data", onData);
    input.once("end", onEnd);
    input.once("error", onError);
  });
}

/**
 * A prompt bound to one pair of streams.
 *
 * The streams are arguments rather than `process.stdin` and `process.stdout` reached for
 * directly, so a test can pass a pair it can read back. A stream without `setRawMode` is
 * accepted for the same reason; the script itself still refuses to run anywhere but a TTY.
 *
 * @param {{ input?: PromptInput, output?: PromptOutput }} [streams]
 */
export function createTerminalPrompt({ input = process.stdin, output = process.stdout } = {}) {
  return {
    ask(question) {
      return readLine({ input, output, question, echo: true });
    },
    askSecret(question) {
      return readLine({ input, output, question, echo: false });
    },
    close() {
      if (typeof input.setRawMode === "function" && input.isRaw === true) input.setRawMode(false);
      input.pause();
    },
  };
}
