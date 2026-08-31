import type { CheckoutData } from "@/types/cart";
import type {
  CashfreeOrderState,
  CashfreePaymentSummary,
  CodOrderResult,
  VerifiedOrderState,
  VerifyOrderErrorBody,
  VerifyOrderResult,
} from "@/types/order";

/**
 * The shape `/api/create-order` mints: `MG_{13-digit epoch ms}_{8 lowercase base36}`. Order
 * ids arrive from a query string, so they are matched against this before they are put in a
 * URL path — an id is a path segment on the Cashfree call, and an unvalidated one is a way to
 * point that call somewhere else.
 *
 * A 13-digit millisecond timestamp covers 2001 to 2286, which is the range the generator can
 * produce. Widening the generator means widening this in the same change.
 */
const ORDER_ID_PATTERN = /^MG_\d{13}_[0-9a-z]{8}$/;

export function isMorchadiOrderId(value: string): boolean {
  return ORDER_ID_PATTERN.test(value);
}

/**
 * The shape `/api/create-order` mints for an order the payment gateway never saw:
 * `COD_{13-digit epoch ms}_{8 lowercase base36}`.
 *
 * Identical in construction to `ORDER_ID_PATTERN` and deliberately different in its prefix, so
 * that the two are mutually exclusive and `isMorchadiOrderId` rejects every one of these. That
 * exclusivity is load-bearing rather than tidy: it is what stops `/api/verify-order` asking
 * Cashfree about a payment that never existed and rendering its inevitable 404 as "nothing has
 * been charged" over a real order. See
 * [ADR-059](/docs/decisions/ADR-059-checkout-payment-paths.md).
 */
const COD_ORDER_REFERENCE_PATTERN = /^COD_\d{13}_[0-9a-z]{8}$/;

export function isCodOrderReference(value: string): boolean {
  return COD_ORDER_REFERENCE_PATTERN.test(value);
}

/**
 * How often the confirmation page re-asks while an order is still `PENDING`, and how many
 * times in total. Ten attempts three seconds apart is a thirty-second window: long enough for
 * a UPI collect request or a bank redirect to settle, short enough that a shopper is not
 * watching a spinner indefinitely. After the cap the page stops polling and hands over to a
 * manual "check again" — an unbounded poll is a tab that hammers the route forever on a
 * payment nobody ever completed.
 */
export const PENDING_POLL_INTERVAL_MS = 3_000;
export const MAX_VERIFY_ATTEMPTS = 10;

const CASHFREE_STATE_BY_ORDER_STATUS: Record<string, CashfreeOrderState> = {
  PAID: "PAID",
  ACTIVE: "PENDING",
  EXPIRED: "FAILED",
  TERMINATED: "FAILED",
  TERMINATION_REQUESTED: "FAILED",
};

/**
 * Cashfree's `order_status` reduced to the three states this project acts on. Pure, and
 * deliberately so: it holds no credential, makes no request, and is the single place the
 * mapping is written, which is what makes "`PAID` is the only success" a testable claim rather
 * than an assertion spread across a route and a page.
 *
 * Anything unrecognised — a status Cashfree adds later, a missing field, a non-string, a
 * truncated body — becomes `FAILED`. The alternative default is `PAID` or `PENDING`, and both
 * of those turn a parsing surprise into either a false receipt or an endless spinner.
 * `ACTIVE` is `PENDING` rather than `FAILED` because a Cashfree order stays `ACTIVE` until a
 * payment against it succeeds: the shopper may still be on the bank's page, or an
 * asynchronous method may still be settling.
 */
export function normaliseCashfreeOrderStatus(rawStatus: unknown): CashfreeOrderState {
  if (typeof rawStatus !== "string") return "FAILED";

  const canonicalStatus = rawStatus.trim().toUpperCase();
  return CASHFREE_STATE_BY_ORDER_STATUS[canonicalStatus] ?? "FAILED";
}

