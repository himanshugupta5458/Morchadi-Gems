import type { CreateOrderErrorBody, CreateOrderSuccess } from "@/types/order";
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

/**
 * Validates the create-order 200 body before the browser acts on it.
 *
 * `trackingId` is checked as strictly as the rest and is allowed to be `null`, because the
 * capture that produces it may fail without failing the checkout (ADR-042). A missing key,
 * or one carrying an empty string, is a body this page does not recognise — the alternative
 * is stamping the checkout bundle with an order number that is not one.
 */
export function isCreateOrderSuccess(payload: unknown): payload is CreateOrderSuccess {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  const hasTrackingId =
    candidate.trackingId === null ||
    (typeof candidate.trackingId === "string" && candidate.trackingId.length > 0);

  return (
    typeof candidate.cashfreeOrderId === "string" &&
    candidate.cashfreeOrderId.length > 0 &&
    hasTrackingId &&
    typeof candidate.paymentSessionId === "string" &&
    candidate.paymentSessionId.length > 0 &&
    (candidate.mode === "sandbox" || candidate.mode === "production")
  );
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
