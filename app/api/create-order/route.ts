import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type {
  CreateOrderErrorBody,
  CreateOrderErrorCode,
  CreateOrderSuccess,
} from "@/types/order";
import {
  ADDRESS_FIELDS,
  validateAddressForm,
  type AddressFormValues,
} from "@/lib/address";
import {
  CASHFREE_API_VERSION,
  buildReturnUrl,
  getCashfreeOrdersUrl,
  readCashfreeCredentials,
  resolveCashfreeMode,
} from "@/lib/cashfree-config";
import {
  buildOrderFromCart,
  mergeOrderItemsByProduct,
  parseOrderItems,
} from "@/lib/order";
import { toOrderOptionTags, validateOrderLineOptions } from "@/lib/order-options";
import { getAllProducts } from "@/lib/products";

/**
 * Node, not Edge: this handler reads `node:crypto` for order identifiers and holds the
 * Cashfree secret in memory. Edge would work for the fetch alone, but there is nothing to
 * gain from it on a route that runs once per checkout.
 */
export const runtime = "nodejs";

/** Never prerendered and never cached — every call mints a new payment session. */
export const dynamic = "force-dynamic";

const CASHFREE_TIMEOUT_MS = 15_000;
const BASE36_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomBase36(length: number): string {
  return Array.from(
    randomBytes(length),
    (byte) => BASE36_ALPHABET[byte % BASE36_ALPHABET.length],
  ).join("");
}

/**
 * `MG_{epoch ms}_{8 random base36}` — URL-safe, sorts chronologically, and stays inside
 * Cashfree's 50-character alphanumeric-and-underscore limit. The timestamp makes an order
 * findable in a support conversation; the random suffix means two checkouts in the same
 * millisecond cannot collide.
 */
function generateOrderId(): string {
  return `MG_${Date.now()}_${randomBase36(8)}`;
}

/**
 * There are no accounts ([ADR-001](/docs/decisions/ADR-001-tech-stack.md)), so every order
 * gets a fresh identifier that links to nothing and lets Cashfree treat the payer as a new
 * customer each time.
 */
function generateGuestCustomerId(): string {
  return `guest_${randomBase36(12)}`;
}

function toAddressFormValues(value: unknown): AddressFormValues {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  const formValues = {} as AddressFormValues;
  for (const field of ADDRESS_FIELDS) {
    const rawValue = record[field];
    formValues[field] = typeof rawValue === "string" ? rawValue : "";
  }

  return formValues;
}

function errorResponse(
  status: number,
  body: CreateOrderErrorBody,
): NextResponse<CreateOrderErrorBody> {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function malformed(
  error: CreateOrderErrorCode,
  message: string,
): NextResponse<CreateOrderErrorBody> {
  return errorResponse(400, { error, message, retryable: false });
}

function gatewayUnavailable(): NextResponse<CreateOrderErrorBody> {
  return errorResponse(502, {
    error: "PAYMENT_GATEWAY_UNAVAILABLE",
    message:
      "We could not reach the payment gateway just now. Your cart and details are safe — please try again in a moment.",
    retryable: true,
  });
}

/**
 * There is no database ([ADR-001](/docs/decisions/ADR-001-tech-stack.md)), so the payment
 * record *is* the order record and the shopper's engraving choice has to travel with it.
 * `order_tags` is where it goes — a compact `P001:Letter=A; P010:Colour=Golden`, never an
 * amount. Orders with nothing to record send the request they always sent.
 */
function buildOptionTags(summary: string): Record<string, string> | null {
  const tags = toOrderOptionTags(summary);
  return Object.keys(tags).length === 0 ? null : tags;
}

interface CashfreeOrderResponse {
  payment_session_id?: unknown;
}

/**
 * Reads only the one field the browser needs. Everything else Cashfree returns — and
 * anything it returns on a failure — stays on the server.
 */
function readPaymentSessionId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;

  const sessionId = (payload as CashfreeOrderResponse).payment_session_id;
  return typeof sessionId === "string" && sessionId.length > 0 ? sessionId : null;
}