/**
 * `order_amount` as Cashfree reports it — the only amount this project treats as the sum that
 * was charged. Cashfree has sent it as both a JSON number and a numeric string across API
 * versions, so both are read; anything else, including a negative or non-finite value, is
 * null rather than a guess.
 */
export function readCashfreeOrderAmount(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null) return null;

  const rawAmount = (payload as Record<string, unknown>).order_amount;
  const numericAmount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string" && rawAmount.trim().length > 0
        ? Number(rawAmount)
        : Number.NaN;

  if (!Number.isFinite(numericAmount) || numericAmount < 0) return null;
  return numericAmount;
}

function readCashfreeOrderId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;

  const rawOrderId = (payload as Record<string, unknown>).order_id;
  return typeof rawOrderId === "string" && rawOrderId.length > 0 ? rawOrderId : null;
}

/**
 * A Cashfree order body reduced to the three facts the confirmation page is allowed to know.
 * `requestedOrderId` is the fallback for the id, so a response that omits it still identifies
 * the order the shopper asked about.
 */
export function normaliseCashfreeOrder(
  payload: unknown,
  requestedOrderId: string,
): CashfreePaymentSummary {
  const rawStatus =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>).order_status
      : undefined;

  return {
    orderId: readCashfreeOrderId(payload) ?? requestedOrderId,
    status: normaliseCashfreeOrderStatus(rawStatus),
    amount: readCashfreeOrderAmount(payload),
  };
}

const VERIFIED_ORDER_STATES: readonly VerifiedOrderState[] = [
  "PAID",
  "PENDING",
  "FAILED",
  "NOT_FOUND",
];

function isVerifiedOrderState(value: unknown): value is VerifiedOrderState {
  return VERIFIED_ORDER_STATES.some((state) => state === value);
}

/**
 * Validates a `/api/verify-order` 200 body on the browser side. The page will not render a
 * success from a response it cannot fully recognise: a body missing its `status`, or carrying
 * one outside the four known states, is treated as a failure to verify rather than coerced
 * into something renderable.
 *
 * `trackingId` is held to the same standard — a value that is neither a string nor null is a
 * body this function does not recognise. A body that omits the key entirely reads as `null`
 * rather than as a fault, which is the one concession here: an order number that never arrived
 * and an order that has none are the same thing to the page, and both are handled by showing
 * the payment reference instead.
 */
export function parseVerifyOrderResult(payload: unknown): VerifyOrderResult | null {
  if (typeof payload !== "object" || payload === null) return null;

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.orderId !== "string" || candidate.orderId.length === 0) return null;
  if (!isVerifiedOrderState(candidate.status)) return null;
  if (candidate.amount !== null && typeof candidate.amount !== "number") return null;

  const trackingId = candidate.trackingId;
  if (trackingId !== undefined && trackingId !== null && typeof trackingId !== "string") {
    return null;
  }

  const amountDue = candidate.amountDue;
  if (amountDue !== undefined && amountDue !== null && typeof amountDue !== "number") {
    return null;
  }

  return {
    orderId: candidate.orderId,
    status: candidate.status,
    amount: candidate.amount,
    trackingId: typeof trackingId === "string" && trackingId.length > 0 ? trackingId : null,
    amountDue: typeof amountDue === "number" ? amountDue : null,
  };
}

/**
 * Validates a `/api/cod-order` 200 body on the browser side, to the same standard as the one
 * above and for the same reason: the confirmation page is about to tell somebody their order is
 * placed and how much cash to have ready at the door, and a body it can only half-read is worse
 * than one it refuses. Every field is required here — unlike a verified payment, a cash-on-
 * delivery order that could be found at all has all four of these or is not an order.
 */
