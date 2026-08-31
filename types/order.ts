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

/**
 * Which of the three checkout paths a shopper picked, and the **whole** of what the client is
 * allowed to say about how an order is paid for.
 *
 * It is a word, not an amount and not a claim about eligibility. `/api/create-order` decides
 * what each word costs from its own catalogue read and refuses one the cart does not permit,
 * so a hand-written request naming `"cod"` on a barred cart is rejected rather than honoured.
 * See [ADR-059](/docs/decisions/ADR-059-checkout-payment-paths.md).
 */
export type PaymentPath = "cod" | "partial" | "full";

export interface CreateOrderRequest {
  items: CreateOrderItem[];
  address: Address;
  /**
   * Absent on a body written before this field existed, and read as `"full"` — which is what
   * every such body has always meant.
   */
  paymentPath?: PaymentPath;
  /**
   * A note the shopper typed for whoever packs the parcel. Free text, capped and sanitised by
   * `parseGiftMessage` on the server, recorded on the order and read by nothing that decides an
   * amount. Absent on the ordinary order. See
   * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
   */
  giftMessage?: string;
  /**
   * The campaign this visitor first arrived on, when the browser has one stored. Marketing
   * metadata: it is written onto the Cashfree order as tags and never read by any amount.
   * Absent on the ordinary order, which is most of them. See ADR-039.
   */
  utm?: UtmParams;
}

/**
 * The 200 body of `/api/create-order` for an order that goes to the payment gateway, carrying
 * **two** order identifiers that are not interchangeable, which is why neither is called
 * `orderId`.
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
 *
 * `amountPrepaid` is what the gateway is being asked for and equals the order total on a
 * `prepaid` order. On a `partial_cod` order it is the prepayment floor and `amountDue` is the
 * rest, which is the one case where the amount the shopper is about to be charged is *not* the
 * amount their cart is worth.
 */
export interface CreateOrderOnlineSuccess {
  paymentType: "prepaid" | "partial_cod";
  cashfreeOrderId: string;
  trackingId: string | null;
  paymentSessionId: string;
  amountPrepaid: number;
  amountDue: number;
  mode: CashfreeMode;
}

/**
 * The 200 body for a cash-on-delivery order, which is a **genuinely different shape** rather
 * than the one above with its gateway fields nulled out.
 *
 * There is no `paymentSessionId` and no `mode`, because no payment session was minted and no
 * SDK will be loaded: the browser goes straight to the confirmation page. There is no
 * `cashfreeOrderId` either — `codOrderReference` is the `COD_…` reference this shop mints for
 * an order the gateway never saw, and it is deliberately not in Cashfree's shape so that
 * `isMorchadiOrderId` rejects it and no code path can be tricked into asking Cashfree about a
 * payment that never existed.
 *
 * `trackingId` is **not** nullable here, and that is the asymmetry worth noticing. A prepaid
 * capture may fail without failing checkout because the money is at Cashfree and the order is
 * recoverable from their dashboard; a COD capture that failed leaves the order in no system at
 * all, so it fails the checkout instead and this body is never produced without a row behind
 * it. See [ADR-059](/docs/decisions/ADR-059-checkout-payment-paths.md).
 */
export interface CreateOrderCodSuccess {
  paymentType: "cod";
  codOrderReference: string;
  trackingId: string;
  amountPrepaid: number;
  amountDue: number;
}

export type CreateOrderSuccess = CreateOrderOnlineSuccess | CreateOrderCodSuccess;

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
 * What Cashfree said about one payment, and the whole of what Cashfree is able to say.
 * `amount` is its `order_amount` and nothing else — never the `sessionStorage` bundle's
 * total, never a number from the client. It is null when Cashfree has no such order, or when
 * its response carried no readable amount.
 *
 * Separate from `VerifyOrderResult` below because the gateway has no idea what this shop
 * calls the order. A layer that only ever talks to Cashfree — `lib/cashfree-order.ts`, the
 * admin notification — takes this shape, so it has no `trackingId` field to leave
 * structurally null.
 */
