import { NextResponse } from "next/server";
import type {
  CodOrderErrorBody,
  CodOrderErrorCode,
  CodOrderResult,
} from "@/types/order";
import { lookupCapturedOrderForPaymentReference } from "@/lib/order-capture";
import { isCodOrderReference } from "@/lib/verify";

/**
 * Node, not Edge, for the same reason its sibling is: it reads Postgres through the Prisma
 * client this project shares across every server surface.
 */
export const runtime = "nodejs";

/**
 * Never prerendered and never cached. What is owed on an order changes underneath a fixed URL
 * once an operator records a collection, and a cached body would be a stale figure quoted at a
 * customer standing in front of a courier.
 */
export const dynamic = "force-dynamic";

function errorResponse(
  status: number,
  error: CodOrderErrorCode,
  message: string,
  retryable: boolean,
): NextResponse<CodOrderErrorBody> {
  return NextResponse.json(
    { error, message, retryable },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * What this shop knows about one cash-on-delivery order, for the confirmation page.
 *
 * It is the sibling of `/api/verify-order` and its whole difference is that there is no gateway
 * in it. A COD order has no payment to verify — no `payment_session_id` was minted, no money
 * moved, and Cashfree has never heard of the reference in this URL — so asking Cashfree about
 * it is not a step this route skips for speed, it is a step that has no meaning. What the
 * shopper needs is the two facts only Postgres holds: the order number they will quote, and
 * what to have ready at the door.
 *
 * The lookup is keyed on `orders.cashfree_order_id`, which for these orders holds the `COD_…`
 * reference `/api/create-order` minted. Keying it there rather than on `orders.id` is what
 * keeps this consistent with the URL the confirmation page already carries — `?order_id=` is
 * the payment reference on both paths, and the prefix is what decides which route answers it.
 * It is deliberately **not** keyed on the ten-character order number, which is the value
 * `/track` is keyed on and which ADR-045 decided may not reach any amount.
 *
 * Three answers, and they are distinguished because the shopper's next move differs. A
 * malformed reference is a link that was mistyped. A well-formed reference naming nothing is
 * the case `ORDER_NOT_RECORDED` is supposed to make impossible, so it is a 404 rather than a
 * retry. A database that did not answer is a 502 the page may ask again about — the order is
 * placed either way, and saying otherwise would be inventing a fact from an outage
 * ([ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md)).
 *
 * See [the contract](/docs/api/cod-order.md) and
 * [ADR-059](/docs/decisions/ADR-059-checkout-payment-paths.md).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const requestedReference =
    new URL(request.url).searchParams.get("order_id")?.trim() ?? "";

  if (!isCodOrderReference(requestedReference)) {
    return errorResponse(
      400,
      "COD_REFERENCE_MALFORMED",
      "That order reference is not one of ours.",
      false,
    );
  }

  const lookup = await lookupCapturedOrderForPaymentReference(requestedReference);

  if (lookup.kind === "UNAVAILABLE") {
    return errorResponse(
      502,
      "COD_LOOKUP_UNAVAILABLE",
      "We could not look your order up just now. It is placed and nothing is wrong with it, so please try again in a moment.",
      true,
    );
  }

  if (lookup.kind === "NOT_FOUND") {
    return errorResponse(
      404,
      "COD_ORDER_NOT_FOUND",
      "We have no record of that order. If you have just placed one, please contact us with this reference and we will find it.",
      false,
    );
  }

  const result: CodOrderResult = {
    codOrderReference: requestedReference,
    trackingId: lookup.order.trackingId,
    total: lookup.order.total,
    amountDue: lookup.order.amountDue,
  };

  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
