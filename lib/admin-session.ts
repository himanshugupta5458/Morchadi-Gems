import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_IDENTITY_ID, type AdminIdentity } from "@/lib/admin-auth";
import {
  ADMIN_SESSION_COOKIE,
  resolveAdminLoginHref,
  resolveRequestHostname,
} from "@/lib/admin-routing";
import { prisma } from "@/lib/prisma";

/**
 * The identity's display username, read fresh from the environment on every session lookup
 * rather than stored at login time — there is one admin account, so its username is always
 * whatever `ADMIN_USERNAME` currently says. Falls back to `ADMIN_IDENTITY_ID` rather than
 * throwing if the variable has since been unset, since a live session predates that change and
 * should not crash a page render over it.
 */
function currentAdminUsername(): string {
  const configured = process.env.ADMIN_USERNAME;
  return typeof configured === "string" && configured.trim().length > 0
    ? configured.trim().toLowerCase()
    : ADMIN_IDENTITY_ID;
}

/**
 * How long a login lasts. Seven days, fixed from the moment of login and never extended by
 * activity: the owner signs in on their own machine, works, and is asked again the following
 * week. A sliding window would mean a session that never ends for anyone who visits the panel
 * daily, which is the opposite of what an expiry is for.
 */
export const ADMIN_SESSION_DAYS = 7;

export const ADMIN_SESSION_MAX_AGE_SECONDS = ADMIN_SESSION_DAYS * 24 * 60 * 60;

/**
 * The cookie attributes every response that sets a session must use.
 *
 * `httpOnly` puts the token out of reach of script, which is the whole defence against an
 * injected string stealing a login. `sameSite: "lax"` blocks the cookie on cross-site POSTs —
 * so a form on another site cannot act as the logged-in owner — while still letting it ride a
 * normal click-through from a bookmark or an email, which `strict` would break in a way that
 * reads as a random logout. `secure` follows the environment rather than being hardcoded on,
 * because local development is served over plain HTTP and a `Secure` cookie there is silently
 * discarded, producing a login that appears to succeed and never sticks.
 *
 * `path: "/"` because on the admin subdomain the panel *is* the root of the site. Locally the
 * same cookie is therefore sent to storefront routes too; it is inert there — nothing outside
 * this module reads it, and it never reaches the browser's own scripts.
 */
export function buildAdminSessionCookieOptions(expiresAt: Date): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  expires: Date;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

/** The attributes that clear the cookie: the same identity, an empty value, expired at once. */
export function buildClearedAdminSessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: 0;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export interface AdminSessionTicket {
  /** The opaque value that goes in the cookie. It exists in this process and nowhere else. */
  token: string;
  expiresAt: Date;
}

/**
 * What the database stores for a token. SHA-256 rather than bcrypt: the input is 256 bits of
 * `randomBytes`, so there is no dictionary to slow an attacker down through, and a session
 * lookup happens on every protected request where a quarter-second hash would be absurd.
 *
 * Storing the digest rather than the token is what makes a leaked database dump useless for
 * impersonation — the rows contain nothing that can be put back into a cookie.
 */
function digestSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function expiryFromNow(): Date {
  return new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000);
}

/**
 * Issues a session for an admin who has *already* been authenticated, and returns the token
 * exactly once. This function does not check a password and must never be called with
 * anything but the result of `authenticateAdmin`.
 */
export async function createAdminSession(adminId: string): Promise<AdminSessionTicket> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = expiryFromNow();

  await prisma.adminSession.create({
    data: { tokenHash: digestSessionToken(token), adminId, expiresAt },
  });

  return { token, expiresAt };
}

/**
 * The admin a token belongs to, or `null` for a token that is unknown, expired or malformed.
 *
 * An expired row is deleted as it is found rather than merely ignored, so the table is swept
 * by the traffic that would otherwise leave it to grow.
 */
export async function readAdminSession(token: string): Promise<AdminIdentity | null> {
  if (token.length === 0) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: digestSessionToken(token) },
  });

  if (session === null) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.adminSession.delete({ where: { id: session.id } });
    return null;
  }

  return { id: session.adminId, username: currentAdminUsername() };
}

