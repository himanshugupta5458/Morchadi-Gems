import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-routing";
import {
  buildClearedAdminSessionCookieOptions,
  destroyAdminSession,
} from "@/lib/admin-session";

/** Node, not Edge: this handler deletes a row from Postgres. */
export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export interface AdminLogoutResponseBody {
  status: "SIGNED_OUT";
}

/**
 * Signs the owner out, and always succeeds.
 *
 * The session row is deleted before the cookie is cleared, so the token stops working whether
 * or not the browser ever applies the `Set-Cookie` — a logout that only emptied the cookie
 * would leave a live session behind on any machine that kept a copy of it.
 *
 * There is nothing to authenticate here and nothing to report: an unknown token, an expired
 * one and no cookie at all are all answered with `SIGNED_OUT`, because in every one of those
 * cases the caller is, in fact, signed out. That is also why the path is public in
 * `lib/admin-routing.ts` — a stale cookie must always be clearable rather than being
 * redirected into the login page it is trying to leave.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<AdminLogoutResponseBody>> {
  await destroyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? "");

  const response = NextResponse.json<AdminLogoutResponseBody>(
    { status: "SIGNED_OUT" },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );

  response.cookies.set(ADMIN_SESSION_COOKIE, "", buildClearedAdminSessionCookieOptions());

  return response;
}
