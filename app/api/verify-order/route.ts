import { NextResponse } from "next/server";
import type {
  VerifyOrderErrorBody,
  VerifyOrderErrorCode,
  VerifyOrderResult,
} from "@/types/order";
import { lookupCashfreeOrder } from "@/lib/cashfree-order";
import {
  findCapturedOrderForPaymentReference,
  recordVerifiedPaymentStatus,
} from "@/lib/order-capture";
import { isCodOrderReference, isMorchadiOrderId } from "@/lib/verify";

/**
 * Node, not Edge: this handler holds the Cashfree secret in memory. It is also the only place
 * in the project that can answer "was this order paid?", so it stays on the same runtime as
 * the route that created the order.
 */
export const runtime = "nodejs";

/**
 * Never prerendered and never cached. A payment status changes underneath a fixed URL, so a
 * cached `PENDING` would strand a shopper on a spinner and a cached `PAID` would be a receipt
 * served to whoever asked next.
 */
export const dynamic = "force-dynamic";

const LOG_PREFIX = "[verify-order]";

function errorResponse(
  status: number,
  body: VerifyOrderErrorBody,
): NextResponse<VerifyOrderErrorBody> {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function verificationUnavailable(): NextResponse<VerifyOrderErrorBody> {
  return errorResponse(502, {
    error: "VERIFICATION_UNAVAILABLE",
    message:
      "We could not reach the payment gateway to confirm this order. Your payment is unaffected, so please try again in a moment.",
    retryable: true,
  });
}

/**
 * A `COD_…` reference asked about at the route that asks Cashfree about a payment.
 *
 * Nothing this project ships sends one here — the confirmation page classifies the reference
 * and calls `/api/cod-order` instead — and the shape guard below would already have refused it
 * before any request reached Cashfree. This exists so that the refusal says something true: a
 * cash-on-delivery order has no payment to verify, which is a different sentence from "that
 * reference is not one of ours", and the shopper reading it is holding a real order number.
 */
function codOrderNotVerifiable(): NextResponse<VerifyOrderErrorBody> {
  return errorResponse(400, {
    error: "COD_ORDER_NOT_VERIFIABLE",
    message:
      "That is a cash-on-delivery order, so there is no online payment to confirm. Your order is placed and you pay the courier on delivery.",
    retryable: false,
  });
}

function malformedOrderId(): NextResponse<VerifyOrderErrorBody> {
  const error: VerifyOrderErrorCode = "ORDER_ID_MALFORMED";
  return errorResponse(400, {
    error,
    message: "That order reference is not one of ours.",
    retryable: false,
  });
}

function verifiedResponse(
  result: VerifyOrderResult,
): NextResponse<VerifyOrderResult> {
  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Asks Cashfree what happened to one order and reduces the answer to
 * `{ orderId, status, amount, trackingId }`.
 *
 * This is the only source of truth for a completed payment. The shopper arriving on
 * `/order-confirmation` proves only that Cashfree redirected a browser to a URL — a URL anyone
 * can type — so the landing itself is never treated as success, and neither is anything in
 * `sessionStorage`. `status: "PAID"` here, derived from Cashfree's own `order_status`, is the
 * single fact the confirmation page is allowed to celebrate, and `amount` is Cashfree's
 * `order_amount` rather than any number the client held.
 *
 * Once Cashfree has answered, the order's `cashfree_payment_status` in Postgres is brought into
 * line with that answer. It is the only column this route writes: `status` stays `placed` on a
 * confirmed payment, because fulfilment moves when an operator packs the order and not when the
 * money arrives. The write is off the critical path in the same way the database write in
 * `/api/create-order` is — `recordVerifiedPaymentStatus` never throws, and the response above is
 * identical whether Postgres answered, failed, or has no row for this order at all.
 *
 * The same row is also *read*, for the two facts Cashfree cannot supply. `amountDue` is the
 * first: on a `partial_cod` order the `amount` above is the prepayment floor rather than what
 * the cart was worth, and the confirmation page has to be able to say what is still owed at the
 * door. It is null, not zero, when the row could not be read — "nothing is owed" and "we could
 * not find out" are different sentences to put in front of somebody who may be about to hand
 * cash to a courier. The second is `trackingId`, the
 * ten-character order number this shop knows the order by. It travels in the response so the
 * confirmation page can name the order from the `order_id` in its own URL rather than from a
 * `sessionStorage` bundle that a confirmed payment has already cleared — which is what made
 * that page lose the order number on a refresh
 * ([ADR-045](/docs/decisions/ADR-045-public-order-tracking.md)). Like the write, this read
 * never throws and never changes the rest of the body: a database that is down yields
 * `trackingId: null`, which the page renders exactly as it renders an order that has no
 * number.
 *
 * The gateway call itself lives in `lib/cashfree-order.ts`, shared with `/api/notify-admin` so
 * the two routes cannot come to different conclusions about the same order. See
 * [the contract](/docs/api/verify-order.md) and
 * [the notify-admin contract](/docs/api/notify-admin.md). Payment verification shipped in a
 * prompt that produced no ADR, so the contract file is its decision record.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const requestedOrderId =
    new URL(request.url).searchParams.get("order_id")?.trim() ?? "";

  if (isCodOrderReference(requestedOrderId)) return codOrderNotVerifiable();
  if (!isMorchadiOrderId(requestedOrderId)) return malformedOrderId();

  const lookup = await lookupCashfreeOrder(requestedOrderId, LOG_PREFIX);

  if (lookup.kind === "not-configured") {
    return errorResponse(503, {
      error: "PAYMENT_NOT_CONFIGURED",
      message:
        "We cannot confirm payments right now because the payment gateway is not configured. Please contact us with your order number and we will confirm it by hand.",
      retryable: false,
    });
  }

  if (lookup.kind === "unreachable") return verificationUnavailable();

  await recordVerifiedPaymentStatus(requestedOrderId, lookup.result.status);
  const captured = await findCapturedOrderForPaymentReference(requestedOrderId);

  return verifiedResponse({
    ...lookup.result,
    trackingId: captured?.trackingId ?? null,
    amountDue: captured?.amountDue ?? null,
  });
}
