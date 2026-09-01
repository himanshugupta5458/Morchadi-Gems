import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type {
  CreateOrderCodSuccess,
  CreateOrderErrorBody,
  CreateOrderErrorCode,
  CreateOrderOnlineSuccess,
} from "@/types/order";
import {
  ADDRESS_FIELDS,
  validateAddressForm,
  type AddressFormValues,
} from "@/lib/address";
import {
  CASHFREE_API_VERSION,
  CASHFREE_TIMEOUT_MS,
  buildReturnUrl,
  getCashfreeOrdersUrl,
  readCashfreeCredentials,
  resolveAppBaseUrl,
  resolveCashfreeMode,
} from "@/lib/cashfree-config";
import {
  parsePaymentPath,
  resolvePaymentPlan,
  summariseCartPrepayment,
} from "@/lib/cod";
import { parseGiftMessage } from "@/lib/gift-message";
import { buildTrackOrderHref } from "@/lib/navigation";
import { notifyOwnerOfCodOrder } from "@/lib/notify-cod";
import { sendCodOrderConfirmationEmail } from "@/lib/notify-customer-email";
import {
  buildOrderFromCart,
  mergeOrderItemsByProduct,
  parseOrderItems,
} from "@/lib/order";
import {
  NON_GATEWAY_PAYMENT_STATUS,
  buildOrderCaptureLines,
  captureOrder,
  type CaptureOrderInput,
} from "@/lib/order-capture";
import { toOrderOptionTags, validateOrderLineOptions } from "@/lib/order-options";
import {
  getCodEligibilityCatalogue,
  getOrderCaptureCatalogue,
  getOrderOptionCatalogue,
  getOrderPricingCatalogue,
} from "@/lib/products";
import { parseUtmParams } from "@/lib/utm";
import { normaliseCashfreeOrder } from "@/lib/verify";

/**
 * Node, not Edge: this handler reads `node:crypto` for order identifiers and holds the
 * Cashfree secret in memory. Edge would work for the fetch alone, but there is nothing to
 * gain from it on a route that runs once per checkout.
 */
export const runtime = "nodejs";

/** Never prerendered and never cached — every call mints a new payment session. */
export const dynamic = "force-dynamic";

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
 * `COD_{epoch ms}_{8 random base36}` — the same construction as the Cashfree order id above and
 * deliberately **not** the same prefix.
 *
 * `orders.cashfree_order_id` is unique and non-null, and a cash-on-delivery order still needs a
 * payment reference to occupy it. Minting one in Cashfree's own `MG_` shape was the obvious
 * move and is the wrong one: `isMorchadiOrderId` would accept it, `/api/verify-order` would ask
 * Cashfree about a payment that never existed, Cashfree would answer 404, and the confirmation
 * page would tell a shopper "nothing has been charged" about an order that is perfectly real.
 * The distinct prefix makes that guard reject the reference before any request is made, so the
 * safety comes from a check that already existed rather than from a new one to remember.
 * See [ADR-059](/docs/decisions/ADR-059-checkout-payment-paths.md).
 */
