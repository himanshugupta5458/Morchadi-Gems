import type { OrderStatus, PaymentType } from "@prisma/client";
import { getOrderStatusLabel, getPaymentTypeLabel, ORDER_STATUSES } from "@/lib/order-status";
import {
  isValidOrderTransition,
  MAX_STATUS_CHANGE_REASON_LENGTH,
  requiresChangeReason,
  requiresRefundDecision,
} from "@/lib/order-transitions";

/**
 * One status change exactly as a form submits it: every field a string, nothing parsed, nothing
 * trusted. The refund decision is part of this shape rather than a separate submission because
 * the owner asked for it to be part of the same action — an operator who cancels an order does
 * not get to walk away before saying what happened to the money.
 */
export interface OrderStatusChangeSubmission {
  status: string;
  reason: string;
  /** Rupees as typed. Ignored for a COD order, where there is nothing to give back. */
  refundAmount: string;
  /** The COD path's replacement for an amount: an explicit "yes, nothing is owed back". */
  refundAcknowledged: boolean;
}

/** What the order being changed already knows about its own money. */
export interface OrderRefundContext {
  paymentType: PaymentType;
  amountPrepaid: number;
}

/**
 * The refund half of a validated change.
 *
 * `isRefunded` is **derived** from the amount and is never submitted. The alternative — an
 * independent checkbox beside the amount — buys the ability to write down `isRefunded = true`
 * with `refundAmount = 0`, or the reverse, and a column whose only extra power is to contradict
 * the column beside it is the exact shape ADR-040's addendum deleted six columns to prevent.
 * A refund is money moving; the amount is the fact, and the flag is a reading of it.
 *
 * A zero decision is still recorded: `refundAmount` of `0` says an operator looked at this
 * order and decided nothing goes back, which is different from the `null` of an order nobody
 * has decided about. `refundedAt` is deliberately absent here and left null by the writer when
 * `isRefunded` is false, because ADR-040 states the invariant `isRefunded ≡ refundedAt IS NOT
 * NULL` and a timestamp on a refund that never happened would break it.
 */
export interface OrderRefundOutcome {
  isRefunded: boolean;
  refundAmount: number;
}

/** A submission that passed every check, in the shape the writer needs. */
export interface OrderStatusChangePlan {
  status: OrderStatus;
  reason: string | null;
  /** Null for a status that carries no refund question, so those columns are left untouched. */
  refund: OrderRefundOutcome | null;
}

export type OrderStatusChangeError =
  | "UNKNOWN_STATUS"
  | "INVALID_TRANSITION"
  | "REASON_REQUIRED"
  | "REASON_TOO_LONG"
  | "REFUND_AMOUNT_REQUIRED"
  | "REFUND_AMOUNT_INVALID"
  | "REFUND_AMOUNT_TOO_HIGH"
  | "REFUND_NOT_ACKNOWLEDGED";

export interface OrderStatusChangeRejection {
  ok: false;
  error: OrderStatusChangeError;
  message: string;
}

export type OrderStatusChangeValidation =
  | { ok: true; plan: OrderStatusChangePlan }
  | OrderStatusChangeRejection;

const RUPEE_AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Rupees as a person types them, or null. Two decimal places at most, because that is what
 * `Decimal(10, 2)` stores and silently rounding a third would change the number an operator
 * believes they entered.
 */
export function parseRupeeAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!RUPEE_AMOUNT_PATTERN.test(trimmed)) return null;

  const amount = Number.parseFloat(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

function toOrderStatus(raw: string): OrderStatus | null {
  return ORDER_STATUSES.find((candidate) => candidate === raw.trim()) ?? null;
}

function validateReason(
  status: OrderStatus,
  raw: string,
): OrderStatusChangeRejection | string | null {
  const reason = raw.trim();

  if (reason.length > MAX_STATUS_CHANGE_REASON_LENGTH) {
    return {
      ok: false,
      error: "REASON_TOO_LONG",
      message: `Keep the reason under ${MAX_STATUS_CHANGE_REASON_LENGTH} characters.`,
    };
  }

  if (requiresChangeReason(status) && reason.length === 0) {
    return {
      ok: false,
      error: "REASON_REQUIRED",
      message: `Say why this order is being marked ${getOrderStatusLabel(status)}.`,
    };
  }

  return reason.length === 0 ? null : reason;
}

function validateRefund(
  status: OrderStatus,
  context: OrderRefundContext,
  submission: OrderStatusChangeSubmission,
): OrderStatusChangeRejection | OrderRefundOutcome | null {
  if (!requiresRefundDecision(status)) return null;

  if (context.paymentType === "cod") {
    if (!submission.refundAcknowledged) {
      return {
        ok: false,
        error: "REFUND_NOT_ACKNOWLEDGED",
        message:
          "Confirm that no refund is due. This order was Cash on Delivery and nothing was collected up front.",
      };
    }

    return { isRefunded: false, refundAmount: 0 };
  }

  if (submission.refundAmount.trim().length === 0) {
    return {
      ok: false,
      error: "REFUND_AMOUNT_REQUIRED",
      message: `Enter a refund amount. ${getPaymentTypeLabel(context.paymentType)} orders have money to decide about. Enter 0 if none of it goes back.`,
    };
  }

  const amount = parseRupeeAmount(submission.refundAmount);

  if (amount === null) {
    return {
      ok: false,
      error: "REFUND_AMOUNT_INVALID",
      message: "Enter the refund as rupees, to at most two decimal places.",
    };
  }

  if (amount > context.amountPrepaid) {
    return {
      ok: false,
      error: "REFUND_AMOUNT_TOO_HIGH",
      message: `Only ₹${context.amountPrepaid} was collected up front, so no more than that can go back.`,
    };
  }

  return { isRefunded: amount > 0, refundAmount: amount };
}

function isRejection(
  candidate: OrderStatusChangeRejection | OrderRefundOutcome | string | null,
): candidate is OrderStatusChangeRejection {
  return typeof candidate === "object" && candidate !== null && "ok" in candidate;
}

/**
 * One submitted status change, checked against the lifecycle and against the order's own money.
 *
 * Pure: it is given the current status and the payment context rather than reading them, so the
 * page can call it to decide what to show and the route handler can call it again to decide
 * what to accept. **Both do.** The UI only ever offers a valid next status, and this function
 * is still the thing that says yes — a form is HTML, an operator has a session cookie, and
 * `curl` is a way to send any of the seven values to the endpoint. Server-side validation is
 * what makes the lifecycle a property of the order rather than a property of the dropdown.
 */
export function planOrderStatusChange(
  currentStatus: OrderStatus,
  context: OrderRefundContext,
  submission: OrderStatusChangeSubmission,
): OrderStatusChangeValidation {
  const status = toOrderStatus(submission.status);

  if (status === null) {
    return {
      ok: false,
      error: "UNKNOWN_STATUS",
      message: "Choose a status to move this order to.",
    };
  }

  if (!isValidOrderTransition(currentStatus, status)) {
    return {
      ok: false,
      error: "INVALID_TRANSITION",
      message: `An order that is ${getOrderStatusLabel(currentStatus)} cannot become ${getOrderStatusLabel(status)}.`,
    };
  }

  const reason = validateReason(status, submission.reason);
  if (isRejection(reason)) return reason;

  const refund = validateRefund(status, context, submission);
  if (isRejection(refund)) return refund;

  return { ok: true, plan: { status, reason, refund } };
}
