import type { AddressErrors } from "@/lib/address";
import type { Address } from "@/types/cart";
import type { SelectedOptions } from "@/types/product";
import type { UtmParams } from "@/types/utm";

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
  /**
   * The recorded choices for this line. Fulfilment data, not pricing data — it is checked
   * against the catalogue and written into the order's metadata, and no amount reads it.
   * See ADR-019.
   */
  selectedOptions?: SelectedOptions;
}

export interface CreateOrderRequest {
  items: CreateOrderItem[];
  address: Address;
  /**
   * The campaign this visitor first arrived on, when the browser has one stored. Marketing
   * metadata: it is written onto the Cashfree order as tags and never read by any amount.
   * Absent on the ordinary order, which is most of them. See ADR-039.
   */
  utm?: UtmParams;
}

/**
 * The 200 body of `/api/create-order`, carrying **two** order identifiers that are not
 * interchangeable, which is why neither is called `orderId`.
 *
 * `cashfreeOrderId` is the payment gateway's `MG_…` reference. It is what the return URL
 * carries, what `/api/verify-order` looks a payment up by, and what a refund is issued
 * against — machinery, not something anyone reads aloud.
 *
 * `trackingId` is `orders.id`, the ten-character code from `lib/order-id.ts`. It is the
 * customer-facing order number: the one shown on the confirmation page, quoted over WhatsApp
 * and typed into the tracking box. It is `null` when the Postgres capture failed — that write
 * is deliberately allowed to fail without failing checkout (ADR-042), so a shopper can reach
 * a confirmed payment with no order number, and every consumer here must handle it.
 */
export interface CreateOrderSuccess {
  cashfreeOrderId: string;
  trackingId: string | null;
  paymentSessionId: string;
  mode: CashfreeMode;
}

export type OrderItemErrorCode =
  | "UNKNOWN_PRODUCT"
  | "OUT_OF_STOCK"
  | "INVALID_QUANTITY"
  | "DUPLICATE_PRODUCT"
  | "INVALID_OPTION"
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
 * it. See [the verify-order contract](/docs/api/verify-order.md).
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
