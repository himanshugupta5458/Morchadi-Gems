import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Who a verified login belongs to.
 *
 * There is exactly one admin account, defined by `ADMIN_USERNAME`/`ADMIN_PASSWORD` in the
 * environment rather than a Postgres row — see
 * [ADR-061](/docs/decisions/ADR-061-env-var-admin-credentials.md). `id` is therefore a fixed,
 * well-known string (`ADMIN_IDENTITY_ID`) rather than a primary key: nothing distinguishes one
 * admin from another because there can only ever be one.
 */
export interface AdminIdentity {
  id: string;
  username: string;
}

/**
 * The identity every successful login resolves to, and the value written into
 * `AdminSession.adminId`. A constant is safe here for exactly the reason a lookup is not
 * needed: there is exactly one admin account, so nothing is ever looked up by it.
 */
export const ADMIN_IDENTITY_ID = "env-admin";

/**
 * The only thing a failed login is ever told, whichever half of the credentials was wrong — or
 * whether `ADMIN_USERNAME`/`ADMIN_PASSWORD` were configured at all.
 *
 * A message that distinguishes these cases turns the login form into an oracle: a stranger
 * learns which of their guesses was closer, and an operator who mistyped a variable name in
 * Coolify gets no signal that the environment, not their memory, is the problem. Every failure
 * path returns this exact string, and `lib/admin-auth.test.ts` asserts they are byte-identical
 * rather than merely similar.
 */
export const ADMIN_LOGIN_FAILURE_MESSAGE = "Username or password is incorrect.";

/**
 * The floor a failed login takes, in milliseconds. A floor rather than an added delay: the
 * response is padded up to this figure rather than lengthened by it, so an unconfigured
 * environment (no comparison run at all), a wrong password (two fast constant-time comparisons)
 * and an unknown username all take the same observable time.
 *
 * It is not rate limiting and does not pretend to be. It costs an attacker roughly a second per
 * attempt from one connection, which is a speed bump; a real lockout belongs with the
 * order-management prompt that gives the panel something worth attacking.
 */
export const FAILED_LOGIN_FLOOR_MS = 600;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function padToFailureFloor(startedAtMs: number): Promise<null> {
  const elapsed = Date.now() - startedAtMs;
  if (elapsed < FAILED_LOGIN_FLOOR_MS) await sleep(FAILED_LOGIN_FLOOR_MS - elapsed);
  return null;
}

/**
 * Constant-time equality for two arbitrary-length strings.
 *
 * `crypto.timingSafeEqual` throws outright when its two buffers differ in length, and a caller
 * that special-cased that with an early return (`if (a.length !== b.length) return false`)
 * would leak the length difference through timing — precisely the side channel this exists to
 * close. Hashing both sides first fixes every buffer at 32 bytes regardless of input length, so
 * `timingSafeEqual` always runs and always compares the same number of bytes.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * The admin these credentials belong to, or `null` — and `null` is all a caller ever learns.
 *
 * Credentials are compared against `process.env.ADMIN_USERNAME` and `process.env.ADMIN_PASSWORD`
 * rather than a Postgres row. That is a deliberate, weaker security posture — a plaintext
 * password sits in Coolify's env panel and the container's process environment, rather than a
 * bcrypt hash in a database — accepted because resetting a database-backed password required a
 * working SSH tunnel to production, which proved unreliable enough to make simple recovery
 * painful. See [ADR-061](/docs/decisions/ADR-061-env-var-admin-credentials.md).
 *
 * Every rejection leaves by the same door: an unknown username, a wrong password, a blank field,
 * and `ADMIN_USERNAME`/`ADMIN_PASSWORD` being unset or empty are all indistinguishable in the
 * value returned, in the message the caller is allowed to show (`ADMIN_LOGIN_FAILURE_MESSAGE`)
 * and in how long the answer takes. An unconfigured environment **fails closed** — nobody can
 * log in — and logs a server-side error so the gap is diagnosable without ever being disclosed
 * to a caller.
 *
 * The username is trimmed and lowercased before comparison, on both sides, so a single operator
 * typing `Admin` on a Monday and `admin` on a Tuesday is a support call, not an authentication
 * event — matching the lookup `scripts/seed-admin.mjs` used to perform. The password is compared
 * with `timingSafeStringEqual`, never `===`: `===` on strings is variable-time and would reopen
 * the timing side channel the failure floor exists to close.
 *
 * The plaintext is never logged, never stored and never leaves this function.
 */
export async function authenticateAdmin(
  username: string,
  password: string,
): Promise<AdminIdentity | null> {
  const startedAtMs = Date.now();
  const submittedUsername = username.trim().toLowerCase();

  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (
    typeof configuredUsername !== "string" ||
    configuredUsername.trim().length === 0 ||
    typeof configuredPassword !== "string" ||
    configuredPassword.length === 0
  ) {
    console.error(
      "[admin-auth] ADMIN_USERNAME/ADMIN_PASSWORD are not both set; every login attempt is being rejected",
    );
    return padToFailureFloor(startedAtMs);
  }

  if (submittedUsername.length === 0 || password.length === 0) {
    return padToFailureFloor(startedAtMs);
  }

  const usernameMatches = timingSafeStringEqual(
    submittedUsername,
    configuredUsername.trim().toLowerCase(),
  );
  const passwordMatches = timingSafeStringEqual(password, configuredPassword);

  if (!usernameMatches || !passwordMatches) return padToFailureFloor(startedAtMs);

  return { id: ADMIN_IDENTITY_ID, username: submittedUsername };
}
