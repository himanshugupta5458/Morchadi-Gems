import { NextResponse } from "next/server";
import { lookupCashfreeOrder } from "@/lib/cashfree-order";
import { parseCheckoutValue } from "@/lib/checkout";
import { composeAdminOrderMessage } from "@/lib/notify-message";
import {
  dispatchAdminNotification,
  readCallMeBotCredentials,
  type NotifyOutcome,
} from "@/lib/notify";
import { isMorchadiOrderId } from "@/lib/verify";

/** Node, not Edge: this handler reads the Cashfree secret and the CallMeBot key. */
export const runtime = "nodejs";

/** A notification is an action, never a document. Nothing about it may be cached or reused. */
export const dynamic = "force-dynamic";

const LOG_PREFIX = "[notify-admin]";

type NotifyResponseStatus = NotifyOutcome | "SKIPPED_INVALID_REQUEST";

interface NotifyAdminResponseBody {
  status: NotifyResponseStatus;
}

/**
 * Always 200, whatever happened.
 *
 * This route runs while a shopper is looking at the screen that tells them their payment
 * succeeded, and the browser fires it without reading the reply. A 4xx or 5xx here would be a
 * console error on a successful checkout at best, and something a future caller might decide
 * to surface at worst. The outcome is carried in the body for the server log and for tests;
 * the status code stays boring on purpose.
 */
function neutralResponse(
  status: NotifyResponseStatus,
): NextResponse<NotifyAdminResponseBody> {
  return NextResponse.json(
    { status },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

async function readRequestBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const payload: unknown = await request.json();
    return typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Tells the shop owner, over WhatsApp, that an order has been paid for.
 *
 * **The decision to send is server-verified; only the message content comes from the client.**
 * The browser sends an order id and its own summary of the basket. The id is re-checked
 * against Cashfree here, through the same `lookupCashfreeOrder` the confirmation page's
 * verification uses, and a message goes out only when Cashfree itself says `PAID`. Without
 * that, `/api/notify-admin` would be an open endpoint for sending the owner arbitrary
 * WhatsApp messages by naming any order id.
 *
 * The summary is trusted only to describe, never to decide. It is validated for shape by
 * `parseCheckoutValue` — the same validator the `sessionStorage` bundle goes through — and if
 * it fails, the message degrades to the order id and the amount rather than being abandoned.
 * The amount printed is always Cashfree's, never the client's total.
 *
 * Nothing in this route is on the critical path of a payment. See
 * [the contract](/docs/api/notify-admin.md).
 */
export async function POST(request: Request): Promise<NextResponse<NotifyAdminResponseBody>> {
  const body = await readRequestBody(request);
  const requestedOrderId =
    typeof body?.orderId === "string" ? body.orderId.trim() : "";

  if (!isMorchadiOrderId(requestedOrderId)) {
    console.error(`${LOG_PREFIX} rejected a request naming no readable order id`);
    return neutralResponse("SKIPPED_INVALID_REQUEST");
  }

  const lookup = await lookupCashfreeOrder(requestedOrderId, LOG_PREFIX);

  if (lookup.kind !== "ok") {
    console.error(
      `${LOG_PREFIX} ${requestedOrderId} could not be verified (${lookup.kind}), so no message was sent`,
    );
    return neutralResponse("SKIPPED_NOT_PAID");
  }

  const message = composeAdminOrderMessage({
    orderId: lookup.result.orderId,
    amountPaid: lookup.result.amount,
    bundle: parseCheckoutValue(body?.summary),
  });

  const outcome = await dispatchAdminNotification({
    verifiedStatus: lookup.result.status,
    message,
    credentials: readCallMeBotCredentials(),
  });

  if (outcome === "FAILED") {
    console.error(`${LOG_PREFIX} ${requestedOrderId} was paid but the WhatsApp send failed`);
  }
  if (outcome === "SKIPPED_NOT_CONFIGURED") {
    console.error(
      `${LOG_PREFIX} ${requestedOrderId} was paid but CALLMEBOT_PHONE or CALLMEBOT_APIKEY is not set`,
    );
  }

  return neutralResponse(outcome);
}
