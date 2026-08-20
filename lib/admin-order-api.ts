import "server-only";
import { NextResponse } from "next/server";
import type { AdminIdentity } from "@/lib/admin-auth";
import { readAdminSessionFromRequest } from "@/lib/admin-session";
import type { AdminOrderActionResponseBody } from "@/types/admin-order";
import type { AdminOrderUpdateOutcome } from "@/lib/admin-order-updates";

export type { AdminOrderActionResponseBody };

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * The 401 for a request that carried no live session.
 *
 * Middleware has already turned away anything without a session *cookie*, but a cookie is not
 * a session: it is checked here against Postgres, on the Node runtime, exactly as the protected
 * layout checks it before rendering a page. An endpoint that changes an order may not be
 * satisfied by the cheaper gate.
 */
export function unauthorisedAdminOrderResponse(): NextResponse<AdminOrderActionResponseBody> {
  return NextResponse.json<AdminOrderActionResponseBody>(
    { status: "REJECTED", error: "UNAUTHENTICATED", message: "Sign in again to make changes." },
    { status: 401, headers: NO_STORE },
  );
}

export async function readAdminForOrderAction(): Promise<AdminIdentity | null> {
  return readAdminSessionFromRequest();
}

/**
 * The request body as a plain object, or an empty one.
 *
 * JSON rather than a form encoding, for the reason `/admin/api/login` states: a cross-site
 * `<form>` cannot send `application/json` without a preflight the browser will not grant, so
 * the content type is doing CSRF work alongside the `SameSite=Lax` cookie. A body that is not
 * JSON at all becomes `{}` and fails the same validation an empty submission would, rather
 * than becoming a 500.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const payload: unknown = await request.json();
    return typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function readJsonString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

/**
 * A boolean field that may legitimately be absent. `undefined` means "this action says nothing
 * about that flag", which is how one endpoint serves two independent toggles without either of
 * them being able to silently clear the other.
 */
export function readOptionalBoolean(
  body: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = body[key];
  return typeof value === "boolean" ? value : undefined;
}

/**
 * One write's outcome as an HTTP answer.
 *
 * `409` is reserved for the order having moved under the operator, which is the one rejection
 * that is not about what they typed; everything else a person can fix is a `422`. A missing
 * order is a `404` because the URL named a row that does not exist.
 */
export function respondToAdminOrderOutcome(
  outcome: AdminOrderUpdateOutcome,
): NextResponse<AdminOrderActionResponseBody> {
  if (outcome.kind === "UPDATED" || outcome.kind === "UNCHANGED") {
    return NextResponse.json<AdminOrderActionResponseBody>(
      { status: outcome.kind },
      { status: 200, headers: NO_STORE },
    );
  }

  if (outcome.kind === "NOT_FOUND") {
    return NextResponse.json<AdminOrderActionResponseBody>(
      { status: "REJECTED", error: "NOT_FOUND", message: "That order no longer exists." },
      { status: 404, headers: NO_STORE },
    );
  }

  return NextResponse.json<AdminOrderActionResponseBody>(
    { status: "REJECTED", error: outcome.error, message: outcome.message },
    { status: outcome.error === "CONCURRENT_CHANGE" ? 409 : 422, headers: NO_STORE },
  );
}
