import type {
  CreateOrderCodSuccess,
  CreateOrderErrorBody,
  CreateOrderOnlineSuccess,
  CreateOrderSuccess,
} from "@/types/order";
import { ADDRESS_FIELDS } from "@/lib/address";
import { CART_PATH, CHECKOUT_ADDRESS_PATH } from "@/lib/navigation";

export interface PaymentFailureAction {
  href: string;
  label: string;
}

export interface PaymentFailure {
  title: string;
  message: string;
  details: string[];
  action?: PaymentFailureAction;
  /** Whether pressing Pay again could plausibly succeed without changing anything first. */
  canRetry: boolean;
}

const BACK_TO_CART: PaymentFailureAction = {
  href: CART_PATH,
  label: "Back to cart",
};

const EDIT_ADDRESS: PaymentFailureAction = {
  href: CHECKOUT_ADDRESS_PATH,
  label: "Edit delivery details",
};

/**
 * Used when the request never produced a readable answer — the network dropped, the response
 * was not JSON, or the Cashfree SDK failed to load. Nothing about the order is known to be
 * wrong, so retrying is the right offer.
 */
export const UNREACHABLE_FAILURE: PaymentFailure = {
  title: "We could not start the payment",
  message:
    "Something interrupted the connection. Your cart and delivery details are still here, so please try again.",
  details: [],
  canRetry: true,
};

function isCreateOrderErrorBody(payload: unknown): payload is CreateOrderErrorBody {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return typeof candidate.error === "string" && typeof candidate.message === "string";
}

function isNonNegativeAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Validates a cash-on-delivery create-order 200 body before the browser acts on it.
 *
 * `trackingId` is required and must be a real string, where the online body below allows null.
 * That is not an oversight in either direction: a prepaid order can reach a confirmed payment
 * with no order number because its capture is allowed to fail (ADR-042), and a COD order cannot,
 * because a failed capture fails the whole checkout and this body is never produced without a
 * row behind it. A COD body arriving with a null order number is therefore a body this page does
 * not recognise, and refusing it is how the browser holds the server to that contract.
 */
export function isCreateOrderCodSuccess(
  payload: unknown,
): payload is CreateOrderCodSuccess {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;

  return (
    candidate.paymentType === "cod" &&
    typeof candidate.codOrderReference === "string" &&
    candidate.codOrderReference.length > 0 &&
    typeof candidate.trackingId === "string" &&
    candidate.trackingId.length > 0 &&
    isNonNegativeAmount(candidate.amountPrepaid) &&
    isNonNegativeAmount(candidate.amountDue)
  );
}

/**
 * Validates a create-order 200 body for an order that goes to the payment gateway.
 *
 * `trackingId` is checked as strictly as the rest and is allowed to be `null`, because the
 * capture that produces it may fail without failing the checkout (ADR-042). A missing key,
 * or one carrying an empty string, is a body this page does not recognise — the alternative
 * is stamping the checkout bundle with an order number that is not one.
 *
 * `paymentType` must be present and must be one of the two gateway values. It is the
 * discriminator that tells this body from the cash-on-delivery one, and requiring it rather
 * than inferring "online" from the presence of a `paymentSessionId` is what makes the two
 * shapes genuinely distinct rather than one shape with fields left out.
 */
export function isCreateOrderOnlineSuccess(
  payload: unknown,
): payload is CreateOrderOnlineSuccess {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  const hasTrackingId =
    candidate.trackingId === null ||
    (typeof candidate.trackingId === "string" && candidate.trackingId.length > 0);

  return (
    (candidate.paymentType === "prepaid" || candidate.paymentType === "partial_cod") &&
    typeof candidate.cashfreeOrderId === "string" &&
    candidate.cashfreeOrderId.length > 0 &&
    hasTrackingId &&
    typeof candidate.paymentSessionId === "string" &&
    candidate.paymentSessionId.length > 0 &&
    isNonNegativeAmount(candidate.amountPrepaid) &&
    isNonNegativeAmount(candidate.amountDue) &&
    (candidate.mode === "sandbox" || candidate.mode === "production")
  );
}

/**
 * The two 200 bodies of `/api/create-order`, either of which the payment page can act on.
 *
 * The page acts on this by leaving — for Cashfree on one branch and for the confirmation page
 * on the other — so a body it half-recognises is worse than one it rejects. Anything matching
 * neither shape becomes the retryable failure, which leaves the shopper's cart and address
 * exactly where they were.
 */
export function isCreateOrderSuccess(payload: unknown): payload is CreateOrderSuccess {
  return isCreateOrderCodSuccess(payload) || isCreateOrderOnlineSuccess(payload);
}

/**
 * Turns a `/api/create-order` error body into something the payment page can render: a
 * heading, the server's own message, the per-item or per-field detail, and where to go to
 * fix it. Anything unrecognised falls back to the retryable failure rather than rendering a
 * raw error code at the shopper.
 *
 * Field errors are listed in form order rather than object-key order, so the list reads the
 * way `/address` is laid out.
 */
export function describePaymentFailure(payload: unknown): PaymentFailure {
  if (!isCreateOrderErrorBody(payload)) return UNREACHABLE_FAILURE;

  switch (payload.error) {
    case "ITEMS_INVALID":
      return {
        title: "Your cart changed",
        message: payload.message,
        details: (payload.details ?? []).map((detail) => detail.message),
        action: BACK_TO_CART,
        canRetry: false,
      };

    case "ADDRESS_INVALID":
      return {
        title: "Check your delivery details",
        message: payload.message,
        details: ADDRESS_FIELDS.map((field) => payload.fields?.[field]).filter(
          (message): message is string => message !== undefined,
        ),
        action: EDIT_ADDRESS,
        canRetry: false,
      };

    case "PAYMENT_PATH_UNAVAILABLE":
      return {
        title: "That payment option is not available",
        message: payload.message,
        details: [],
        action: BACK_TO_CART,
        canRetry: false,
      };

    case "ORDER_NOT_RECORDED":
      return {
        title: "We could not place that order",
        message: payload.message,
        details: [],
        canRetry: true,
      };

    case "PAYMENT_NOT_CONFIGURED":
      return {
        title: "Online payment is unavailable",
        message: payload.message,
        details: [],
        canRetry: false,
      };

    case "PAYMENT_GATEWAY_UNAVAILABLE":
      return {
        title: "The payment gateway did not respond",
        message: payload.message,
        details: [],
        canRetry: true,
      };

    default:
      return {
        title: "We could not start the payment",
        message: payload.message,
        details: [],
        action: BACK_TO_CART,
        canRetry: payload.retryable === true,
      };
  }
}