function generateCodOrderReference(): string {
  return `COD_${Date.now()}_${randomBase36(8)}`;
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

function pathUnavailable(): NextResponse<CreateOrderErrorBody> {
  return errorResponse(400, {
    error: "PAYMENT_PATH_UNAVAILABLE",
    message:
      "That payment option is not available for what is in your cart. Go back a step and choose another one.",
    retryable: false,
  });
}

function orderNotRecorded(): NextResponse<CreateOrderErrorBody> {
  return errorResponse(503, {
    error: "ORDER_NOT_RECORDED",
    message:
      "We could not record your order just now, so nothing has been placed and nothing is owed. Your cart and details are safe, so please try again in a moment.",
    retryable: true,
  });
}

function gatewayUnavailable(): NextResponse<CreateOrderErrorBody> {
  return errorResponse(502, {
    error: "PAYMENT_GATEWAY_UNAVAILABLE",
    message:
      "We could not reach the payment gateway just now. Your cart and details are safe, so please try again in a moment.",
    retryable: true,
  });
}

/**
 * The shopper's engraving choice, travelling with the payment record. `order_tags` is where it
 * goes — a compact `P001:Letter=A; P010:Colour=Golden`, never an amount. Orders with nothing to
 * record send the request they always sent.
 *
 * This predates the database and survives it. The order is now also written to Postgres by
 * `captureOrder` below ([ADR-042](/docs/decisions/ADR-042-order-capture-in-postgres.md)), but
 * that write is allowed to fail without failing the checkout, so the tags stay the copy of the
 * fulfilment detail that lives wherever the money does. A packer reads them in the Cashfree
 * dashboard, which is why the options — and only the options — still travel there.
 *
 * The campaign a shopper arrived on used to ride in the same map under `utm_source`,
 * `utm_medium` and `utm_campaign`, and no longer does
 * ([ADR-075](/docs/decisions/ADR-075-minimal-cashfree-customer-payload.md)). Attribution is not
 * a fulfilment detail and Cashfree is not the system that reports on it: `captureOrder` writes
 * the same `utm` to Postgres exactly as before
 * ([ADR-039](/docs/decisions/ADR-039-analytics-and-utm-attribution.md)), so nothing about the
 * shop's own analytics changes — only what leaves the building does.
 */
function buildOrderTags(summary: string): Record<string, string> | null {
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
 * Places one order, by one of three paths, and creates a Cashfree payment session for the two
 * that need one.
 *
 * The path is a **word** the client sends — `"cod"`, `"partial"` or `"full"`, absent meaning
 * `"full"` — and never an amount and never a claim about eligibility. What each word costs is
 * decided here by `resolvePaymentPlan` from a total this route computed itself and a
 * prepayment floor it summed from its own read of `data/products.json`, and a path the cart
 * does not permit is refused with `PAYMENT_PATH_UNAVAILABLE` rather than quietly downgraded.
 * The three shapes are:
 *
 * | Path | Sent to Cashfree | `payment_type` | `amount_prepaid` | `amount_due` |
 * | --- | --- | --- | --- | --- |
 * | `full` | `total`, less 5% of `subtotal` if every line is cash-on-delivery-eligible | `prepaid` | that (possibly discounted) total | `0` |
 * | `partial` | Σ `minPrepaidAmount × qty` | `partial_cod` | that floor | `total −` floor |
 * | `cod` | **nothing at all** | `cod` | `0` | `total` |
 *
 * The online-payment discount ([ADR-063](/docs/decisions/ADR-063-online-payment-discount.md))
 * is `resolvePaymentPlan`'s decision, not this route's: it never applies to `partial`, and it
 * never applies to `full` on a cart holding a piece that requires prepayment, whether or not
 * cash on delivery was ever offered for it.
 *
 * The cash-on-delivery path never touches Cashfree: no `fetch`, no `payment_session_id`, no
 * credentials read, and a `COD_…` payment reference minted here rather than by a gateway. It is
 * also the one path where a failed Postgres write fails the checkout, because an unwritten COD
 * order exists in no system at all while an unwritten prepaid one is still recoverable from the
 * Cashfree dashboard ([ADR-042](/docs/decisions/ADR-042-order-capture-in-postgres.md),
 * [ADR-059](/docs/decisions/ADR-059-checkout-payment-paths.md)).
 *
 * It is for the same reason the one path that sends the owner's WhatsApp notification from
 * here rather than from the browser: the paid message is fired by `/order-confirmation` and
 * re-verified against Cashfree at `/api/notify-admin`, and a cash-on-delivery order has no
 * payment for that route to ask about. The captured row is the warrant instead, and the send
 * is deliberately not awaited — a placed order must not wait on CallMeBot
 * ([ADR-060](/docs/decisions/ADR-060-cod-order-notification.md)).
 *
 * The client sends product ids, quantities, any recorded option choices, a delivery address, an
 * optional gift note, and optionally the campaign it first arrived on. It does not send — and
 * could not usefully send — a price, a line total, or an order total: the amount charged is
 * recomputed here from `data/products.json` on every call, and the request body is not consulted
 * for it. None of `selectedOptions`, `giftMessage` or `utm` enters that calculation at any
 * point; all three are validated for shape and recorded on the order, and an order carrying
 * none of them sends the request it always sent.
 *
 * `giftMessage` is the newest of the three and the most obviously free-form, so it is worth
 * being explicit: it is parsed by `parseGiftMessage` into the capture input beside `utm`, after
 * `plan` has already been resolved, and no function that decides an amount is passed it. See
 * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 *
 * The 200 body names both of the order's identifiers and calls neither of them `orderId`:
 * `cashfreeOrderId` is the gateway's reference that the return URL and `/api/verify-order`
 * are keyed on, and `trackingId` is the ten-character order number the shopper is shown.
 * `trackingId` is null when the Postgres capture failed, because that write may fail without
 * failing the checkout ([ADR-043](/docs/decisions/ADR-043-order-id-as-primary-identifier.md)).
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

  const {
    items: rawItems,
    address: rawAddress,
    paymentPath: rawPaymentPath,
    giftMessage: rawGiftMessage,
    utm: rawUtm,
  } = body as Record<string, unknown>;

  const items = parseOrderItems(rawItems);
  if (items === null) {
    return malformed("REQUEST_MALFORMED", "We could not read the items in your cart.");
  }

  const order = buildOrderFromCart(
    mergeOrderItemsByProduct(items),
    getOrderPricingCatalogue(),
  );
  if (!order.valid) {
    return errorResponse(400, {
      error: "ITEMS_INVALID",
      message: "Something in your cart can no longer be ordered.",
      retryable: false,
      details: order.errors,
    });
  }

  const lineOptions = validateOrderLineOptions(items, getOrderOptionCatalogue());
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

  const plan = resolvePaymentPlan(parsePaymentPath(rawPaymentPath), {
    subtotal: order.subtotal,
    shipping: order.shipping,
    summary: summariseCartPrepayment(order.lineItems, getCodEligibilityCatalogue()),
  });
  if (plan === null) return pathUnavailable();

  const utm = parseUtmParams(rawUtm);
  const giftMessage = parseGiftMessage(rawGiftMessage);

  /**
   * Everything the order write needs except which payment reference it is filed under, built
   * once so the three paths cannot come to disagree about what was bought or what it cost. The
   * amounts here are `plan`'s, and `captureOrder` refuses the write if they do not add up to
   * `pricing.total`.
   *
   * `pricing.subtotal`/`pricing.total` are `plan`'s, not `order`'s: on a discounted `full` plan
   * they are the amount actually charged, and the row records what was charged rather than
   * what the catalogue would have charged at sticker price
   * ([ADR-063](/docs/decisions/ADR-063-online-payment-discount.md)). The two agree on every
   * other path, since `plan.onlineDiscount` is zero everywhere else.
   */
  const captureBase: Omit<CaptureOrderInput, "cashfreeOrderId" | "cashfreePaymentStatus"> = {
    address,
    utm,
    giftMessage,
    pricing: {
      subtotal: order.subtotal - plan.onlineDiscount,
      shippingFee: order.shipping,
      total: plan.total,
    },
    payment: {
      paymentType: plan.paymentType,
      amountPrepaid: plan.amountPrepaid,
      amountDue: plan.amountDue,
    },
    lines: buildOrderCaptureLines(items, order.lineItems, getOrderCaptureCatalogue()),
  };

  if (plan.path === "cod") {
    const codOrderReference = generateCodOrderReference();
    const codCapture = await captureOrder({
      ...captureBase,
      cashfreeOrderId: codOrderReference,
      cashfreePaymentStatus: NON_GATEWAY_PAYMENT_STATUS,
    });

    if (codCapture.kind === "FAILED") return orderNotRecorded();

    console.log(
      `[create-order] ${codOrderReference} captured as cash-on-delivery order ${codCapture.orderId} for ${
        codCapture.customerCreated ? "a new" : "a returning"
      } customer`,
    );

    const codOrderMessage = {
      trackingId: codCapture.orderId,
      codOrderReference,
      amountDue: plan.amountDue,
      subtotal: captureBase.pricing.subtotal,
      shipping: captureBase.pricing.shippingFee,
      total: captureBase.pricing.total,
      items: captureBase.lines.map((line) => ({
        name: line.productName,
        qty: line.quantity,
        ...(line.selectedOptions === undefined
          ? {}
          : { selectedOptions: line.selectedOptions }),
      })),
      address,
      utm,
    };

    void notifyOwnerOfCodOrder(codOrderMessage);
    void sendCodOrderConfirmationEmail(codOrderMessage, {
      trackingUrl: `${resolveAppBaseUrl(request.url)}${buildTrackOrderHref(codCapture.orderId)}`,
      createdAt: codCapture.createdAt,
    });

    const codSuccess: CreateOrderCodSuccess = {
      paymentType: "cod",
      codOrderReference,
      trackingId: codCapture.orderId,
      amountPrepaid: plan.amountPrepaid,
      amountDue: plan.amountDue,
    };

    return NextResponse.json(codSuccess, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
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
  const orderTags = buildOrderTags(lineOptions.summary);

  /**
   * Deliberately the smallest body Cashfree accepts, and short by four fields a reader may
   * expect: `customer_name`, `customer_email`, and the three `utm_*` order tags are gone on
   * purpose rather than forgotten.
   *
   * Cashfree support confirmed in writing on ticket 8314128 (2026-09-01) that `customer_id`
   * and `customer_phone` are the only mandatory members of `customer_details`, and that
   * `customer_email` is optional — supplying it changes neither the payment methods offered
   * nor the gateway's fraud scoring. So the shopper's name and inbox buy nothing at the
   * gateway, and a field that buys nothing is a field the payment processor should not hold.
   * The `utm_*` tags left for the same reason: attribution is reported from Postgres, not
   * from the Cashfree dashboard.
   *
   * None of this narrows the order record. `captureOrder` still writes the name, the email,
   * the full address and the campaign to Postgres exactly as before — this is the outbound
   * payload only. Product option tags stay, because a packer reads them where the money is.
   * See [ADR-075](/docs/decisions/ADR-075-minimal-cashfree-customer-payload.md).
   */
  const cashfreeOrderPayload = {
    order_id: orderId,
    order_amount: plan.amountPrepaid,
    order_currency: "INR",
    customer_details: {
      customer_id: generateGuestCustomerId(),
      customer_phone: `+91${address.phone}`,
    },
    order_meta: {
      return_url: buildReturnUrl(request.url, orderId),
    },
    ...(orderTags === null ? {} : { order_tags: orderTags }),
  };

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
      body: JSON.stringify(cashfreeOrderPayload),
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

  let cashfreePayload: unknown = null;
  try {
    cashfreePayload = JSON.parse(responseText);
  } catch {
    cashfreePayload = null;
  }

  const paymentSessionId = readPaymentSessionId(cashfreePayload);

  if (paymentSessionId === null) {
    console.error(
      `[create-order] ${orderId} came back from Cashfree without a payment_session_id: ${responseText}`,
    );
    return gatewayUnavailable();
  }

  const cashfreeOrder = normaliseCashfreeOrder(cashfreePayload, orderId);

  const capture = await captureOrder({
    ...captureBase,
    cashfreeOrderId: cashfreeOrder.orderId,
    cashfreePaymentStatus: cashfreeOrder.status,
  });

  if (capture.kind === "CAPTURED") {
    console.log(
      `[create-order] ${orderId} captured as order ${capture.orderId} for ${
        capture.customerCreated ? "a new" : "a returning"
      } customer`,
    );
  }

  const success: CreateOrderOnlineSuccess = {
    paymentType: plan.paymentType === "partial_cod" ? "partial_cod" : "prepaid",
    cashfreeOrderId: orderId,
    trackingId: capture.kind === "CAPTURED" ? capture.orderId : null,
    paymentSessionId,
    amountPrepaid: plan.amountPrepaid,
    amountDue: plan.amountDue,
    mode,
  };

  return NextResponse.json(success, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
