import { OrderTrackingTimeline } from "@/components/OrderTrackingTimeline";
import { formatRupees } from "@/lib/format";
import type { PublicOrderTracking } from "@/lib/order-tracking";
import {
  ORDER_NOT_FOUND_MESSAGE,
  describeOrderStatusForCustomer,
  formatTrackingDate,
} from "@/lib/order-tracking-copy";

export interface OrderTrackingResultProps {
  tracking: PublicOrderTracking | null;
}

/**
 * The answer to one lookup: where the order is, how it got there, and whether money has gone
 * back — or the single message that covers every way a lookup finds nothing.
 */
export function OrderTrackingResult({ tracking }: OrderTrackingResultProps): JSX.Element {
  if (tracking === null) {
    return <p className="text-body-sm text-muted">{ORDER_NOT_FOUND_MESSAGE}</p>;
  }

  const statusCopy = describeOrderStatusForCustomer(tracking.status);

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading-md text-ink">{statusCopy.headline}</h2>
        <p className="text-body-sm text-muted">{statusCopy.detail}</p>
      </div>

      <OrderTrackingTimeline history={tracking.history} currentStatus={tracking.status} />

      {tracking.refund !== null ? (
        <p className="text-body-sm text-muted">
          {`A refund of ${formatRupees(tracking.refund.amount)} has been processed`}
          {tracking.refund.refundedAt !== null
            ? ` on ${formatTrackingDate(tracking.refund.refundedAt)}`
            : ""}
          .
        </p>
      ) : null}
    </section>
  );
}
