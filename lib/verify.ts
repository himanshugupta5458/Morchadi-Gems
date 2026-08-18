import type { CheckoutData } from "@/types/cart";
import type {
  CashfreeOrderState,
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
): VerifyOrderResult {
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
 */
export function parseVerifyOrderResult(payload: unknown): VerifyOrderResult | null {
  if (typeof payload !== "object" || payload === null) return null;

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.orderId !== "string" || candidate.orderId.length === 0) return null;
  if (!isVerifiedOrderState(candidate.status)) return null;
  if (candidate.amount !== null && typeof candidate.amount !== "number") return null;

  return {
    orderId: candidate.orderId,
    status: candidate.status,
    amount: candidate.amount,
  };
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
    "This is a problem reaching our own confirmation service, not a problem with your payment. Nothing has been cancelled — please try again in a moment.",
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
 * here ([ADR-014](/docs/decisions/ADR-014-payment-verification-and-confirmation.md)).
 *
 * The bundle survives a redirect and is only cleared on a confirmed payment, so a leftover
 * one from an abandoned checkout can outlive the order it was written for. Showing its items
 * next to a different order's amount would be a receipt for something nobody bought, so three
 * things must hold: the order is paid, the bundle reconciles to the amount Cashfree says was
 * charged, and — if `/payment` stamped it with the order it created — that stamp names *this*
 * order. An unstamped bundle can only be a pre-stamp write, so it falls back to the amount
 * check alone.
 */
export function canDisplayBundleForOrder(
  bundle: CheckoutData | null,
  verified: VerifyOrderResult,
): boolean {
  if (bundle === null) return false;
  if (verified.status !== "PAID") return false;
  if (verified.amount === null) return false;
  if (bundle.total !== verified.amount) return false;
  if (bundle.orderId !== undefined) return bundle.orderId === verified.orderId;

  return true;
}