/**
 * Creates a Cashfree payment session for a cart.
 *
 * The client sends product ids, quantities, any recorded option choices, and a delivery
 * address. It does not send — and could not usefully send — a price, a line total, or an
 * order total: the amount charged is recomputed here from `data/products.json` on every
 * call, and the request body is not consulted for it. Options do not enter that calculation
 * at any point; they are validated against the catalogue and recorded in the order's
 * metadata.
 *
 * See [ADR-013](/docs/decisions/ADR-013-order-creation-and-payment.md),
 * [ADR-019](/docs/decisions/ADR-019-product-options.md) and
 * [the contract](/docs/api/create-order.md).
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return malformed("REQUEST_MALFORMED", "We could not read that request.");
  }

  if (typeof body !== "object" || body === null) {
    return malformed("REQUEST_MALFORMED", "We could not read that request.");
  }

  const { items: rawItems, address: rawAddress } = body as Record<string, unknown>;

  const items = parseOrderItems(rawItems);
  if (items === null) {
    return malformed("REQUEST_MALFORMED", "We could not read the items in your cart.");
  }

  const products = getAllProducts();

  const order = buildOrderFromCart(mergeOrderItemsByProduct(items), products);
  if (!order.valid) {
    return errorResponse(400, {
      error: "ITEMS_INVALID",
      message: "Something in your cart can no longer be ordered.",
      retryable: false,
      details: order.errors,
    });
  }

  const lineOptions = validateOrderLineOptions(items, products);
  if (lineOptions.errors.length > 0) {
    return errorResponse(400, {
      error: "ITEMS_INVALID",
      message: "Something in your cart can no longer be ordered.",
      retryable: false,
      details: lineOptions.errors,
    });
  }

  const { errors: addressErrors, address } = validateAddressForm(
    toAddressFormValues(rawAddress),
  );
  if (address === null) {
    return errorResponse(400, {
      error: "ADDRESS_INVALID",
      message: "Please check your delivery details.",
      retryable: false,
      fields: addressErrors,
    });
  }

  if (!(order.total > 0)) {
    return errorResponse(400, {
      error: "ORDER_TOTAL_INVALID",
      message: "This order has nothing to pay for.",
      retryable: false,
    });
  }

  const credentials = readCashfreeCredentials();
  if (credentials === null) {
    console.error("[create-order] CASHFREE_APP_ID or CASHFREE_SECRET_KEY is not set");
    return errorResponse(503, {
      error: "PAYMENT_NOT_CONFIGURED",
      message:
        "Online payment is not available right now. Please contact us and we will complete your order.",
      retryable: false,
    });
  }

  const orderId = generateOrderId();
  const mode = resolveCashfreeMode();
  const optionTags = buildOptionTags(lineOptions.summary);

  let cashfreeResponse: Response;
  try {
    cashfreeResponse = await fetch(getCashfreeOrdersUrl(), {
      method: "POST",
      headers: {
        "X-Client-Id": credentials.appId,
        "X-Client-Secret": credentials.secretKey,
        "x-api-version": CASHFREE_API_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: order.total,
        order_currency: "INR",
        customer_details: {
          customer_id: generateGuestCustomerId(),
          customer_name: address.name,
          customer_email: address.email,
          customer_phone: `+91${address.phone}`,
        },
        order_meta: {
          return_url: buildReturnUrl(request.url, orderId),
        },
        ...(optionTags === null ? {} : { order_tags: optionTags }),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(CASHFREE_TIMEOUT_MS),
    });
  } catch (networkError) {
    console.error(`[create-order] ${orderId} could not reach Cashfree`, networkError);
    return gatewayUnavailable();
  }

  const responseText = await cashfreeResponse.text();

  if (!cashfreeResponse.ok) {
    console.error(
      `[create-order] ${orderId} rejected by Cashfree with ${cashfreeResponse.status}: ${responseText}`,
    );
    return gatewayUnavailable();
  }

  let paymentSessionId: string | null = null;
  try {
    paymentSessionId = readPaymentSessionId(JSON.parse(responseText));
  } catch {
    paymentSessionId = null;
  }

  if (paymentSessionId === null) {
    console.error(
      `[create-order] ${orderId} came back from Cashfree without a payment_session_id: ${responseText}`,
    );
    return gatewayUnavailable();
  }

  const success: CreateOrderSuccess = { orderId, paymentSessionId, mode };

  return NextResponse.json(success, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
