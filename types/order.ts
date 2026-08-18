import type { AddressErrors } from "@/lib/address";
import type { Address } from "@/types/cart";

/**
 * Which Cashfree environment an order was created against. It travels back to the browser in
 * the create-order response so the checkout SDK is initialised against the same environment
 * the `payment_session_id` was minted in — a sandbox session handed to a production SDK
 * fails, and the client has no other way to know which it got.
 */
export type CashfreeMode = "sandbox" | "production";

/**
 * The only thing the client is allowed to say about money: which product, and how many. No
 * price, no line total, no order total. The server looks up what those cost.
 */
export interface CreateOrderItem {
  productId: string;
  qty: number;
}

export interface CreateOrderRequest {
  items: CreateOrderItem[];
  address: Address;
}

export interface CreateOrderSuccess {
  orderId: string;
  paymentSessionId: string;
  mode: CashfreeMode;
}

export type OrderItemErrorCode =
  | "UNKNOWN_PRODUCT"
  | "OUT_OF_STOCK"
  | "INVALID_QUANTITY"
  | "DUPLICATE_PRODUCT"
  | "EMPTY_CART";

/** `productId` is null for a fault about the order as a whole rather than about one line. */
export interface OrderItemError {
  productId: string | null;
  code: OrderItemErrorCode;
  message: string;
}

/**
 * What the server concluded about an order after asking Cashfree. Three states, because a
 * shopper standing on the confirmation page needs exactly three answers: it worked, it is
 * still happening, or it did not work.
 *
 * `PAID` is the only one of these that may drive a success screen, and it can only ever be
 * produced by `lib/verify.ts` from a Cashfree response. Nothing in the browser can construct
 * it. See [ADR-014](/docs/decisions/ADR-014-payment-verification-and-confirmation.md).
 */
export type CashfreeOrderState = "PAID" | "PENDING" | "FAILED";

/**
 * `NOT_FOUND` is not a Cashfree `order_status` — it is what a 404 from Cashfree becomes. It
 * is kept distinct from `FAILED` because the two have different causes (a wrong or invented
 * order id, versus a payment that genuinely did not complete), even though the confirmation
 * page offers the same way forward for both.
 */
export type VerifiedOrderState = CashfreeOrderState | "NOT_FOUND";

/**
 * The whole 200 body of `GET /api/verify-order`. `amount` is Cashfree's `order_amount` and
 * nothing else — never the `sessionStorage` bundle's total, never a number from the client.
 * It is null when Cashfree has no such order, or when its response carried no readable
 * amount.
 */
export interface VerifyOrderResult {
  orderId: string;
  status: VerifiedOrderState;
  amount: number | null;
}

export type VerifyOrderErrorCode =
  | "ORDER_ID_MALFORMED"
  | "PAYMENT_NOT_CONFIGURED"
  | "VERIFICATION_UNAVAILABLE";

/**
 * Every non-200 body from `/api/verify-order`. These describe a failure to *ask* about the
 * payment, which is a different thing from the payment having failed — the confirmation page
 * renders them as "we could not confirm this yet", never as "your payment failed".
 */
export interface VerifyOrderErrorBody {
  error: VerifyOrderErrorCode;
  message: string;
  retryable: boolean;
}

export type CreateOrderErrorCode =
  | "REQUEST_MALFORMED"
  | "ITEMS_INVALID"
  | "ADDRESS_INVALID"
  | "ORDER_TOTAL_INVALID"
  | "PAYMENT_NOT_CONFIGURED"
  | "PAYMENT_GATEWAY_UNAVAILABLE";

/**
 * Every non-200 body from `/api/create-order`. `message` is written to be shown to a shopper
 * as-is; it never carries an upstream error, a status code, or anything about credentials.
 * `retryable` says whether pressing the button again could plausibly succeed.
 */
export interface CreateOrderErrorBody {
  error: CreateOrderErrorCode;
  message: string;
  retryable: boolean;
  details?: OrderItemError[];
  fields?: AddressErrors;
}
