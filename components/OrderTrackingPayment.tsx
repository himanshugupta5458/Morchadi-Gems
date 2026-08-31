import type { PublicOrderPayment } from "@/lib/order-tracking";
import { formatRupees } from "@/lib/format";

export interface OrderTrackingPaymentProps {
  payment: PublicOrderPayment;
}

/**
 * What the order came to, what has been collected, and what is still owed.
 *
 * The last figure is the one this block exists for: a customer on a part-paid or
 * cash-on-delivery order needs to know what to have ready when the courier knocks, and until
 * now the only place that said so was the confirmation screen they closed weeks ago. A fully
 * prepaid order — every order this checkout has taken through the gateway — shows "Paid in
 * full" instead of a row of zero, because "₹0 due" is a sentence that makes a reader check.
 */
export function OrderTrackingPayment({ payment }: OrderTrackingPaymentProps): JSX.Element {
  const isSettled = payment.due <= 0;

  return (
    <dl className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-6">
        <dt className="text-body-sm text-muted">Order total</dt>
        <dd className="font-sans text-body font-medium text-ink">
          {formatRupees(payment.total)}
        </dd>
      </div>

      <div className="flex items-baseline justify-between gap-6">
        <dt className="text-body-sm text-muted">Paid</dt>
        <dd className="text-body-sm text-ink">{formatRupees(payment.paid)}</dd>
      </div>

      <div className="flex items-baseline justify-between gap-6 border-t border-line pt-2">
        <dt className="text-body-sm text-muted">
          {isSettled ? "Still to pay" : "Due on delivery"}
        </dt>
        <dd
          className={`font-sans text-body-sm font-medium ${
            isSettled ? "text-ink" : "text-maroon"
          }`}
        >
          {isSettled ? "Paid in full" : formatRupees(payment.due)}
        </dd>
      </div>
    </dl>
  );
}