export interface CashfreePaymentSummary {
  orderId: string;
  status: VerifiedOrderState;
  amount: number | null;
}

/**
 * The whole 200 body of `GET /api/verify-order`: what Cashfree said, plus the order number
 * this shop knows the same order by.
 *
 * `trackingId` is `orders.id`, read from Postgres by the payment's `cashfree_order_id` — the
 * same column this route already writes the verified payment status to. It is null when there
 * is no such row, which is exactly the case ADR-042 allows: a capture that failed leaves a
 * paid order with no order number, and this says so rather than inventing one.
 *
 * It is here so that the order number survives a refresh of the confirmation page. The
 * `order_id` in that page's URL persists; the `sessionStorage` bundle that used to carry the
 * order number does not, because a confirmed payment clears it. See
 * [ADR-045](/docs/decisions/ADR-045-public-order-tracking.md).
 */
export interface VerifyOrderResult extends CashfreePaymentSummary {
  trackingId: string | null;
  /**
   * What is still owed on this order at the door, read from `orders.amount_due` on the same row
   * `trackingId` comes from. Zero on the prepaid order, which is every order this shop took
   * before checkout offered a choice; positive on a `partial_cod` order, where Cashfree's
   * `amount` above is the prepayment floor rather than what the cart was worth.
   *
   * Null for the same reasons `trackingId` is null and only those: no such row, or a database
   * that did not answer. It is deliberately not defaulted to zero, because "nothing is owed"
   * and "we could not find out" are different sentences to put in front of somebody who may be
   * about to hand cash to a courier.
   */
  amountDue: number | null;
}

/**
 * The whole 200 body of `GET /api/cod-order`: what this shop knows about an order the payment
 * gateway never saw.
 *
 * There is no payment status here and no `amount`, because there was no payment — a COD order
 * is *placed*, and that is the whole of what the confirmation page is entitled to celebrate.
 * `amountDue` is the full order total and `total` is beside it so the page can say the same
 * number twice without the browser doing arithmetic on money.
 */
export interface CodOrderResult {
  codOrderReference: string;
  trackingId: string;
  total: number;
  amountDue: number;
}

export type CodOrderErrorCode =
  | "COD_REFERENCE_MALFORMED"
  | "COD_ORDER_NOT_FOUND"
  | "COD_LOOKUP_UNAVAILABLE";

export interface CodOrderErrorBody {
  error: CodOrderErrorCode;
  message: string;
  retryable: boolean;
}

export type VerifyOrderErrorCode =
  | "ORDER_ID_MALFORMED"
  /**
   * A `COD_…` reference reached the route that asks Cashfree about a payment. Distinct from
   * `ORDER_ID_MALFORMED` because the reference is perfectly well formed and names a real order:
   * what it names is an order with no payment to verify, and telling a shopper "that reference
   * is not one of ours" about their own order number would be a lie the shape check happens to
   * produce. Nothing this project ships sends one here; the code exists so that if something
   * ever does, the answer is the true one and no request reaches Cashfree.
   */
  | "COD_ORDER_NOT_VERIFIABLE"
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
  /**
   * The cart does not permit the path the request named — cash on delivery on a cart holding a
   * piece that requires prepayment, or a part-payment on a cart that has no floor to part-pay.
   * Not retryable: pressing the same button again asks for the same refused thing, and the way
   * forward is to pick another path or change the cart.
   */
  | "PAYMENT_PATH_UNAVAILABLE"
  /**
   * A cash-on-delivery order could not be written to Postgres, so it was not placed.
   *
   * This is the one place a capture failure is fatal, and the asymmetry is the point. A prepaid
   * capture may fail without failing checkout because the money is already at Cashfree and the
   * order is recoverable from their dashboard (ADR-042). A COD order has no such second copy:
   * a failed write leaves it in no system at all, and a confirmation screen over that would be
   * a promise nothing in this shop could keep. Retryable — the database being back is all this
   * needs. See [ADR-059](/docs/decisions/ADR-059-checkout-payment-paths.md).
   */
  | "ORDER_NOT_RECORDED"
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
