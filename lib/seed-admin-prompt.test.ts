import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";

import { createTerminalPrompt, PromptCancelledError } from "@/scripts/tty-prompt.mjs";

const BACKSPACE = "\u0008";
const DELETE = "\u007f";
const CANCEL = "\u0003";
const END_OF_TRANSMISSION = "\u0004";
const ESCAPE = "\u001b";

/**
 * Any sequence that repositions the cursor or erases part of the screen. The bug this suite
 * exists for was one of these arriving from `node:readline` and wiping a prompt that had just
 * been written, so the strongest assertion available is that this prompt emits none at all.
 */
const CURSOR_OR_ERASE_SEQUENCE = /\u001b\[/;

function createRecordingOutput() {
  const written: string[] = [];

  return {
    write(text: string): boolean {
      written.push(text);
      return true;
    },
    everythingWritten(): string {
      return written.join("");
    },
  };
}

function createPromptUnderTest() {
  const input = new PassThrough();
  const output = createRecordingOutput();
  const prompt = createTerminalPrompt({ input, output });

  return { input, output, prompt };
}

describe("terminal prompt — visible questions", () => {
  it("writes the question and resolves with the line that was typed", async () => {
    const { input, output, prompt } = createPromptUnderTest();

    const answer = prompt.ask("Username: ");
    input.write("gooduser\r");

    expect(await answer).toBe("gooduser");
    expect(output.everythingWritten()).toContain("Username: ");
  });

  it("echoes what is typed, so the answer can be read back before Enter", async () => {
    const { input, output, prompt } = createPromptUnderTest();

    const answer = prompt.ask("Username: ");
    input.write("gooduser\r");
    await answer;

    expect(output.everythingWritten()).toContain("gooduser");
  });

  it("erases the character a backspace removed", async () => {
    const { input, output, prompt } = createPromptUnderTest();

    const answer = prompt.ask("Username: ");
    input.write(`gooduserXX${DELETE}${BACKSPACE}\r`);

    expect(await answer).toBe("gooduser");
    expect(output.everythingWritten()).toContain("\b \b");
  });
});

describe("terminal prompt — hidden questions", () => {
  it("writes the question, and nothing afterwards erases it", async () => {
    const { input, output, prompt } = createPromptUnderTest();

    const answer = prompt.askSecret("Password (not shown): ");
    input.write("correcthorsebattery\r");
    await answer;

    const written = output.everythingWritten();
    expect(written).toContain("Password (not shown): ");
    expect(written).not.toMatch(CURSOR_OR_ERASE_SEQUENCE);
  });

  it("never writes the secret, in whole or in part", async () => {
    const { input, output, prompt } = createPromptUnderTest();

    const answer = prompt.askSecret("Password (not shown): ");
    input.write("correcthorsebattery\r");

    expect(await answer).toBe("correcthorsebattery");
    expect(output.everythingWritten()).toBe("Password (not shown): \n");
  });

  it("does not echo a backspace, so the length of the secret cannot be counted", async () => {
    const { input, output, prompt } = createPromptUnderTest();

    const answer = prompt.askSecret("Password: ");
    input.write(`correcthorsebatteryXX${DELETE}${DELETE}\r`);

    expect(await answer).toBe("correcthorsebattery");
    expect(output.everythingWritten()).not.toContain("\b");
  });
});

describe("terminal prompt — consecutive questions", () => {
  it("shows every question of a username, password and confirmation sequence", async () => {
    const { input, output, prompt } = createPromptUnderTest();

    const username = prompt.ask("Username: ");
    input.write("gooduser\r");
    expect(await username).toBe("gooduser");

    const password = prompt.askSecret("Password (not shown): ");
    input.write("correcthorsebattery\r");
    expect(await password).toBe("correcthorsebattery");

    const confirmation = prompt.askSecret("Confirm password: ");
    input.write("correcthorsebattery\r");
    expect(await confirmation).toBe("correcthorsebattery");

    const written = output.everythingWritten();
    expect(written).toContain("Username: ");
    expect(written).toContain("Password (not shown): ");
    expect(written).toContain("Confirm password: ");
    expect(written).not.toMatch(CURSOR_OR_ERASE_SEQUENCE);
  });

  it("does not let the line feed of a pasted CRLF answer the next question", async () => {
    const { input, prompt } = createPromptUnderTest();

    const username = prompt.ask("Username: ");
    input.write("gooduser\r\n");
    expect(await username).toBe("gooduser");

    const password = prompt.askSecret("Password: ");
    input.write("correcthorsebattery\r");

    expect(await password).toBe("correcthorsebattery");
  });

  it("does not let characters typed ahead of a secret reach the question after it", async () => {
    const { input, prompt } = createPromptUnderTest();

    const password = prompt.askSecret("Password: ");
    input.write("correcthorsebattery\rleftover");
    expect(await password).toBe("correcthorsebattery");

    const confirmation = prompt.askSecret("Confirm password: ");
    input.write("correcthorsebattery\r");

    expect(await confirmation).toBe("correcthorsebattery");
  });
});

describe("terminal prompt — keys that are not answers", () => {
  it("drops an arrow key instead of appending its escape sequence", async () => {
    const { input, prompt } = createPromptUnderTest();

    const answer = prompt.ask("Username: ");
    input.write(`good${ESCAPE}[Duser${ESCAPE}[A\r`);

    expect(await answer).toBe("gooduser");
  });

  it("rejects on Ctrl-C, because raw mode means no signal is raised", async () => {
    const { input, prompt } = createPromptUnderTest();

    const answer = prompt.askSecret("Password: ");
    input.write(CANCEL);

    await expect(answer).rejects.toBeInstanceOf(PromptCancelledError);
  });

  it("rejects when the input ends before the answer does", async () => {
    const { input, prompt } = createPromptUnderTest();

    const answer = prompt.ask("Username: ");
    input.write(END_OF_TRANSMISSION);

    await expect(answer).rejects.toBeInstanceOf(PromptCancelledError);
  });
});