/**
 * Ends one session server-side. Deleting the row is what makes logging out real: the token in
 * the browser's cookie jar stops working the instant this returns, whether or not the browser
 * ever received the response that clears it.
 */
export async function destroyAdminSession(token: string): Promise<void> {
  if (token.length === 0) return;

  await prisma.adminSession.deleteMany({
    where: { tokenHash: digestSessionToken(token) },
  });
}

/** Housekeeping, run on each login so the table is swept without a scheduled job. */
export async function deleteExpiredAdminSessions(): Promise<number> {
  const { count } = await prisma.adminSession.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });

  return count;
}

/**
 * The same sweep, for the login route, and it **never throws**.
 *
 * Deleting rows that expired days ago is the one thing on the login path that nobody is
 * waiting for. Awaited bare, it put a `deleteMany` between a correct password and the cookie
 * that acts on it, so a fault in the housekeeping turned a valid login into a 500 and locked
 * the owner out of the panel for a reason that had nothing to do with their credentials.
 *
 * Null means the sweep did not run. Nothing reads that value except a test: the caller
 * continues either way, which is the whole point, and the reason is in the log rather than in
 * the response. This is the storefront's off-the-critical-path discipline
 * ([ADR-042](/docs/decisions/ADR-042-order-capture-in-postgres.md)) applied to the one piece of
 * the admin panel that genuinely is housekeeping — see
 * [ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md) for why the rest
 * of the panel is deliberately the opposite.
 */
export async function sweepExpiredAdminSessions(): Promise<number | null> {
  try {
    return await deleteExpiredAdminSessions();
  } catch (sweepError) {
    console.error(
      "[admin-session] expired sessions could not be swept; the login continues regardless",
      sweepError,
    );
    return null;
  }
}

/** Every session belonging to one admin, ended at once. */
export async function destroyAllSessionsForAdmin(adminId: string): Promise<number> {
  const { count } = await prisma.adminSession.deleteMany({ where: { adminId } });
  return count;
}

/**
 * The logged-in admin for the request being rendered, read from the incoming cookie.
 *
 * This is the authoritative check — middleware only established that *a* cookie was present.
 * Server Components and route handlers on the Node runtime call this; nothing on the Edge
 * runtime can.
 */
export async function readAdminSessionFromRequest(): Promise<AdminIdentity | null> {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? "";
  return readAdminSession(token);
}

/**
 * The three things that can come of asking who is signed in, where the third used to be an
 * exception.
 *
 * A cookie that names nobody still redirects, because that is not an error — it is a stranger,
 * or an owner whose week is up. `DATABASE_UNAVAILABLE` is the case that has no honest redirect:
 * the panel does not know whether this person is signed in, and sending them to a login page
 * that cannot check a password either would be a lie told twice.
 */
export type AdminSessionResolution =
  | { kind: "SIGNED_IN"; admin: AdminIdentity }
  | { kind: "DATABASE_UNAVAILABLE" };

/**
 * The logged-in admin, or a redirect to the login page — the guard every protected admin
 * render goes through.
 *
 * It is called by `app/admin/(protected)/layout.tsx`, so a page added to that folder is
 * protected by existing rather than by remembering to ask. A page that also needs the
 * identity calls it again; that is a second indexed lookup on a primary key, and it is
 * preferred here over threading the value through a context nobody else needs.
 *
 * The login URL is derived from the request's own hostname, because `/login` and
 * `/admin/login` are the same page reached from two different domains.
 *
 * A Postgres fault is returned rather than thrown, and it **fails closed**: nothing about the
 * panel is rendered on a request whose session could not be resolved. What the caller shows
 * instead is the panel's own error state, because the person it happens to is the person who
 * fixes databases ([ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md)).
 */
export async function requireAdminSession(): Promise<AdminSessionResolution> {
  let admin: AdminIdentity | null;

  try {
    admin = await readAdminSessionFromRequest();
  } catch (sessionError) {
    console.error(
      "[admin-session] the session cookie could not be resolved against Postgres",
      sessionError,
    );
    return { kind: "DATABASE_UNAVAILABLE" };
  }

  if (admin !== null) return { kind: "SIGNED_IN", admin };

  redirect(resolveAdminLoginHref(resolveRequestHostname((name) => headers().get(name))));
}
