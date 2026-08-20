"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { OrderStatus, PaymentType } from "@prisma/client";
import { submitAdminOrderAction } from "@/lib/admin-order-client";
import { formatRupees } from "@/lib/format";
import { planOrderStatusChange } from "@/lib/order-status-change";
import { getOrderStatusLabel, getPaymentTypeLabel } from "@/lib/order-status";
import {
  MAX_STATUS_CHANGE_REASON_LENGTH,
  nextOrderStatuses,
  requiresChangeReason,
  requiresRefundDecision,
} from "@/lib/order-transitions";
import { Button } from "@/components/Button";

export interface AdminOrderStatusFormProps {
  actionHref: string;
  currentStatus: OrderStatus;
  paymentType: PaymentType;
  amountPrepaid: number;
}

const FIELD_CLASSES =
  "w-full border border-line bg-white px-3 py-2.5 font-sans text-body-sm text-ink transition-colors duration-250 focus:border-gold";

const FIELD_LABEL_CLASSES = "text-eyebrow uppercase tracking-caps-wide text-muted";

/**
 * The one control that moves an order, and the only place a refund decision is made.
 *
 * **The dropdown offers only what the lifecycle allows.** `nextOrderStatuses` decides what is
 * listed, so an order that is `placed` shows Packed and Cancelled and cannot be sent straight
 * to Delivered. That is a convenience, not the rule: the same `planOrderStatusChange` that
 * validates this form runs again inside the route handler, because a dropdown is HTML and the
 * operator holds a session cookie.
 *
 * **A reason and a refund decision appear together, or not at all.** RTO, Returned and
 * Cancelled are the three outcomes somebody will ask about later, and the owner's decision was
 * that both questions are answered as part of the move rather than left for a second visit
 * that may never happen. Everything below the dropdown appears the moment one of those three
 * is chosen and is submitted in the same request — one transaction, nothing to abandon
 * halfway.
 *
 * **A COD order is asked a different question.** There is no amount field, because nothing was
 * collected up front and there is nothing to give back; there is a confirmation instead, so
 * "no refund" is something an operator stated rather than something the form assumed.
 */
export function AdminOrderStatusForm({
  actionHref,
  currentStatus,
  paymentType,
  amountPrepaid,
}: AdminOrderStatusFormProps): JSX.Element {
  const router = useRouter();
  const availableStatuses = nextOrderStatuses(currentStatus);

  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundAcknowledged, setRefundAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (availableStatuses.length === 0) {
    return (
      <p className="text-body-sm text-muted">
        This order is {getOrderStatusLabel(currentStatus)} and has reached the end of its
        lifecycle. Nothing moves it from here.
      </p>
    );
  }

  const selectedStatus = availableStatuses.find((candidate) => candidate === status) ?? null;
  const needsReason = selectedStatus !== null && requiresChangeReason(selectedStatus);
  const needsRefundDecision =
    selectedStatus !== null && requiresRefundDecision(selectedStatus);
  const isCashOnDelivery = paymentType === "cod";

  function handleStatusChange(nextStatus: string): void {
    setStatus(nextStatus);
    setError(null);
    setRefundAcknowledged(false);
    setRefundAmount(
      availableStatuses.some(
        (candidate) => candidate === nextStatus && requiresRefundDecision(candidate),
      ) && paymentType !== "cod"
        ? String(amountPrepaid)
        : "",
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const submission = { status, reason, refundAmount, refundAcknowledged };
    const validation = planOrderStatusChange(
      currentStatus,
      { paymentType, amountPrepaid },
      submission,
    );

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setError(null);
    setIsSaving(true);

    const result = await submitAdminOrderAction(actionHref, submission);

    if (!result.ok) {
      setError(result.message);
      setIsSaving(false);
      return;
    }

    setStatus("");
    setReason("");
    setRefundAmount("");
    setRefundAcknowledged(false);
    setIsSaving(false);
    router.refresh();
  }

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL_CLASSES}>Move to</span>
        <select
          name="status"
          value={status}
          onChange={(event) => handleStatusChange(event.target.value)}
          className={FIELD_CLASSES}
        >
          <option value="">Choose a status</option>
          {availableStatuses.map((candidate) => (
            <option key={candidate} value={candidate}>
              {getOrderStatusLabel(candidate)}
            </option>
          ))}
        </select>
      </label>

      {needsReason ? (
        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASSES}>
            Reason <span className="normal-case tracking-normal text-sale">required</span>
          </span>
          <textarea
            name="reason"
            value={reason}
            rows={3}
            maxLength={MAX_STATUS_CHANGE_REASON_LENGTH}
            placeholder="Customer asked to cancel before dispatch"
            onChange={(event) => setReason(event.target.value)}
            className={FIELD_CLASSES}
          />
        </label>
      ) : null}

      {needsRefundDecision && isCashOnDelivery ? (
        <div className="flex flex-col gap-3 border border-line bg-ivory px-4 py-3.5">
          <p className="text-body-sm text-muted">
            No refund needed. This was {getPaymentTypeLabel(paymentType)} and no payment was
            collected up front.
          </p>
          <label className="flex items-start gap-3 text-body-sm text-ink">
            <input
              type="checkbox"
              name="refundAcknowledged"
              checked={refundAcknowledged}
              onChange={(event) => setRefundAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-charcoal"
            />
            <span>I confirm nothing goes back to the customer on this order.</span>
          </label>
        </div>
      ) : null}

      {needsRefundDecision && !isCashOnDelivery ? (
        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASSES}>
            Refund amount <span className="normal-case tracking-normal text-sale">required</span>
          </span>
          <input
            type="number"
            name="refundAmount"
            value={refundAmount}
            min={0}
            max={amountPrepaid}
            step="0.01"
            inputMode="decimal"
            onChange={(event) => setRefundAmount(event.target.value)}
            className={FIELD_CLASSES}
          />
          <span className="text-body-sm text-muted">
            {formatRupees(amountPrepaid)} was collected up front. Enter 0 to record that none of
            it goes back.
          </span>
        </label>
      ) : null}

      {error === null ? null : <p className="text-body-sm text-sale">{error}</p>}

      <div>
        <Button type="submit" size="sm" disabled={isSaving || status === ""}>
          {isSaving ? "Saving…" : "Save status change"}
        </Button>
      </div>
    </form>
  );
}
