import { NextResponse } from "next/server";
import type {
  VerifyOrderErrorBody,
  VerifyOrderErrorCode,
  VerifyOrderResult,
} from "@/types/order";
import { lookupCashfreeOrder } from "@/lib/cashfree-order";
import { isMorchadiOrderId } from "@/lib/verify";

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
 * `{ orderId, status, amount }`.
 *
 * This is the only source of truth for a completed payment. The shopper arriving on
 * `/order-confirmation` proves only that Cashfree redirected a browser to a URL — a URL anyone
 * can type — so the landing itself is never treated as success, and neither is anything in
 * `sessionStorage`. `status: "PAID"` here, derived from Cashfree's own `order_status`, is the
 * single fact the confirmation page is allowed to celebrate, and `amount` is Cashfree's
 * `order_amount` rather than any number the client held.
 *
 * The gateway call itself lives in `lib/cashfree-order.ts`, shared with `/api/notify-admin` so
 * the two routes cannot come to different conclusions about the same order. See
 * [ADR-014](/docs/decisions/ADR-014-payment-verification-and-confirmation.md),
 * [ADR-031](/docs/decisions/ADR-031-admin-whatsapp-notification.md) and
 * [the contract](/docs/api/verify-order.md).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const requestedOrderId =
    new URL(request.url).searchParams.get("order_id")?.trim() ?? "";

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

  return verifiedResponse(lookup.result);
}
