import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createTerminalPrompt, PromptCancelledError } from "./tty-prompt.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Must match `ADMIN_PASSWORD_HASH_ROUNDS` in lib/admin-auth.ts. The figure is duplicated
 * rather than imported because this file is plain ESM run by node and that one is TypeScript
 * compiled by Next; a drift between them is harmless in practice, since bcrypt records the
 * cost inside every hash it produces and verification reads it from there.
 */
const PASSWORD_HASH_ROUNDS = 12;

/**
 * Twelve characters, for an account that is the only door to every order and every customer
 * record the shop holds. Length is the property that matters against an offline attack on a
 * stolen hash; a composition rule ("one digit, one symbol") mostly produces `Password1!`.
 */
const MIN_PASSWORD_LENGTH = 12;

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const MAX_PASSWORD_ATTEMPTS = 3;

/**
 * `DATABASE_URL` lives in .env for the Prisma CLI and in .env.local for the Next app
 * (docs/DEV-DATABASE.md). A plain node script loads neither by itself, so both are tried, and
 * an already-set variable wins over both — which is how a one-off run against a different
 * database is done without editing a file.
 */
function loadEnvironment() {
  if (typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0) {
    return;
  }

  for (const filename of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(join(REPO_ROOT, filename));
    } catch {
      continue;
    }

    if (typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0) {
      return;
    }
  }
}

/**
 * The prompt this script asks its questions through.
 *
 * `askSecret` never writes the password anywhere: the characters are collected without being
 * echoed, so nothing appears on screen, nothing reaches a scrollback buffer and nothing lands in
 * a terminal recording. It is asked for twice for that same reason — nothing was shown, so
 * nothing could be checked by eye.
 *
 * The reading itself lives in `tty-prompt.mjs`, which replaced an earlier `node:readline`
 * interface whose muted echo also swallowed its own prompts. See
 * [docs/logs/2026-08-20-password-prompt-never-appears.md](/docs/logs/2026-08-20-password-prompt-never-appears.md).
 */
function createPrompt() {
  return createTerminalPrompt({ input: process.stdin, output: process.stdout });
}

function describeUsernameProblem(username) {
  if (username.length === 0) return "A username is required.";
  if (username.length < 3) return "A username needs at least 3 characters.";
  if (username.length > 32) return "A username can be at most 32 characters.";
  return "Use letters, digits, dot, underscore or hyphen, starting with a letter or digit.";
}

async function readUsername(prompt) {
  const answer = await prompt.ask("Username: ");
  const username = answer.trim().toLowerCase();

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(describeUsernameProblem(username));
  }

  return username;
}

async function readPassword(prompt) {
  for (let attempt = 1; attempt <= MAX_PASSWORD_ATTEMPTS; attempt += 1) {
    const password = await prompt.askSecret("Password (not shown): ");

    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`  That is shorter than ${MIN_PASSWORD_LENGTH} characters. Try again.`);
      continue;
    }

    const confirmation = await prompt.askSecret("Confirm password: ");

    if (password !== confirmation) {
      console.error("  The two entries did not match. Try again.");
      continue;
    }

    return password;
  }

  throw new Error(`No matching password after ${MAX_PASSWORD_ATTEMPTS} attempts.`);
}

async function confirmAdditionalAdmin(prompt, existingCount) {
  const plural = existingCount === 1 ? "administrator" : "administrators";
  console.log("");
  console.log(`This database already holds ${existingCount} ${plural}.`);
  console.log("The panel is designed around a single operator account (ADR-041).");

  const answer = await prompt.ask("Add another anyway? [y/N] ");
  return ["y", "yes"].includes(answer.trim().toLowerCase());
}

/**
 * Creates the one administrator the admin panel signs in as.
 *
 * Credentials are read from stdin rather than from `process.argv` on purpose: an argument is
 * written to the shell's history file, is visible in `ps` to every other user on the machine
 * while the process runs, and would be recorded by any wrapper that logs the command it ran.
 *
 * The plaintext exists only inside this process, is passed to bcrypt, and is never printed,
 * never written to disk and never sent anywhere. Only the hash reaches Postgres.
 */
async function main() {
  loadEnvironment();

  if (!process.stdin.isTTY) {
    throw new Error(
      "This script must be run in a terminal — it prompts for a password and hides what you type.",
    );
  }

  if (typeof process.env.DATABASE_URL !== "string" || process.env.DATABASE_URL.length === 0) {
    throw new Error(
      "DATABASE_URL is not set. Copy it from .env.example into .env — see docs/DEV-DATABASE.md.",
    );
  }

  const prisma = new PrismaClient();
  const prompt = createPrompt();

  try {
    await prisma.$connect();

    console.log("Morchadi Gems — create an admin account");
    console.log("");

    const existingCount = await prisma.admin.count();

    if (existingCount > 0 && !(await confirmAdditionalAdmin(prompt, existingCount))) {
      console.log("Nothing was created.");
      return;
    }

    console.log("");

    const username = await readUsername(prompt);

    if ((await prisma.admin.findUnique({ where: { username } })) !== null) {
      throw new Error(`An admin named "${username}" already exists.`);
    }

    const password = await readPassword(prompt);
    const passwordHash = await hash(password, PASSWORD_HASH_ROUNDS);

    const admin = await prisma.admin.create({ data: { username, passwordHash } });

    console.log("");
    console.log(`Created admin "${admin.username}".`);
    console.log("Sign in at http://localhost:3000/admin/login while developing.");
  } finally {
    prompt.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error instanceof PromptCancelledError ? 130 : 1;
});
