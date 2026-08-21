import { NextResponse } from "next/server";
import { ADMIN_LOGIN_FAILURE_MESSAGE, authenticateAdmin } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-routing";
import {
  buildAdminSessionCookieOptions,
  createAdminSession,
  sweepExpiredAdminSessions,
} from "@/lib/admin-session";

/** Node, not Edge: this handler runs bcrypt and opens a Postgres connection. */
export const runtime = "nodejs";

/** A login is an action, never a document. Nothing about it may be cached or reused. */
export const dynamic = "force-dynamic";

type AdminLoginStatus = "SIGNED_IN" | "REJECTED" | "UNAVAILABLE";

export interface AdminLoginResponseBody {
  status: AdminLoginStatus;
  error?: string;
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * What the sign-in form shows when the panel could not even find out whether the password was
 * right. It names the database because the person reading it is the person who can restart it,
 * and because "Sign in could not be completed" — the form's own fallback — would send the
 * owner hunting for a typo in a password that was correct.
 */
const ADMIN_LOGIN_UNAVAILABLE_MESSAGE =
  "The admin database did not answer, so this sign-in could not be checked. It is not your password. Try again in a moment.";

async function readCredentials(
  request: Request,
): Promise<{ username: string; password: string }> {
  try {
    const payload: unknown = await request.json();
    const body = (typeof payload === "object" && payload !== null ? payload : {}) as Record<
      string,
      unknown
    >;

    return {
      username: typeof body.username === "string" ? body.username : "",
      password: typeof body.password === "string" ? body.password : "",
    };
  } catch {
    return { username: "", password: "" };
  }
}

/**
 * Signs the shop owner in.
 *
 * **Every rejection is the same rejection.** A username that matches no admin, a wrong
 * password, an empty field and a body that is not JSON all produce one status code, one
 * message and — because `authenticateAdmin` pads a failure up to a fixed floor — one
 * duration. Nothing a client can measure distinguishes them, which is what stops this
 * endpoint from being a way to discover the operator's username.
 *
 * The credentials arrive as JSON rather than as a form encoding, so a cross-site `<form>`
 * cannot reach this handler without a CORS preflight the browser will not grant. That, and
 * the `SameSite=Lax` cookie it sets, are the whole of the CSRF story here; a token belongs
 * with the prompt that gives the panel state worth forging a request against.
 *
 * The plaintext password is read from the body, passed to bcrypt and dropped. It is never
 * logged, never stored, and never appears in a response.
 *
 * **The expiry sweep cannot fail a login.** It is housekeeping that happens to be convenient to
 * run here, and awaiting it bare meant a `deleteMany` fault turned a correct password into a
 * 500 — see `sweepExpiredAdminSessions`.
 *
 * **A database that is not there is said out loud.** The one-message rule above is about
 * telling a stranger apart from the owner, and a 503 does neither: it is returned for every
 * username equally, including ones that do not exist, so it discloses nothing a request could
 * not already learn by timing the outage. What it buys is the owner not spending ten minutes
 * on a password that was right all along ([ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md)).
 */
export async function POST(request: Request): Promise<NextResponse<AdminLoginResponseBody>> {
  const { username, password } = await readCredentials(request);

  try {
    const admin = await authenticateAdmin(username, password);

    if (admin === null) {
      return NextResponse.json(
        { status: "REJECTED", error: ADMIN_LOGIN_FAILURE_MESSAGE },
        { status: 401, headers: NO_STORE },
      );
    }

    await sweepExpiredAdminSessions();

    const { token, expiresAt } = await createAdminSession(admin.id);

    const response = NextResponse.json<AdminLoginResponseBody>(
      { status: "SIGNED_IN" },
      { status: 200, headers: NO_STORE },
    );

    response.cookies.set(ADMIN_SESSION_COOKIE, token, buildAdminSessionCookieOptions(expiresAt));

    return response;
  } catch (loginError) {
    console.error("[admin-login] the sign-in could not be resolved against Postgres", loginError);

    return NextResponse.json(
      { status: "UNAVAILABLE", error: ADMIN_LOGIN_UNAVAILABLE_MESSAGE },
      { status: 503, headers: NO_STORE },
    );
  }
}
