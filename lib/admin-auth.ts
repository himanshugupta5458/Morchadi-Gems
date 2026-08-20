import "server-only";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Who a verified login belongs to. Deliberately not the Prisma row: `passwordHash` has no
 * business travelling any further than the comparison that reads it.
 */
export interface AdminIdentity {
  id: string;
  username: string;
}

/**
 * bcrypt's work factor. Twelve is the current common default — roughly a quarter of a second
 * per hash on this class of hardware, which is unnoticeable on a login a shop owner performs
 * once a week and expensive enough to make an offline attack on a stolen hash impractical.
 *
 * The factor is recorded inside every hash bcrypt produces, so raising it later does not
 * invalidate existing passwords; it only applies to ones set afterwards.
 */
export const ADMIN_PASSWORD_HASH_ROUNDS = 12;

/**
 * The only thing a failed login is ever told, whichever half of the credentials was wrong.
 *
 * A message that distinguishes "no such user" from "wrong password" turns the login form into
 * a username oracle: an attacker learns which names exist before trying a single password.
 * There is one operator account here, so the name is the smaller half of the secret and worth
 * keeping. Both failure paths return this exact string, and `lib/admin-auth.test.ts` asserts
 * they are byte-identical rather than merely similar.
 */
export const ADMIN_LOGIN_FAILURE_MESSAGE = "Username or password is incorrect.";

/**
 * The floor a failed login takes, in milliseconds. A floor rather than an added delay: the
 * response is padded up to this figure rather than lengthened by it, so a missing username
 * (no bcrypt work) and a wrong password (a full bcrypt compare) take the same observable time
 * as well as returning the same words.
 *
 * It is not rate limiting and does not pretend to be. It costs an attacker roughly a second
 * per attempt from one connection, which is a speed bump; a real lockout belongs with the
 * order-management prompt that gives the panel something worth attacking.
 */
export const FAILED_LOGIN_FLOOR_MS = 600;

/**
 * A bcrypt hash of a fixed, publicly known string, compared against when the submitted
 * username matches no admin.
 *
 * Its plaintext being in this file is harmless — it is never stored as anybody's password and
 * so can never authenticate. Its job is to make the absent-user path do the same quarter
 * second of key stretching the wrong-password path does, so the two cannot be told apart by a
 * stopwatch. Generated at `ADMIN_PASSWORD_HASH_ROUNDS`; if that figure changes, this should
 * be regenerated to match.
 */
const ABSENT_ADMIN_PASSWORD_HASH =
  "$2b$12$iHPHrA8uHbIuL3EcZ/0z9uWp5YCrcVrqrVrtJ6ywbX26OJluG4nkm";

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function padToFailureFloor(startedAtMs: number): Promise<null> {
  const elapsed = Date.now() - startedAtMs;
  if (elapsed < FAILED_LOGIN_FLOOR_MS) await sleep(FAILED_LOGIN_FLOOR_MS - elapsed);
  return null;
}

/** The one place a password becomes a hash, shared by the seed script's documented settings. */
export function hashAdminPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ADMIN_PASSWORD_HASH_ROUNDS);
}

/**
 * The admin these credentials belong to, or `null` — and `null` is all a caller ever learns.
 *
 * Every rejection leaves by the same door: unknown username, wrong password and a blank field
 * are indistinguishable in the value returned, in the message the caller is allowed to show
 * (`ADMIN_LOGIN_FAILURE_MESSAGE`) and in how long the answer takes.
 *
 * The username is lowercased before the lookup, matching what `scripts/seed-admin.mjs`
 * stores. A single operator typing `Admin` on a Monday and `admin` on a Tuesday is a support
 * call, not an authentication event.
 *
 * The plaintext is never logged, never stored and never leaves this function.
 */
export async function authenticateAdmin(
  username: string,
  password: string,
): Promise<AdminIdentity | null> {
  const startedAtMs = Date.now();
  const submittedUsername = username.trim().toLowerCase();

  if (submittedUsername.length === 0 || password.length === 0) {
    return padToFailureFloor(startedAtMs);
  }

  const admin = await prisma.admin.findUnique({ where: { username: submittedUsername } });
  const passwordMatches = await compare(
    password,
    admin?.passwordHash ?? ABSENT_ADMIN_PASSWORD_HASH,
  );

  if (admin === null || !passwordMatches) return padToFailureFloor(startedAtMs);

  return { id: admin.id, username: admin.username };
}
