import "server-only";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { AdminIdentity } from "@/lib/admin-auth";
import { readAdminSessionFromRequest } from "@/lib/admin-session";
import type { AdminOrderAction } from "@/lib/admin-routing";
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

const LOG_PREFIX = "[admin-order-action]";

/**
 * The Prisma error codes that mean "the database is not there", as distinct from "the database
 * refused what you asked". Everything in this list is a fault of the connection, the pool or
 * the server rather than of the request, and every one of them is worth telling an operator
 * about in those words.
 */
const DATABASE_UNREACHABLE_CODES: readonly string[] = [
  "P1000",
  "P1001",
  "P1002",
  "P1008",
  "P1010",
  "P1011",
  "P1017",
  "P2024",
];

function isDatabaseUnreachable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    DATABASE_UNREACHABLE_CODES.includes(error.code)
  );
}

/**
 * What an operator is told when the write did not happen for a reason that is nobody's fault
 * but ours.
 *
 * Both sentences promise the same thing and both are true. `applyAdminOrderStatusChange` and
 * `updateAdminOrderShippingAddress` run inside `prisma.$transaction`, so a failure anywhere in
 * them commits nothing; `updateAdminOrderReceipt` is a single statement, which either landed or
 * did not. There is no path here that half-changes an order, so "nothing about the order was
 * changed" is a guarantee rather than a reassurance.
 */
function unexpectedAdminOrderFailureResponse(
  error: unknown,
): NextResponse<AdminOrderActionResponseBody> {
  if (isDatabaseUnreachable(error)) {
    return NextResponse.json<AdminOrderActionResponseBody>(
      {
        status: "REJECTED",
        error: "DATABASE_UNAVAILABLE",
        message:
          "The order database did not answer, so nothing about this order was changed. Try again in a moment. If it keeps failing, the database itself is down.",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  return NextResponse.json<AdminOrderActionResponseBody>(
    {
      status: "REJECTED",
      error: "SERVER_ERROR",
      message:
        "Something went wrong on the server, so nothing about this order was changed. Try again. If it keeps failing, the server log has the detail.",
    },
    { status: 500, headers: NO_STORE },
  );
}

/**
 * The one error boundary the three order-action endpoints share, and the reason none of them
 * has a `try` of its own.
 *
 * It wraps the session check as well as the write, which is the half that is easy to miss:
 * `readAdminForOrderAction` resolves the cookie **against Postgres**, so a database that is
 * down fails there first, before any handler body has run. A boundary that started after the
 * session was resolved would have caught nothing on the outage it exists for.
 *
 * A failure here is loud on purpose. The storefront swallows a database fault because a shopper
 * mid-payment must not see one ([ADR-042](/docs/decisions/ADR-042-order-capture-in-postgres.md));
 * the panel is the opposite case — the person using it is the person who would fix the
 * database, and a status change that silently did nothing is worse for them than an error.
 * What it must not do is *crash*: an unhandled rejection reaches the browser as the generic
 * "That change was refused, and the server did not say why", which is the least useful true
 * sentence available. See [ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md).
 */
export async function runAdminOrderAction(
  action: AdminOrderAction,
  orderId: string,
  performAction: (admin: AdminIdentity) => Promise<AdminOrderUpdateOutcome>,
): Promise<NextResponse<AdminOrderActionResponseBody>> {
  try {
    const admin = await readAdminForOrderAction();
    if (admin === null) return unauthorisedAdminOrderResponse();

    return respondToAdminOrderOutcome(await performAction(admin));
  } catch (actionError) {
    console.error(
      `${LOG_PREFIX} ${action} on order ${orderId} could not be completed`,
      actionError,
    );
    return unexpectedAdminOrderFailureResponse(actionError);
  }
}