export function parseCodOrderResult(payload: unknown): CodOrderResult | null {
  if (typeof payload !== "object" || payload === null) return null;

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.codOrderReference !== "string") return null;
  if (typeof candidate.trackingId !== "string" || candidate.trackingId.length === 0) {
    return null;
  }
  if (typeof candidate.total !== "number") return null;
  if (typeof candidate.amountDue !== "number") return null;

  return {
    codOrderReference: candidate.codOrderReference,
    trackingId: candidate.trackingId,
    total: candidate.total,
    amountDue: candidate.amountDue,
  };
}

/**
 * How the confirmation page names the order to the shopper.
 *
 * `trackingId` is the ten-character order number, and it is what a shopper quotes over
 * WhatsApp and will type into the tracking page. `cashfreeOrderId` is the gateway's own
 * reference, kept beside it in fine print because a bank dispute or a Cashfree dashboard
 * lookup is keyed on that and on nothing else.
 */
export interface OrderReference {
  trackingId: string | null;
  cashfreeOrderId: string;
}

/**
 * The order number for the order actually being confirmed, or null.
 *
 * The stamp is what makes this safe. `/payment` writes both ids into the bundle together, so
 * a bundle whose `orderId` names this Cashfree order is a bundle written by the checkout that
 * created it, and its `trackingId` belongs to the same order. A leftover bundle from an
 * abandoned checkout names a different Cashfree order and is refused — showing its order
 * number here would label somebody's payment with an order they did not place.
 *
 * Unlike `canDisplayBundleForOrder` this does not require the payment to have succeeded. An
 * order number is the order's name whether the payment is paid, pending or failed, and it is
 * most useful to quote in exactly the cases that are not `PAID`.
 *
 * It returns null rather than falling back to the Cashfree id: the two are different things
 * and the page renders them differently, so the choice belongs there and not here. A shopper
 * whose bundle is gone — a refresh after the cart was cleared, a browser that refuses
 * `sessionStorage` — sees the Cashfree reference instead of an order number, which is the
 * known cost of carrying the id in the bundle rather than in the URL. See
 * [ADR-043](/docs/decisions/ADR-043-order-id-as-primary-identifier.md).
 */
export function readBundleTrackingId(
  bundle: CheckoutData | null,
  cashfreeOrderId: string,
): string | null {
  if (bundle === null) return null;
  if (bundle.orderId !== cashfreeOrderId) return null;

  return bundle.trackingId ?? null;
}

export interface VerificationFailure {
  title: string;
  message: string;
  /** Whether asking again could plausibly answer. False when the fix is a deployment change. */
  canRetry: boolean;
}

export const UNREACHABLE_VERIFICATION: VerificationFailure = {
  title: "We could not confirm your payment just yet",
  message:
    "This is a problem reaching our own confirmation service, not a problem with your payment. Nothing has been cancelled, so please try again in a moment.",
  canRetry: true,
};

function isVerifyOrderErrorBody(payload: unknown): payload is VerifyOrderErrorBody {
  if (typeof payload !== "object" || payload === null) return false;

  const candidate = payload as Record<string, unknown>;
  return typeof candidate.error === "string" && typeof candidate.message === "string";
}

/**
 * Turns a `/api/verify-order` error body into something the confirmation page can render.
 *
 * Every branch here describes a failure to *ask* about the payment. None of them says the
 * payment failed, because none of them knows that — a shopper who has just been charged must
 * never be told their payment did not go through because our own route returned a 502.
 */
export function describeVerificationFailure(payload: unknown): VerificationFailure {
  if (!isVerifyOrderErrorBody(payload)) return UNREACHABLE_VERIFICATION;

  switch (payload.error) {
    case "PAYMENT_NOT_CONFIGURED":
      return {
        title: "Payment confirmation is not set up",
        message: payload.message,
        canRetry: false,
      };

    case "ORDER_ID_MALFORMED":
      return {
        title: "That order link is not readable",
        message: payload.message,
        canRetry: false,
      };

    case "VERIFICATION_UNAVAILABLE":
      return { ...UNREACHABLE_VERIFICATION, message: payload.message };

    default:
      return { ...UNREACHABLE_VERIFICATION, canRetry: payload.retryable === true };
  }
}

