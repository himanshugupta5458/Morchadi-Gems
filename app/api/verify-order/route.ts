import { NextResponse } from "next/server";
import type {
  VerifyOrderErrorBody,
  VerifyOrderErrorCode,
  VerifyOrderResult,
} from "@/types/order";
import {
  CASHFREE_API_VERSION,
  getCashfreeOrderUrl,
  readCashfreeCredentials,
} from "@/lib/cashfree-config";
import { isMorchadiOrderId, normaliseCashfreeOrder } from "@/lib/verify";

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

const CASHFREE_TIMEOUT_MS = 15_000;

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
 * See [ADR-014](/docs/decisions/ADR-014-payment-verification-and-confirmation.md) and
 * [the contract](/docs/api/verify-order.md).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const requestedOrderId =
    new URL(request.url).searchParams.get("order_id")?.trim() ?? "";

  if (!isMorchadiOrderId(requestedOrderId)) return malformedOrderId();

  const credentials = readCashfreeCredentials();
  if (credentials === null) {
    console.error("[verify-order] CASHFREE_APP_ID or CASHFREE_SECRET_KEY is not set");
    return errorResponse(503, {
      error: "PAYMENT_NOT_CONFIGURED",
      message:
        "We cannot confirm payments right now because the payment gateway is not configured. Please contact us with your order number and we will confirm it by hand.",
      retryable: false,
    });
  }

  let cashfreeResponse: Response;
  try {
    cashfreeResponse = await fetch(getCashfreeOrderUrl(requestedOrderId), {
      method: "GET",
      headers: {
        "X-Client-Id": credentials.appId,
        "X-Client-Secret": credentials.secretKey,
        "x-api-version": CASHFREE_API_VERSION,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(CASHFREE_TIMEOUT_MS),
    });
  } catch (networkError) {
    console.error(
      `[verify-order] ${requestedOrderId} could not reach Cashfree`,
      networkError,
    );
    return verificationUnavailable();
  }

  const responseText = await cashfreeResponse.text();

  /**
   * Cashfree does not know this order. That is an answer, not a fault: the id was never
   * created, or it was invented by hand. The page can render it, so it comes back as a 200
   * with a state rather than as a 500.
   */
  if (cashfreeResponse.status === 404) {
    console.error(`[verify-order] ${requestedOrderId} is unknown to Cashfree`);
    return verifiedResponse({
      orderId: requestedOrderId,
      status: "NOT_FOUND",
      amount: null,
    });
  }

  if (!cashfreeResponse.ok) {
    console.error(
      `[verify-order] ${requestedOrderId} lookup rejected by Cashfree with ${cashfreeResponse.status}: ${responseText}`,
    );
    return verificationUnavailable();
  }

  let cashfreePayload: unknown;
  try {
    cashfreePayload = JSON.parse(responseText);
  } catch {
    console.error(
      `[verify-order] ${requestedOrderId} came back from Cashfree unparseable: ${responseText}`,
    );
    return verificationUnavailable();
  }

  const result = normaliseCashfreeOrder(cashfreePayload, requestedOrderId);

  /**
   * `PENDING` is not logged — the page polls, and a shopper on a slow bank page would otherwise
   * write ten lines per checkout. `FAILED` is, because an unrecognised `order_status` also
   * lands here and that is worth seeing.
   */
  if (result.status === "FAILED") {
    console.error(
      `[verify-order] ${requestedOrderId} normalised to FAILED from order_status ${JSON.stringify(
        (cashfreePayload as Record<string, unknown> | null)?.order_status,
      )}`,
    );
  }

  return verifiedResponse(result);
}
