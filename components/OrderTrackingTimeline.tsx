import type { PublicOrderStatusEvent } from "@/lib/order-tracking";
import {
  formatTrackingDate,
  getCustomerOrderStatusLabel,
} from "@/lib/order-tracking-copy";

export interface OrderTrackingTimelineProps {
  history: readonly PublicOrderStatusEvent[];
  currentStatus: PublicOrderStatusEvent["status"];
}

/**
 * What has happened to this order and on what day, oldest first.
 *
 * Two fields per row and no third. The admin timeline renders the same table with the operator
 * who made each change and the reason they typed beside it; neither is here, neither is in
 * `PublicOrderStatusEvent`, and neither is selected by the query that fills it. A customer
 * asking where their parcel is does not need to know which person moved it or what a courier's
 * failure code said, and both are internal notes written for the shop rather than for them.
 *
 * The last row is marked as the current state rather than being styled by status, so the
 * timeline reads the same way on a happy order and an unhappy one.
 */
export function OrderTrackingTimeline({
  history,
  currentStatus,
}: OrderTrackingTimelineProps): JSX.Element {
  if (history.length === 0) {
    return (
      <p className="text-body-sm text-muted">
        We have no dated history for this order. Its current state is above, and we can tell you
        the rest if you message us.
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {history.map((event, index) => {
        const isCurrent = index === history.length - 1 && event.status === currentStatus;

        return (
          <li
            key={`${event.status}-${event.changedAt.toISOString()}`}
            className="flex items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-3.5 last:border-b-0 last:pb-0 first:pt-0"
          >
            <span
              className={`font-sans text-body-sm ${isCurrent ? "font-medium text-ink" : "text-muted"}`}
            >
              {getCustomerOrderStatusLabel(event.status)}
            </span>
            <span className="text-body-sm text-muted">{formatTrackingDate(event.changedAt)}</span>
          </li>
        );
      })}
    </ol>
  );
}