/**
 * Whether the `sessionStorage` checkout bundle may be used to decorate this order's success
 * screen. It answers a display question only — the paid status and the amount never come from
 * here ([the verify-order contract](/docs/api/verify-order.md)).
 *
 * The bundle survives a redirect and is only cleared on a confirmed payment, so a leftover
 * one from an abandoned checkout can outlive the order it was written for. Showing its items
 * next to a different order's amount would be a receipt for something nobody bought, so three
 * things must hold: the order is paid, the bundle reconciles to the amount Cashfree says was
 * charged, and — if `/payment` stamped it with the order it created — that stamp names *this*
 * order. An unstamped bundle can only be a pre-stamp write, so it falls back to the amount
 * check alone.
 */
/**
 * What the gateway was actually asked for on the checkout this bundle records.
 *
 * The bundle's `total` is what the cart was worth, and on every prepaid order those are the
 * same number — which is why this reconciliation was written as `bundle.total` before checkout
 * offered a choice. On a part-paid order they are not: Cashfree was sent the prepayment floor,
 * so comparing the cart's worth to it would refuse to show a receipt for an order that is
 * perfectly reconciled. A bundle stamped before this field existed falls back to the total,
 * which is the right answer for the only kind of order that can have produced one.
 */
function amountChargedOnlineFor(bundle: CheckoutData): number {
  return bundle.amountPrepaid ?? bundle.total;
}

/**
 * The receipt's own three figures, taken from the bundle but corrected by the two amounts the
 * *server* stamped onto it.
 *
 * The bundle's `total` is written at `/address`, one step before a payment path has been
 * chosen, so on an order that earned the online-payment discount it is the amount the cart was
 * worth and not the amount that was charged. Rendering it produced a receipt whose Total read
 * ₹549 directly under an "Amount paid" of ₹526 — two true figures on one screen with nothing
 * saying why they differ, which reads as an overcharge at exactly the moment a shopper is
 * looking for reassurance.
 *
 * `amountPrepaid` and `amountDue` are not the bundle's own arithmetic: they are copied back from
 * the create-order response and are what `canDisplayBundleForOrder` already reconciles against
 * Cashfree before any of this is shown. Their sum is therefore what the order is worth, and the
 * gap to `subtotal + shipping` is the discount that was applied — derived from the server's
 * figures rather than recomputed from the rate, so this can never disagree with what was
 * charged. A bundle stamped before those fields existed, or one whose figures leave no gap,
 * yields no discount row and the total it always showed.
 *
 * See [ADR-063](/docs/decisions/ADR-063-online-payment-discount.md) and
 * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */
export interface BundleReceiptTotals {
  subtotal: number;
  shipping: number;
  total: number;
  /** Rupees off, or null when the order was charged what the cart was worth. */
  discount: number | null;
}

export function readBundleReceiptTotals(bundle: CheckoutData): BundleReceiptTotals {
  const cartWorth = bundle.subtotal + bundle.shipping;

  if (bundle.amountPrepaid === undefined || bundle.amountDue === undefined) {
    return {
      subtotal: bundle.subtotal,
      shipping: bundle.shipping,
      total: bundle.total,
      discount: null,
    };
  }

  const charged = bundle.amountPrepaid + bundle.amountDue;
  const discount = cartWorth - charged;

  return {
    subtotal: bundle.subtotal,
    shipping: bundle.shipping,
    total: charged,
    discount: discount > 0 ? discount : null,
  };
}

export function canDisplayBundleForOrder(
  bundle: CheckoutData | null,
  verified: CashfreePaymentSummary,
): boolean {
  if (bundle === null) return false;
  if (verified.status !== "PAID") return false;
  if (verified.amount === null) return false;
  if (amountChargedOnlineFor(bundle) !== verified.amount) return false;
  if (bundle.orderId !== undefined) return bundle.orderId === verified.orderId;

  return true;
}
